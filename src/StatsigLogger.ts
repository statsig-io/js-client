import { v4 as uuidv4 } from 'uuid';
import LogEvent from './LogEvent';
import { IHasStatsigInternal } from './StatsigClient';
import { StatsigEndpoint } from './StatsigNetwork';
import { EvaluationDetails } from './StatsigStore';
import { StatsigUser } from './StatsigUser';
import { STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY } from './utils/Constants';
import Diagnostics, { ContextType, Marker } from './utils/Diagnostics';
import StatsigAsyncStorage from './utils/StatsigAsyncStorage';
import StatsigLocalStorage from './utils/StatsigLocalStorage';

const INTERNAL_EVENT_PREFIX = 'statsig::';
const CONFIG_EXPOSURE_EVENT = INTERNAL_EVENT_PREFIX + 'config_exposure';
const LAYER_EXPOSURE_EVENT = INTERNAL_EVENT_PREFIX + 'layer_exposure';
const GATE_EXPOSURE_EVENT = INTERNAL_EVENT_PREFIX + 'gate_exposure';
const LOG_FAILURE_EVENT = INTERNAL_EVENT_PREFIX + 'log_event_failed';
const APP_ERROR_EVENT = INTERNAL_EVENT_PREFIX + 'app_error';
const APP_METRICS_PAGE_LOAD_EVENT =
  INTERNAL_EVENT_PREFIX + 'app_metrics::page_load_time';
const APP_METRICS_DOM_INTERACTIVE_EVENT =
  INTERNAL_EVENT_PREFIX + 'app_metrics::dom_interactive_time';
const APP_METRICS_SCROLL_DEPTH_EVENT =
  INTERNAL_EVENT_PREFIX + 'app_metrics::scroll_depth';
const APP_METRICS_SESSION_LENGTH_EVENT =
  INTERNAL_EVENT_PREFIX + 'app_metrics::time_on_page_ms';
const DIAGNOSTICS_EVENT = INTERNAL_EVENT_PREFIX + 'diagnostics';
const DEFAULT_VALUE_WARNING =
  INTERNAL_EVENT_PREFIX + 'default_value_type_mismatch';
const NON_EXPOSED_CHECKS_EVENT = INTERNAL_EVENT_PREFIX + 'non_exposed_checks';

type FailedLogEventBody = {
  events: object[];
  statsigMetadata: object;
  time: number;
};

const MS_RETRY_LOGS_CUTOFF = 5 * 24 * 60 * 60 * 1000;
const MAX_BATCHES_TO_RETRY = 100;
const MAX_FAILED_EVENTS = 1000;
const MAX_LOCAL_STORAGE_SIZE = 1024 * MAX_FAILED_EVENTS;
const MAX_ERRORS_TO_LOG = 10;

export default class StatsigLogger {
  private sdkInternal: IHasStatsigInternal;

  private queue: object[];

  private nonExposedChecks: Record<string, number>;

  private flushInterval: ReturnType<typeof setInterval> | null;
  private loggedErrors: Set<string>;
  private failedLogEvents: FailedLogEventBody[];
  private exposureDedupeKeys: Record<string, number>;
  private failedLogEventCount = 0;

  public constructor(sdkInternal: IHasStatsigInternal) {
    this.sdkInternal = sdkInternal;

    this.queue = [];
    this.nonExposedChecks = {};
    this.flushInterval = null;
    this.loggedErrors = new Set();

    this.failedLogEvents = [];
    this.exposureDedupeKeys = {};
    this.failedLogEventCount = 0;
    this.init();
  }

  private init(): void {
    if (
      typeof window !== 'undefined' &&
      typeof window.addEventListener === 'function'
    ) {
      window.addEventListener('blur', () => this.flush(true));
      window.addEventListener('beforeunload', () => this.flush(true));
      window.addEventListener('load', () => {
        setTimeout(() => this.flush(), 100);
        setTimeout(() => this.flush(), 1000);
      });
    }
    if (
      typeof document !== 'undefined' &&
      typeof document.addEventListener === 'function'
    ) {
      document.addEventListener('visibilitychange', () => {
        this.flush(document.visibilityState !== 'visible');
      });
    }
    if (
      !this.sdkInternal.getOptions().getIgnoreWindowUndefined() &&
      (typeof window === 'undefined' || window == null)
    ) {
      // dont set the flush interval outside of client browser environments
      return;
    }
    if (this.sdkInternal.getOptions().getLocalModeEnabled()) {
      // unnecessary interval in local mode since logs dont flush anyway
      return;
    }

    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.sdkInternal.getOptions().getLoggingIntervalMillis());

    // Quick flush
    setTimeout(() => this.flush(), 100);
    setTimeout(() => this.flush(), 1000);
  }

  public log(event: LogEvent): void {
    if (this.sdkInternal.getOptions().isAllLoggingDisabled()) {
      return;
    }

    try {
      if (
        !this.sdkInternal.getOptions().getDisableCurrentPageLogging() &&
        typeof window !== 'undefined' &&
        window != null &&
        typeof window.location === 'object' &&
        typeof window.location.href === 'string'
      ) {
        // https://stackoverflow.com/questions/6257463/how-to-get-the-url-without-any-parameters-in-javascript
        const parts = window.location.href.split(/[?#]/);
        if (parts?.length > 0) {
          event.addStatsigMetadata('currentPage', parts[0]);
        }
      }
    } catch {
      // noop
    }

    this.queue.push(event.toJsonObject());

    if (
      this.queue.length >=
      this.sdkInternal.getOptions().getLoggingBufferMaxSize()
    ) {
      this.flush();
    }
  }

  public resetDedupeKeys() {
    this.exposureDedupeKeys = {};
  }

  private shouldLogExposure(key: string): boolean {
    const lastTime = this.exposureDedupeKeys[key];
    const now = Date.now();
    if (lastTime == null) {
      this.exposureDedupeKeys[key] = now;
      return true;
    }
    if (lastTime >= now - 600 * 1000) {
      return false;
    }
    this.exposureDedupeKeys[key] = now;
    return true;
  }

  public addNonExposedCheck(configName: string) {
    if (this.nonExposedChecks[configName] == null) {
      this.nonExposedChecks[configName] = 1;
    } else {
      this.nonExposedChecks[configName]++;
    }
  }

  public logGateExposure(
    user: StatsigUser | null,
    gateName: string,
    gateValue: boolean,
    ruleID: string,
    secondaryExposures: Record<string, string>[],
    details: EvaluationDetails,
    isManualExposure: boolean,
  ) {
    const dedupeKey = gateName + String(gateValue) + ruleID + details.reason;
    if (!this.shouldLogExposure(dedupeKey)) {
      return;
    }

    const metadata: Record<string, unknown> = {
      gate: gateName,
      gateValue: String(gateValue),
      ruleID: ruleID,
      reason: details.reason,
      time: details.time,
    };

    if (isManualExposure) {
      metadata['isManualExposure'] = 'true';
    }

    const gateExposure = new LogEvent(GATE_EXPOSURE_EVENT);
    gateExposure.setUser(user);
    gateExposure.setMetadata(metadata);
    gateExposure.setSecondaryExposures(secondaryExposures);
    this.log(gateExposure);
  }

  public logConfigExposure(
    user: StatsigUser | null,
    configName: string,
    ruleID: string,
    secondaryExposures: Record<string, string>[],
    details: EvaluationDetails,
    isManualExposure: boolean,
  ) {
    const dedupeKey = configName + ruleID + details.reason;
    if (!this.shouldLogExposure(dedupeKey)) {
      return;
    }

    const metadata: Record<string, unknown> = {
      config: configName,
      ruleID: ruleID,
      reason: details.reason,
      time: details.time,
    };

    if (isManualExposure) {
      metadata['isManualExposure'] = 'true';
    }

    const configExposure = new LogEvent(CONFIG_EXPOSURE_EVENT);
    configExposure.setUser(user);
    configExposure.setMetadata(metadata);
    configExposure.setSecondaryExposures(secondaryExposures);
    this.log(configExposure);
  }

  public logLayerExposure(
    user: StatsigUser | null,
    configName: string,
    ruleID: string,
    secondaryExposures: Record<string, string>[],
    allocatedExperiment: string,
    parameterName: string,
    isExplicitParameter: boolean,
    details: EvaluationDetails,
    isManualExposure: boolean,
  ) {
    const dedupeKey = [
      configName,
      ruleID,
      allocatedExperiment,
      parameterName,
      String(isExplicitParameter),
      details.reason,
    ].join('|');

    if (!this.shouldLogExposure(dedupeKey)) {
      return;
    }

    const metadata: Record<string, unknown> = {
      config: configName,
      ruleID: ruleID,
      allocatedExperiment,
      parameterName,
      isExplicitParameter: String(isExplicitParameter),
      reason: details.reason,
      time: details.time,
    };

    if (isManualExposure) {
      metadata['isManualExposure'] = 'true';
    }

    const configExposure = new LogEvent(LAYER_EXPOSURE_EVENT);
    configExposure.setUser(user);
    configExposure.setMetadata(metadata);
    configExposure.setSecondaryExposures(secondaryExposures);
    this.log(configExposure);
  }

  public logConfigDefaultValueFallback(
    user: StatsigUser | null,
    message: string,
    metadata: object,
  ): void {
    this.logGenericEvent(DEFAULT_VALUE_WARNING, user, message, metadata);
    this.loggedErrors.add(message);
    this.sdkInternal.getConsoleLogger().error(message);
  }

  public logAppError(
    user: StatsigUser | null,
    message: string,
    metadata: object,
  ) {
    const trimmedMessage = message.substring(0, 128);
    if (
      this.loggedErrors.has(trimmedMessage) ||
      this.loggedErrors.size > MAX_ERRORS_TO_LOG
    ) {
      return;
    }

    this.logGenericEvent(APP_ERROR_EVENT, user, trimmedMessage, metadata);
    this.loggedErrors.add(trimmedMessage);
  }

  public logDiagnostics(user: StatsigUser | null, context: ContextType) {
    const markers = Diagnostics.getMarkers(context);
    if (markers.length <= 0) {
      return;
    }
    Diagnostics.clearContext(context);
    const event = this.makeDiagnosticsEvent(user, {
      markers,
      context,
      statsigOptions: this.sdkInternal.getOptions().getLoggingCopy(),
    });
    this.log(event);
  }

  public logAppMetrics(user: StatsigUser | null) {
    if (typeof window?.performance?.getEntriesByType !== 'function') {
      return;
    }
    const entries = window.performance.getEntriesByType('navigation');
    if (!entries || entries.length < 1) {
      return;
    }

    const navEntry = entries[0];
    const metadata = {
      url: navEntry.name,
    };

    if (navEntry instanceof PerformanceNavigationTiming) {
      this.logGenericEvent(
        APP_METRICS_PAGE_LOAD_EVENT,
        user,
        navEntry.duration,
        metadata,
      );

      this.logGenericEvent(
        APP_METRICS_DOM_INTERACTIVE_EVENT,
        user,
        navEntry.domInteractive - navEntry.startTime,
        metadata,
      );
    }

    if (typeof window?.addEventListener === 'function' && document?.body) {
      let deepestScroll = 0;
      window.addEventListener('scroll', () => {
        const scrollHeight = document.body.scrollHeight || 1;
        const scrollDepth = Math.min(
          100,
          Math.round(
            ((window.scrollY + window.innerHeight) / scrollHeight) * 100,
          ),
        );
        if (scrollDepth > deepestScroll) {
          deepestScroll = scrollDepth;
        }
      });

      window.addEventListener('beforeunload', () => {
        this.logGenericEvent(
          APP_METRICS_SCROLL_DEPTH_EVENT,
          user,
          deepestScroll,
          metadata,
        );
        this.logGenericEvent(
          APP_METRICS_SESSION_LENGTH_EVENT,
          user,
          window.performance.now(),
          metadata,
        );
      });
    }
  }

  private logGenericEvent(
    eventName: string,
    user: StatsigUser | null,
    value: string | number,
    metadata: object,
  ): LogEvent {
    const evt = new LogEvent(eventName);
    evt.setUser(user);
    evt.setValue(value);
    evt.setMetadata(metadata);
    this.log(evt);
    return evt;
  }

  public shutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    this.flush(true);
  }

  public flush(isClosing = false): void {
    this.addErrorBoundaryDiagnostics();
    this.addNonExposedChecksEvent();

    if (this.queue.length === 0) {
      return;
    }
    const statsigMetadata = this.sdkInternal.getStatsigMetadata();
    if (statsigMetadata.sessionID == null) {
      statsigMetadata.sessionID = uuidv4();
    }
    const oldQueue = this.queue;
    this.queue = [];
    if (
      isClosing &&
      !this.sdkInternal.getNetwork().supportsKeepalive() &&
      typeof navigator !== 'undefined' &&
      navigator?.sendBeacon != null
    ) {
      const beacon = this.sdkInternal.getNetwork().sendLogBeacon({
        events: oldQueue,
        statsigMetadata: this.sdkInternal.getStatsigMetadata(),
      });
      if (!beacon) {
        this.queue = oldQueue.concat(this.queue);
        if (this.queue.length > 0) {
          this.addFailedRequest({
            events: this.queue,
            statsigMetadata: this.sdkInternal.getStatsigMetadata(),
            time: Date.now(),
          });
          this.queue = [];
        }
        this.saveFailedRequests();
      }
      return;
    }

    this.sdkInternal
      .getNetwork()
      .postToEndpoint(
        StatsigEndpoint.Rgstr,
        {
          events: oldQueue,
          statsigMetadata: this.sdkInternal.getStatsigMetadata(),
        },
        {
          retryOptions: {
            retryLimit: 3,
            backoff: 1000,
          },
          useKeepalive: isClosing,
        },
      )
      .then((response) => {
        if (!response.ok) {
          throw response;
        }
      })
      .catch((error) => {
        if (typeof error.text === 'function') {
          error.text().then((errorText: string) => {
            this.sdkInternal
              .getErrorBoundary()
              .logError(LOG_FAILURE_EVENT, error, {
                getExtraData: async () => {
                  return {
                    eventCount: oldQueue.length,
                    error: errorText,
                  };
                },
              });
          });
        } else {
          this.sdkInternal
            .getErrorBoundary()
            .logError(LOG_FAILURE_EVENT, error, {
              getExtraData: async () => {
                return {
                  eventCount: oldQueue.length,
                  error: error.message,
                };
              },
            });
        }
        this.newFailedRequest(LOG_FAILURE_EVENT, oldQueue);
      })
      .finally(async () => {
        if (isClosing) {
          if (this.queue.length > 0) {
            this.addFailedRequest({
              events: this.queue,
              statsigMetadata: this.sdkInternal.getStatsigMetadata(),
              time: Date.now(),
            });

            // on app background/window blur, save unsent events as a request and clean up the queue (in case app foregrounds)
            this.queue = [];
          }

          this.saveFailedRequests();
        }
      });
  }

  private saveFailedRequests(): void {
    if (this.failedLogEvents.length > 0) {
      const requestsCopy = JSON.stringify(this.failedLogEvents);
      if (requestsCopy.length > MAX_LOCAL_STORAGE_SIZE) {
        this.clearLocalStorageRequests();
        return;
      }

      if (StatsigAsyncStorage.asyncStorage) {
        StatsigAsyncStorage.setItemAsync(
          STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY,
          requestsCopy,
        ).catch((reason) =>
          this.sdkInternal
            .getErrorBoundary()
            .logError('saveFailedRequests', reason),
        );
        return;
      }

      StatsigLocalStorage.setItem(
        STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY,
        requestsCopy,
      );
    }
  }

  public async sendSavedRequests(): Promise<void> {
    let failedRequests;
    let fireAndForget = false;
    if (StatsigAsyncStorage.asyncStorage) {
      failedRequests = await StatsigAsyncStorage.getItemAsync(
        STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY,
      );
    } else {
      failedRequests = StatsigLocalStorage.getItem(
        STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY,
      );
    }
    if (failedRequests == null) {
      this.clearLocalStorageRequests();
      return;
    }
    if (failedRequests.length > MAX_LOCAL_STORAGE_SIZE) {
      fireAndForget = true;
    }
    let requestBodies = [];
    try {
      requestBodies = JSON.parse(failedRequests);
      for (const requestBody of requestBodies) {
        if (
          requestBody != null &&
          requestBody.events &&
          Array.isArray(requestBody.events)
        ) {
          this.sdkInternal
            .getNetwork()
            .postToEndpoint(StatsigEndpoint.Rgstr, requestBody)
            .then((response) => {
              if (!response.ok) {
                throw Error(response.status + '');
              }
            })
            .catch(() => {
              if (fireAndForget) {
                return;
              }
              this.addFailedRequest(requestBody);
            });
        }
      }
    } catch (e) {
      this.sdkInternal.getErrorBoundary().logError('sendSavedRequests', e);
    } finally {
      this.clearLocalStorageRequests();
    }
  }

  private addFailedRequest(requestBody: FailedLogEventBody): void {
    if (requestBody.time < Date.now() - MS_RETRY_LOGS_CUTOFF) {
      return;
    }
    if (this.failedLogEvents.length > MAX_BATCHES_TO_RETRY) {
      return;
    }
    const additionalEvents = requestBody.events.length;
    if (this.failedLogEventCount + additionalEvents > MAX_FAILED_EVENTS) {
      return;
    }
    this.failedLogEvents.push(requestBody);
    this.failedLogEventCount += additionalEvents;
  }

  private clearLocalStorageRequests(): void {
    if (StatsigAsyncStorage.asyncStorage) {
      StatsigAsyncStorage.removeItemAsync(
        STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY,
      ).catch((reason) =>
        this.sdkInternal
          .getErrorBoundary()
          .logError('clearLocalStorageRequests', reason),
      );
    } else {
      StatsigLocalStorage.removeItem(STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY);
    }
  }

  private newFailedRequest(name: string, queue: object[]): void {
    if (this.loggedErrors.has(name)) {
      return;
    }
    this.loggedErrors.add(name);

    this.failedLogEvents.push({
      events: queue,
      statsigMetadata: this.sdkInternal.getStatsigMetadata(),
      time: Date.now(),
    });

    this.saveFailedRequests();
  }

  private makeDiagnosticsEvent(
    user: StatsigUser | null,
    data: {
      context: ContextType;
      markers: Marker[];
      statsigOptions?: Record<string, unknown>;
    },
  ) {
    const latencyEvent = new LogEvent(DIAGNOSTICS_EVENT);
    latencyEvent.setUser(user);
    latencyEvent.setMetadata(data);
    return latencyEvent;
  }

  private addErrorBoundaryDiagnostics() {
    if (Diagnostics.getMarkerCount('api_call') === 0) {
      return;
    }

    const diagEvent = this.makeDiagnosticsEvent(
      this.sdkInternal.getCurrentUser(),
      {
        context: 'api_call',
        markers: Diagnostics.getMarkers('api_call'),
      },
    );
    this.queue.push(diagEvent);
    Diagnostics.clearContext('api_call');
  }

  private addNonExposedChecksEvent() {
    if (Object.keys(this.nonExposedChecks).length === 0) {
      return;
    }

    const event = new LogEvent(NON_EXPOSED_CHECKS_EVENT);
    event.setMetadata({
      checks: { ...this.nonExposedChecks },
    });
    this.queue.push(event);
    this.nonExposedChecks = {};
  }
}

import LogEvent from './LogEvent';
import { IHasStatsigInternal } from './StatsigClient';
import { StatsigEndpoint } from './StatsigNetwork';
import { StatsigUser } from './StatsigUser';
import StatsigAsyncStorage from './utils/StatsigAsyncStorage';
import StatsigLocalStorage from './utils/StatsigLocalStorage';

const STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY =
  'STATSIG_LOCAL_STORAGE_LOGGING_REQUEST';

const INTERNAL_EVENT_PREFIX = 'statsig::';
const CONFIG_EXPOSURE_EVENT = INTERNAL_EVENT_PREFIX + 'config_exposure';
const LAYER_EXPOSURE_EVENT = INTERNAL_EVENT_PREFIX + 'layer_exposure';
const GATE_EXPOSURE_EVENT = INTERNAL_EVENT_PREFIX + 'gate_exposure';
const LOG_FAILURE_EVENT = INTERNAL_EVENT_PREFIX + 'log_event_failed';
const APP_ERROR_EVENT = INTERNAL_EVENT_PREFIX + 'app_error';
const APP_METRICS_EVENT = INTERNAL_EVENT_PREFIX + 'app_metrics';

type FailedLogEventBody = {
  events: object[];
  statsigMetadata: object;
  time: number;
};

const MS_RETRY_LOGS_CUTOFF = 5 * 24 * 60 * 60 * 1000;
const MAX_BATCHES_TO_RETRY = 100;
const MAX_FAILED_EVENTS = 1000;
const MAX_LOCAL_STORAGE_SIZE = 1024 * MAX_FAILED_EVENTS;

export default class StatsigLogger {
  private sdkInternal: IHasStatsigInternal;

  private queue: object[];

  private flushInterval: ReturnType<typeof setInterval> | null;
  private loggedErrors: Set<string>;
  private failedLogEvents: FailedLogEventBody[];
  private exposureDedupeKeys: Record<string, number>;
  private failedLogEventCount = 0;

  public constructor(sdkInternal: IHasStatsigInternal) {
    this.sdkInternal = sdkInternal;

    this.queue = [];
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
    }
    if (
      typeof document !== 'undefined' &&
      typeof document.addEventListener === 'function'
    ) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') {
          this.flush(true);
        }
      });
    }

    const me = this;
    this.flushInterval = setInterval(() => {
      me.flush();
    }, this.sdkInternal.getOptions().getLoggingIntervalMillis());
  }

  public log(event: LogEvent): void {
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
    } catch (_e) {}

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

  public logGateExposure(
    user: StatsigUser | null,
    gateName: string,
    gateValue: boolean,
    ruleID: string,
    secondaryExposures: Record<string, string>[],
  ) {
    const dedupeKey = gateName + String(gateValue) + ruleID;
    if (!this.shouldLogExposure(dedupeKey)) {
      return;
    }
    const gateExposure = new LogEvent(GATE_EXPOSURE_EVENT);
    gateExposure.setUser(user);
    gateExposure.setMetadata({
      gate: gateName,
      gateValue: String(gateValue),
      ruleID: ruleID,
    });
    gateExposure.setSecondaryExposures(secondaryExposures);
    this.log(gateExposure);
  }

  public logConfigExposure(
    user: StatsigUser | null,
    configName: string,
    ruleID: string,
    secondaryExposures: Record<string, string>[],
  ) {
    const dedupeKey = configName + ruleID;
    if (!this.shouldLogExposure(dedupeKey)) {
      return;
    }

    const configExposure = new LogEvent(CONFIG_EXPOSURE_EVENT);
    configExposure.setUser(user);
    configExposure.setMetadata({
      config: configName,
      ruleID: ruleID,
    });
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
  ) {
    const dedupeKey = [
      configName,
      ruleID,
      allocatedExperiment,
      parameterName,
      String(isExplicitParameter),
    ].join('|');

    if (!this.shouldLogExposure(dedupeKey)) {
      return;
    }

    const configExposure = new LogEvent(LAYER_EXPOSURE_EVENT);
    configExposure.setUser(user);
    configExposure.setMetadata({
      config: configName,
      ruleID: ruleID,
      allocatedExperiment,
      parameterName,
      isExplicitParameter: String(isExplicitParameter),
    });
    configExposure.setSecondaryExposures(secondaryExposures);
    this.log(configExposure);
  }

  public logAppError(
    user: StatsigUser | null,
    message: string,
    metadata: object,
  ) {
    const errorEvent = new LogEvent(APP_ERROR_EVENT);
    errorEvent.setUser(user);
    errorEvent.setValue(message);
    errorEvent.setMetadata(metadata);
    this.log(errorEvent);
  }

  public logAppMetrics(user: StatsigUser | null) {
    if (typeof window?.performance?.getEntriesByType !== 'function') {
      return;
    }
    const entries = window.performance.getEntriesByType('navigation');
    if (!entries || entries.length < 1) {
      return;
    }

    const navEntry = entries[0] as any;
    const metricsEvent = new LogEvent(APP_METRICS_EVENT);
    metricsEvent.setUser(user);
    metricsEvent.setValue(navEntry.name);
    metricsEvent.setMetadata({
      pageLoadTimeMs: navEntry.duration,
      domInteractiveMs: navEntry.domInteractive - navEntry.startTime,
      redirectCount: navEntry.redirectCount,
    });

    this.log(metricsEvent);
  }

  public flush(isClosing: boolean = false): void {
    if (this.queue.length === 0) {
      return;
    }
    if (isClosing && this.flushInterval != null) {
      clearInterval(this.flushInterval);
    }

    const oldQueue = this.queue;
    this.queue = [];
    if (
      isClosing &&
      !this.sdkInternal.getNetwork().supportsKeepalive() &&
      navigator &&
      navigator.sendBeacon
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

    const processor = this;
    this.sdkInternal
      .getNetwork()
      .postToEndpoint(
        StatsigEndpoint.Rgstr,
        {
          events: oldQueue,
          statsigMetadata: this.sdkInternal.getStatsigMetadata(),
        },
        3 /* retries */,
        1000 /* backoff */,
        isClosing /* useKeepalive */,
      )
      .then((response) => {
        if (!response.ok) {
          throw response;
        }
      })
      .catch((error) => {
        if (typeof error.text === 'function') {
          error.text().then((errorText: string) => {
            const logFailureEvent = new LogEvent(LOG_FAILURE_EVENT);
            logFailureEvent.setMetadata({
              error: `${error.status}: ${errorText}`,
            });
            logFailureEvent.setUser(processor.sdkInternal.getCurrentUser());
            processor.appendFailureLog(logFailureEvent, oldQueue);
          });
        } else {
          const logFailureEvent = new LogEvent(LOG_FAILURE_EVENT);
          logFailureEvent.setMetadata({
            error: error.message,
          });
          logFailureEvent.setUser(processor.sdkInternal.getCurrentUser());
          processor.appendFailureLog(logFailureEvent, oldQueue);
        }
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
          await processor.saveFailedRequests();
        }
      });
  }

  private async saveFailedRequests(): Promise<void> {
    if (this.failedLogEvents.length > 0) {
      const requestsCopy = JSON.stringify(this.failedLogEvents);
      if (requestsCopy.length > MAX_LOCAL_STORAGE_SIZE) {
        this.clearLocalStorageRequests();
        return;
      }
      if (StatsigAsyncStorage.asyncStorage) {
        await StatsigAsyncStorage.setItemAsync(
          STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY,
          requestsCopy,
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
    } catch (_e) {
    } finally {
      this.clearLocalStorageRequests();
    }

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
              throw Error(response.status);
            }
          })
          .catch((_e) => {
            if (fireAndForget) {
              return;
            }
            this.addFailedRequest(requestBody);
          });
      }
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
      );
    } else {
      StatsigLocalStorage.removeItem(STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY);
    }
  }

  private appendFailureLog(event: LogEvent, queue: object[]): void {
    if (this.loggedErrors.has(event.getName())) {
      return;
    }
    this.loggedErrors.add(event.getName());
    queue.push(event);

    this.failedLogEvents.push({
      events: queue,
      statsigMetadata: this.sdkInternal.getStatsigMetadata(),
      time: Date.now(),
    });

    this.saveFailedRequests();
  }
}

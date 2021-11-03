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
const GATE_EXPOSURE_EVENT = INTERNAL_EVENT_PREFIX + 'gate_exposure';
const LOG_FAILURE_EVENT = INTERNAL_EVENT_PREFIX + 'log_event_failed';

type FailedLogEventBody = {
  events: object[];
  statsigMetadata: object;
  time: number;
};

const MS_RETRY_LOGS_CUTOFF = 5 * 24 * 60 * 60 * 1000;

export default class StatsigLogger {
  private sdkInternal: IHasStatsigInternal;

  private queue: object[];

  private flushInterval: ReturnType<typeof setInterval> | null;
  private loggedErrors: Set<string>;
  private failedLogEvents: FailedLogEventBody[];

  public constructor(sdkInternal: IHasStatsigInternal) {
    this.sdkInternal = sdkInternal;

    this.queue = [];
    this.flushInterval = null;
    this.loggedErrors = new Set();

    this.failedLogEvents = [];
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

  public logGateExposure(
    user: StatsigUser | null,
    gateName: string,
    gateValue: boolean,
    ruleID: string,
    secondaryExposures: Record<string, string>[],
  ) {
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
    const configExposure = new LogEvent(CONFIG_EXPOSURE_EVENT);
    configExposure.setUser(user);
    configExposure.setMetadata({
      config: configName,
      ruleID: ruleID,
    });
    configExposure.setSecondaryExposures(secondaryExposures);
    this.log(configExposure);
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
          this.failedLogEvents.push({
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
        StatsigEndpoint.LogEvent,
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
        this.failedLogEvents.push({
          events: oldQueue,
          statsigMetadata: this.sdkInternal.getStatsigMetadata(),
          time: Date.now(),
        });

        processor.saveFailedRequests();

        if (typeof error.text === 'function') {
          error.text().then((errorText: string) => {
            const logFailureEvent = new LogEvent(LOG_FAILURE_EVENT);
            logFailureEvent.setMetadata({
              error: `${error.status}: ${errorText}`,
            });
            logFailureEvent.setUser(processor.sdkInternal.getCurrentUser());
            processor.logInternal(logFailureEvent);
          });
        } else {
          const logFailureEvent = new LogEvent(LOG_FAILURE_EVENT);
          logFailureEvent.setMetadata({
            error: error.message,
          });
          logFailureEvent.setUser(processor.sdkInternal.getCurrentUser());
          processor.logInternal(logFailureEvent);
        }
      })
      .finally(async () => {
        if (isClosing) {
          if (this.queue.length > 0) {
            this.failedLogEvents.push({
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
      return;
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
          .postToEndpoint(StatsigEndpoint.LogEvent, requestBody)
          .then((response) => {
            if (!response.ok) {
              throw Error(response.status);
            }
          })
          .catch((_e) => {
            if (requestBody.time > Date.now() - MS_RETRY_LOGS_CUTOFF) {
              this.failedLogEvents.push(requestBody);
            }
          });
      }
    }
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

  private logInternal(event: LogEvent): void {
    if (this.loggedErrors.has(event.getName())) {
      return;
    }
    this.loggedErrors.add(event.getName());
    this.log(event);
  }
}

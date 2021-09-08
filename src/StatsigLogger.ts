import LogEvent from './LogEvent';
import { IHasStatsigInternal } from './StatsigClient';
import { StatsigUser } from './StatsigUser';
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
};

export default class StatsigLogger {
  private sdkInternal: IHasStatsigInternal;

  private flushBatchSize: number = 10;
  private flushInterval: number = 10 * 1000;
  private maxEventQueueSize: number = 1000;

  private queue: object[];

  private flushTimer: ReturnType<typeof setTimeout> | null;
  private loggedErrors: Set<string>;
  private failedLogEvents: FailedLogEventBody[];

  public constructor(sdkInternal: IHasStatsigInternal) {
    this.sdkInternal = sdkInternal;

    this.queue = [];
    this.flushTimer = null;
    this.loggedErrors = new Set();

    this.failedLogEvents = [];

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
  }

  public log(event: LogEvent): void {
    if (
      !this.sdkInternal.getOptions().getDisableCurrentPageLogging() &&
      window != null &&
      window.location != null &&
      window.location.href != null
    ) {
      // https://stackoverflow.com/questions/6257463/how-to-get-the-url-without-any-parameters-in-javascript
      const parts = window.location.href.split(/[?#]/);
      if (parts?.length > 0) {
        event.addStatsigMetadata('currentPage', parts[0]);
      }
    }
    this.queue.push(event.toJsonObject());
    if (this.queue.length >= this.flushBatchSize) {
      this.flush();
    }
    this.resetFlushTimeout();
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

    const oldQueue = this.queue;
    this.queue = [];

    const processor = this;
    this.sdkInternal
      .getNetwork()
      .post('log_event', {
        events: oldQueue,
        statsigMetadata: this.sdkInternal.getStatsigMetadata(),
      })
      .then((response) => {
        if (!response.ok) {
          throw response;
        }
      })
      .catch((error) => {
        this.queue = oldQueue.concat(this.queue);

        if (this.queue.length >= this.maxEventQueueSize) {
          // Drop oldest events so that the queue has 10 less than
          // the max amount of events we allow
          this.queue = this.queue.slice(
            this.queue.length - this.maxEventQueueSize + 10,
          );
        } else if (this.queue.length >= this.flushBatchSize) {
          this.flushBatchSize = Math.min(
            this.queue.length + this.flushBatchSize,
            this.maxEventQueueSize,
          );
        }

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
      .finally(() => {
        if (isClosing) {
          if (this.queue.length > 0) {
            this.failedLogEvents.push({
              events: this.queue,
              statsigMetadata: this.sdkInternal.getStatsigMetadata(),
            });

            // on app background/window blur, save unsent events as a request and clean up the queue (in case app foregrounds)
            this.queue = [];
          }
          processor.saveFailedRequests();
        }
      });
  }

  private saveFailedRequests(): void {
    if (this.failedLogEvents.length > 0) {
      const requestsCopy = this.failedLogEvents;
      this.failedLogEvents = [];
      StatsigLocalStorage.setItem(
        STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY,
        JSON.stringify(requestsCopy),
      );
    }
  }

  public sendLocalStorageRequests(): void {
    const failedRequests = StatsigLocalStorage.getItem(
      STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY,
    );
    if (failedRequests == null) {
      return;
    }
    const requestBodies = JSON.parse(failedRequests);
    for (const requestBody of requestBodies) {
      if (
        requestBody != null &&
        requestBody.events &&
        Array.isArray(requestBody.events)
      ) {
        this.sdkInternal
          .getNetwork()
          .post('log_event', requestBody)
          .then((response) => {
            if (!response.ok) {
              throw Error(response.status);
            }
          })
          .catch((e) => {
            this.failedLogEvents.push(requestBody);
          });
      }
    }
  }

  private logInternal(event: LogEvent): void {
    if (this.loggedErrors.has(event.getName())) {
      return;
    }
    this.loggedErrors.add(event.getName());
    this.log(event);
  }

  private resetFlushTimeout(): void {
    if (this.flushTimer != null) {
      clearTimeout(this.flushTimer);
    }
    const me = this;
    this.flushTimer = setTimeout(() => {
      me.flush();
    }, this.flushInterval);
  }
}

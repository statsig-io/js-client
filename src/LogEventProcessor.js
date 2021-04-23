import fetcher from './utils/StatsigFetcher';
import LogEvent from './LogEvent';
import storage from './utils/storage';

const STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY =
  'STATSIG_LOCAL_STORAGE_LOGGING_REQUEST';

const CONFIG_EXPOSURE_EVENT = 'statsig::config_exposure';
const GATE_EXPOSURE_EVENT = 'statsig::gate_exposure';
const INTERNAL_EVENT_PREFIX = 'statsig::';

export default function LogEventProcessor(identity, options, sdkKey) {
  const processor = {};
  let flushBatchSize = 10;
  let flushInterval = 10 * 1000;
  // The max size of event queue until we start trim older events
  let maxEventQueueSize = 1000;
  let requestURL = options.api + '/log_event';
  let disableCurrentPageLogging = options.disableCurrentPageLogging;

  let queue = [];
  let flushTimer = null;
  let loggedErrors = new Set();
  let failedLoggingRequests = [];
  let exposures = {
    configs: {},
    gates: {},
  };

  if (
    typeof window !== 'undefined' &&
    typeof window.addEventListener === 'function'
  ) {
    window.addEventListener('blur', () => processor.flush(true));
    window.addEventListener('beforeunload', () => processor.flush(true));
  }
  if (
    typeof document !== 'undefined' &&
    typeof document.addEventListener === 'function'
  ) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') {
        processor.flush(true);
      }
    });
  }

  processor.setFlushInterval = function (interval) {
    flushInterval = interval;
  };

  processor.setFlushBatchSize = function (size) {
    flushBatchSize = size;
    if (queue.length > flushBatchSize) {
      this.flush();
    }
  };

  processor.setMaxEventQueueSize = function (size) {
    maxEventQueueSize = size;
  };

  processor.log = function (event, errorKey = null) {
    if (!(event instanceof LogEvent)) {
      return;
    }

    if (!event.validate()) {
      return;
    }

    if (errorKey != null) {
      if (loggedErrors.has(errorKey)) {
        return;
      }
      loggedErrors.add(errorKey);
    }

    queue.push(event);
    // flush every N events
    if (queue.length >= flushBatchSize) {
      processor.flush();
    }

    resetFlushTimeout();
  };

  processor.flush = function (shutdown = false) {
    if (queue.length === 0) {
      if (shutdown) {
        processor.saveFailedRequests();
      }
      return;
    }
    const oldQueue = queue;
    queue = [];

    fetcher
      .post(requestURL, sdkKey, {
        statsigMetadata: identity.getStatsigMetadata(),
        events: oldQueue,
      })
      .then((response) => {
        if (!response.ok) {
          throw Error(response.status);
        }
      })
      .catch((e) => {
        queue = oldQueue.concat(queue);
        if (queue.length >= flushBatchSize) {
          flushBatchSize = Math.min(
            queue.length + flushBatchSize,
            maxEventQueueSize,
          );
        }
        if (queue.length > maxEventQueueSize) {
          // Drop oldest events so that the queue has 10 less than the max amount of events we allow
          queue = queue.slice(queue.length - maxEventQueueSize + 10);
        }
        this.logInternal(identity.getUser(), 'log_event_failed', null, {
          error: e.message,
        });
      })
      .finally(() => {
        if (shutdown) {
          if (queue.length > 0) {
            let requestBody = {
              statsigMetadata: identity.getStatsigMetadata(),
              events: queue,
            };

            // on app background/window blur, save unsent events as a request and clean up the queue (in case app foregrounds)
            failedLoggingRequests.push(requestBody);
            queue = [];
          }

          processor.saveFailedRequests();
        } else {
          resetFlushTimeout();
        }
      });
  };

  processor.saveFailedRequests = function () {
    if (failedLoggingRequests.length > 0) {
      const requestsCopy = failedLoggingRequests;
      failedLoggingRequests = [];
      storage
        .setItemAsync(
          STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY,
          JSON.stringify(requestsCopy),
        )
        .catch(() => {});
    }
  };

  processor.switchUser = function () {
    processor.flush(true);
    exposures = {
      configs: {},
      gates: {},
    };
  };

  processor.logGateExposure = function (user, gateName, gateValue) {
    if (exposures.configs[gateName]) {
      return;
    }
    exposures.configs[gateName] = true;
    this.logCustom(user, GATE_EXPOSURE_EVENT, null, {
      gate: gateName,
      gateValue: gateValue,
    });
  };

  processor.logConfigExposure = function (user, configName, groupName) {
    if (exposures.configs[configName]) {
      return;
    }
    exposures.configs[configName] = true;
    this.logCustom(user, CONFIG_EXPOSURE_EVENT, null, {
      config: configName,
      configGroup: groupName,
    });
  };

  processor.logInternal = function (
    user,
    eventName,
    value = null,
    metadata = {},
  ) {
    let event = new LogEvent(INTERNAL_EVENT_PREFIX + eventName, true);
    event.setValue(value);
    if (metadata == null) {
      metadata = {};
    }
    event.setMetadata(metadata);
    event.setUser(user);
    if (metadata.error != null) {
      this.log(event, eventName + metadata.error);
    } else {
      this.log(event);
    }
  };

  processor.logCustom = function (
    user,
    eventName,
    value = null,
    metadata = {},
  ) {
    let event = new LogEvent(eventName, disableCurrentPageLogging);
    event.setValue(value);
    event.setMetadata(metadata);
    event.setUser(user);
    this.log(event);
  };

  processor.sendLocalStorageRequests = function () {
    storage
      .getItemAsync(STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY)
      .then((requestsJSON) => {
        if (requestsJSON) {
          let requests = JSON.parse(requestsJSON);
          for (const requestBody of requests) {
            if (isRequestObjectValid(requestBody)) {
              fetcher
                .post(requestURL, sdkKey, requestBody)
                .then((response) => {
                  if (!response.ok) {
                    throw Error(response.status);
                  }
                })
                .catch((e) => {
                  failedLoggingRequests.push(requestBody);
                });
            }
          }
        }
      })
      .catch((e) => {
        this.logInternal(
          identity.getUser(),
          'get_local_storage_requests_failed',
          null,
          {
            error: e.message,
          },
        );
      })
      .finally(() => {
        storage.removeItemAsync(STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY);
      });
  };

  function resetFlushTimeout() {
    if (flushTimer != null) {
      clearTimeout(flushTimer);
    }

    flushTimer = setTimeout(function () {
      processor.flush();
    }, flushInterval);
  }

  function isRequestObjectValid(request) {
    if (request == null || typeof request !== 'object') {
      return false;
    }
    return request.events != null && Array.isArray(request.events);
  }

  return processor;
}

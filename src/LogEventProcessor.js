import fetcher from './utils/StatsigFetcher';
import LogEvent from './LogEvent';
import { logStatsigInternal } from './utils/logging';
import storage from './utils/storage';

const STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY =
  'STATSIG_LOCAL_STORAGE_LOGGING_REQUEST';

export default function LogEventProcessor(identity, options, sdkKey) {
  const processor = {};
  let flushBatchSize = 10;
  let flushInterval = 10 * 1000;
  // The max size of event queue until we start trim older events
  let maxEventQueueSize = 1000;
  let requestURL = options.api + '/log_event';

  let queue = [];
  let flushTimer = null;
  let loggedErrors = new Set();
  let failedLoggingRequests = [];

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
        logStatsigInternal(this, identity.getUser(), 'log_event_failed', null, {
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
      storage
        .setItemAsync(
          STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY,
          JSON.stringify(failedLoggingRequests),
        )
        .then(() => {
          // clean up requests after saving into local storage
          failedLoggingRequests = [];
        })
        .catch();
    }
  };

  processor.switchUser = function () {
    processor.flush(true);
  };

  processor.sendLocalStorageRequests = function () {
    storage
      .getItemAsync(STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY)
      .then((requestsJSON) => {
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
      })
      .catch((e) => {
        logStatsigInternal(
          this,
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

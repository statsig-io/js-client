import fetcher from './utils/StatsigFetcher';
import LogEvent from './LogEvent';
import { logStatsigInternal } from './utils/logging';

export default function LogEventProcessor(identity, options, sdkKey) {
  const processor = {};
  let flushBatchSize = 10;
  let flushInterval = 10 * 1000;
  // The max size of event queue until we start trim older events
  let maxEventQueueSize = 1000;

  let queue = [];
  let flushTimer = null;
  let loggedErrors = new Set();

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
    // window is often undefined, so we check whenever an event is logged until it's defined.
    // Also we do not want to override predefined onblur function by developers so check for null here.
    if (typeof window !== 'undefined' && window.onblur == null) {
      window.onblur = function () {
        processor.flush();
      };
    }
    // flush every N events
    if (queue.length >= flushBatchSize) {
      processor.flush();
    }

    resetFlushTimeout();
  };

  processor.flush = function () {
    if (queue.length === 0) {
      return;
    }
    const oldQueue = queue;
    queue = [];

    fetcher
      .post(options.api + '/log_event', {
        sdkKey: sdkKey,
        user: identity.getUser(),
        statsigMetadata: identity.getStatsigMetadata(),
        events: oldQueue,
      })
      .then((response) => {
        if (!response.ok) {
          throw Error(response.statusText);
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
        logStatsigInternal(this, 'log_event_failed', null, {
          error: e.message,
        });
      })
      .finally(() => {
        resetFlushTimeout();
      });
  };

  processor.switchUser = function () {
    processor.flush();
  };

  function resetFlushTimeout() {
    if (flushTimer != null) {
      clearTimeout(flushTimer);
    }

    flushTimer = setTimeout(function () {
      processor.flush();
    }, flushInterval);
  }

  return processor;
}

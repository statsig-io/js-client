import { logStatsigInternal } from './src/utils/logging';
import { fallbackConfig } from './src/utils/defaults';
import fetcher from './src/utils/StatsigFetcher';
import Identity from './src/Identity';
import InternalStore from './src/InternalStore';
import { getNumericValue } from './src/utils/core';
import LogEvent from './src/LogEvent';
import LogEventProcessor from './src/LogEventProcessor';
import StatsigOptions from './src/StatsigOptions';
import 'whatwg-fetch';
import DynamicConfig from './src/DynamicConfig';

const typedefs = require('./src/typedefs');

const MAX_VALUE_SIZE = 64;
const MAX_OBJ_SIZE = 1024;

/**
 * The global statsig class for interacting with gates, configs, experiments configured in the statsig developer console.  Also used for event logging to view in the statsig console, or for analyzing experiment impacts using pulse.
 */
const statsig = {
  /**
   * Initializes the statsig SDK.  This must be called and complete before checking gates/configs or logging.
   * @param {string} sdkKey - a SDK key, generated from the statsig developer console
   * @param {typedefs.StatsigUser} [user={}] - an object containing user attributes.  Pass a stable identifier as the key when possible, and any other attributes you have (ip, country, etc.) in order to use advanced gate conditions
   * @param {typedefs.StatsigOptions} [options={}] - manual sdk configuration for advanced setup
   * @returns {Promise<boolean>} - a promise which *always resolves*.  The return value will specify success or failure of the initialization call.
   */
  initialize: function (sdkKey, user = {}, options = {}) {
    if (statsig._ready != null) {
      return Promise.resolve(false);
    }
    if (!sdkKey) {
      return Promise.resolve(false);
    }
    statsig._ready = false;
    statsig._identity = Identity(trimUserObjIfNeeded(user));
    statsig._sdkKey = sdkKey;
    statsig._options = StatsigOptions(options);
    statsig._logger = LogEventProcessor(
      statsig._identity,
      statsig._options,
      sdkKey,
    );
    statsig._store = InternalStore(statsig._identity, statsig._logger);

    return this._fetchValues()
      .then(() => {
        return Promise.resolve(true);
      })
      .catch((e) => {
        console.error(e);
        return Promise.resolve(false);
      })
      .finally(() => {
        statsig._ready = true;
      });
  },

  /**
   * Checks the value of a gate for the current user
   * @param {string} gateName - the name of the gate to check
   * @returns {boolean} - value of a gate for the user. Gates are "off" (return false) by default
   */
  checkGate: function (gateName) {
    if (statsig._store == null) {
      console.warn(
        'Call and wait for initialize() to finish first. Returning false as the default value.',
      );
      return false;
    }
    return statsig._store.checkGate(gateName);
  },

  /**
   * Checks the value of a config for the current user
   * @param {string} configName - the name of the config to get
   * @returns {DynamicConfig} - value of a config for the user
   */
  getConfig: function (configName) {
    if (statsig._store == null) {
      console.warn(
        'Call and wait for initialize() to finish first. Returning a dummy config with only default values.',
      );
      return fallbackConfig();
    }
    return statsig._store.getConfig(configName);
  },

  /**
   * Log an event for data analysis and alerting or to measure the impact of an experiment
   * @param {string} eventName - the name of the event (eventName = 'Purchase')
   * @param {?string|number} [value=null] - the value associated with the event (value = 10)
   * @param {?object} [metadata=null] - other attributes associated with this event (metadata = {items: 2, currency: USD})
   * @returns {void}
   */
  logEvent: function (eventName, value = null, metadata = null) {
    if (statsig._logger == null) {
      console.error(
        'Event not logged. Call and wait for initialize() before logging',
      );
      return;
    }
    if (eventName == null) {
      console.error('Event not logged. eventName is null.');
      return;
    }
    if (shouldTrimParam(eventName, MAX_VALUE_SIZE)) {
      console.warn(
        'eventName is too long, trimming to ' + MAX_VALUE_SIZE + '.',
      );
      eventName = eventName.substring(0, MAX_VALUE_SIZE);
    }
    if (typeof value === 'string' && shouldTrimParam(value, MAX_VALUE_SIZE)) {
      console.warn('value is too long, trimming to ' + MAX_VALUE_SIZE + '.');
      value = value.substring(0, MAX_VALUE_SIZE);
    }

    if (shouldTrimParam(metadata, MAX_OBJ_SIZE)) {
      console.warn('metadata is too big. Dropping the metadata.');
      metadata = { error: 'not logged due to size too large' };
    }

    let event = new LogEvent(eventName);
    event.setValue(value);
    event.setMetadata(metadata);
    statsig._logger.log(event);
  },

  /**
   * Switches the user associated with calls to fetch gates/configs from statsig. This client SDK is intended for single user environments, but its possible a user was unknown previously and then logged in, or logged out and switched to a different account.  Use this function to update the gates/configs and associate event logs with the new user.
   * @param {typedefs.StatsigUser} newUser - a set of user attributes identifying the new user
   * @returns {Promise<boolean>} - a promise which *always resolves* to a value which indicates success or failure
   */
  switchUser: function (newUser) {
    if (statsig._identity == null || !statsig._ready) {
      return Promise.resolve(false);
    }
    statsig._ready = false;
    newUser = trimUserObjIfNeeded(newUser);
    const isNewUser = statsig._identity.setUser(newUser);
    if (!isNewUser) {
      statsig._ready = true;
      return Promise.resolve(true);
    }
    statsig._logger.switchUser();
    return statsig
      ._fetchValues()
      .then(() => {
        return Promise.resolve(true);
      })
      .catch(() => {
        return Promise.resolve(false);
      })
      .finally(() => {
        statsig._ready = true;
      });
  },

  /**
   * Checks to see if the SDK is in a ready state to check gates and configs
   * If the SDK is initializing, or switching users, it is not in a ready state.
   * @returns {boolean} if the SDK is ready
   */
  isReady: function () {
    return statsig._ready === true;
  },

  /**
   * Informs the statsig SDK that the client is closing or shutting down
   * so the SDK can clean up internal state
   */
  shutdown: function () {
    if (statsig._logger == null) {
      return;
    }
    statsig._logger.flush();
  },

  /**
   * @ignore
   * Configure internal settings related to logging, callback, retries and etc. Use default
   * @param {object} sdkParams - a set of configuration overwrites received from Statsig backend
   */
  _configure: function (sdkParams) {
    // Defaults
    statsig.pollingDelay = 3 * 1000;
    statsig.maxPollingDelay = 3 * 60 * 1000;

    const pollingDelay = getNumericValue(sdkParams?.pollingDelay);
    if (pollingDelay != null) {
      statsig.pollingDelay = pollingDelay;
    }

    const maxPollingDelay = getNumericValue(sdkParams?.maxPollingDelay);
    if (maxPollingDelay != null) {
      statsig.maxPollingDelay = maxPollingDelay;
    }

    // logger options
    if (statsig._logger != null) {
      const flushInterval = getNumericValue(sdkParams?.flushInterval);
      if (flushInterval != null) {
        statsig._logger.setFlushInterval(flushInterval);
      }

      const flushBatchSize = getNumericValue(sdkParams?.flushBatchSize);
      if (flushInterval != null) {
        statsig._logger.setFlushBatchSize(flushBatchSize);
      }

      const maxEventQueueSize = getNumericValue(sdkParams?.maxEventQueueSize);
      if (maxEventQueueSize != null) {
        statsig._logger.setMaxEventQueueSize(maxEventQueueSize);
      }
    }
  },

  /**
   * @ignore
   * @param {?function} resolveCallback - optional, the callback to be executed once response comes back
   * from the API endpoint, potentially after retries.
   * @param {?function} rejectCallback - optional, the callback to be executed once the fetch request
   * eventually fails, potentially after retries.
   * @returns {Promise<void>}
   */
  _fetchValues: function (resolveCallback = null, rejectCallback = null) {
    const url = new URL(statsig._options.api + '/initialize');
    return fetcher.postWithTimeout(
      url.toString(),
      {
        sdkKey: statsig._sdkKey,
        user: statsig._identity.getUser(),
        statsigMetadata: statsig._identity.getStatsigMetadata(),
      },
      (res) => {
        if (res.ok) {
          res.json().then((json) => {
            statsig._store.save(json.gates, json.configs);
            statsig._configure(json.sdkParams);
          });
        }
        if (typeof resolveCallback === 'function') {
          resolveCallback(res);
        }
      },
      (e) => {
        logStatsigInternal(statsig._logger, 'fetch_values_failed', null, {
          error: e.message,
        });
        if (typeof rejectCallback === 'function') {
          rejectCallback(e);
        }
      },
      3000, // timeout for early return
      10, // retires
    );
  },

  /**
   * @ignore
   * @param {function} subscribeCallback
   * @returns {Promise<void>}
   */
  _subscribeToChange: function (subscribeCallback) {
    const url = new URL(statsig._options.api + '/subscribe');
    const params = {
      sdkKey: statsig._sdkKey,
      user: JSON.stringify(statsig._identity.getUser()),
      statsigMetadata: JSON.stringify(statsig._identity.getStatsigMetadata()),
    };
    url.search = new URLSearchParams(params).toString();

    return fetch(url.toString())
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('' + response.status);
      })
      .then((responseJSON) => {
        if (responseJSON == null || !responseJSON.shouldInvalidateCache) {
          return this._subscribeToChange(subscribeCallback);
        }
        return this._fetchValues(() => {
          subscribeCallback();
        }).finally(function () {
          return statsig._subscribeToChange(subscribeCallback);
        });
      })
      .catch((e) => {
        setTimeout(function () {
          // Retry on error while backing out on delays to avoid too many retries.
          statsig.pollingDelay = Math.min(
            statsig.pollingDelay * 2,
            statsig.pollingDelay,
          );
          return statsig._subscribeToChange(subscribeCallback);
        }, statsig.pollingDelay);
      });
  },
};

function shouldTrimParam(obj, size) {
  if (obj == null) return false;
  if (typeof obj === 'string') return obj.length > size;
  if (typeof obj === 'object') {
    return JSON.stringify(obj).length > size;
  }
  if (typeof obj === 'number') return obj.toString().length > size;
  return false;
}

function trimUserObjIfNeeded(user) {
  if (user == null) {
    return null;
  }
  if (shouldTrimParam(user.userID, MAX_VALUE_SIZE)) {
    console.warn('User ID is too large, trimming to ' + MAX_VALUE_SIZE);
    user.userID = user.userID.toString().substring(0, MAX_VALUE_SIZE);
  }
  if (shouldTrimParam(user, MAX_OBJ_SIZE)) {
    user.custom = {};
    if (shouldTrimParam(user, MAX_OBJ_SIZE)) {
      console.warn('User object is too large, only keeping the user ID.');
      user = { userID: user.userID };
    } else {
      console.warn('User object is too large, dropping the custom property.');
    }
  }
  return user;
}

export default statsig;

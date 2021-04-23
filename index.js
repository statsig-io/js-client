import fetcher from './src/utils/StatsigFetcher';
import Identity from './src/Identity';
import InternalStore from './src/InternalStore';
import { getNumericValue } from './src/utils/core';
import LogEvent from './src/LogEvent';
import LogEventProcessor from './src/LogEventProcessor';
import StatsigOptions from './src/StatsigOptions';
import DynamicConfig from './src/DynamicConfig';
import localStorage from './src/utils/storage';

const typedefs = require('./src/typedefs');

const MAX_VALUE_SIZE = 64;
const MAX_OBJ_SIZE = 1024;

// for react native
let _currentAppState;

let _SDKPackageInfo;
let _AsyncStorage;
let _AppState;
let _NativeModules;
let _Platform;

// for expo
let _ExpoConstants;
let _ExpoDevice;

// for vanilla react native
let _RNDeviceInfo;

/**
 * The global statsig class for interacting with gates, configs, experiments configured in the statsig developer console.  Also used for event logging to view in the statsig console, or for analyzing experiment impacts using pulse.
 */
const statsig = {
  /**
   * Initializes the statsig SDK.  This must be called and complete before checking gates/configs or logging.
   * @param {string} sdkKey - a SDK key, generated from the statsig developer console
   * @param {typedefs.StatsigUser} [user={}] - an object containing user attributes.  Pass a stable identifier as the key when possible, and any other attributes you have (ip, country, etc.) in order to use advanced gate conditions
   * @param {typedefs.StatsigOptions} [options={}] - manual sdk configuration for advanced setup
   * @returns {Promise<void>} - a promise which rejects only if you fail to provide a proper SDK Key
   * @throws Error if an invalid SDK Key is provided
   */
  initialize: function (sdkKey, user = {}, options = {}) {
    if (statsig._ready != null) {
      return Promise.resolve();
    }
    if (
      typeof sdkKey !== 'string' ||
      sdkKey.length === 0 ||
      (!sdkKey.startsWith('client-') && !sdkKey.startsWith('test-'))
    ) {
      return Promise.reject(
        new Error(
          'Invalid key provided.  You must use a Client or Test SDK Key from the Statsig console with the js-client-sdk',
        ),
      );
    }

    statsig._ready = false;
    statsig._sdkKey = sdkKey;
    statsig._options = StatsigOptions(options);
    statsig._identity = Identity(
      trimUserObjIfNeeded(user),
      _SDKPackageInfo,
      _NativeModules,
      _Platform,
      _RNDeviceInfo,
      _ExpoConstants,
      _ExpoDevice,
    );
    localStorage.init(_AsyncStorage);

    return statsig._identity.setStableIDAsync().finally(() => {
      statsig._logger = LogEventProcessor(
        statsig._identity,
        statsig._options,
        sdkKey,
      );

      if (_AppState && typeof _AppState.addEventListener === 'function') {
        _currentAppState = _AppState.currentState;
        _AppState.addEventListener('change', statsig._handleAppStateChange);
      }
      statsig._store = InternalStore(statsig._identity, statsig._logger);
      return statsig._store.loadFromLocalStorage().finally(() => {
        return this._fetchValues()
          .catch((e) => {
            console.error(e);
            return Promise.resolve();
          })
          .finally(() => {
            statsig._ready = true;
            statsig._logger.sendLocalStorageRequests();
          });
      });
    });
  },

  /**
   * Checks the value of a gate for the current user
   * @param {string} gateName - the name of the gate to check
   * @returns {boolean} - value of a gate for the user. Gates are "off" (return false) by default
   * @throws Error if gateName is not a string
   */
  checkGate: function (gateName) {
    if (statsig._store == null) {
      console.error(
        'Call and wait for initialize() to finish first. Returning false as the default value.',
      );
      return false;
    }
    if (typeof gateName !== 'string') {
      throw new Error('Must pass a valid string as a gateName to check');
    }
    return statsig._store.checkGate(gateName);
  },

  /**
   * Checks the value of a config for the current user
   * @param {string} configName - the name of the config to get
   * @returns {DynamicConfig | null} - value of a config for the user
   * @throws Error if configName is not a string
   */
  getConfig: function (configName) {
    if (statsig._store == null) {
      console.warn(
        'Call and wait for initialize() to finish first. Returning a dummy config with only default values.',
      );
      return null;
    }
    if (typeof configName !== 'string') {
      throw new Error('Must pass a valid string as a configName to check');
    }
    return statsig._store.getConfig(configName);
  },

  /**
   * Log an event for data analysis and alerting or to measure the impact of an experiment
   * @param {string} eventName - the name of the event (eventName = 'Purchase')
   * @param {?string|number} [value=null] - the value associated with the event (value = 10)
   * @param {?Record<string, string>} [metadata=null] - other attributes associated with this event (metadata = {item_name: 'banana', currency: 'USD'})
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
    event.setUser(statsig._identity.getUser());

    if (
      window != null &&
      window.location != null &&
      window.location.href != null
    ) {
      // https://stackoverflow.com/questions/6257463/how-to-get-the-url-without-any-parameters-in-javascript
      const parts = window.location.href.split(/[?#]/);
      if (parts.length > 0) {
        event.addStatsigMetadata('currentPage', parts[0]);
      }
    }

    statsig._logger.log(event);
  },

  /**
   * Updates the user associated with calls to fetch gates/configs from statsig. This client SDK is intended for single user environments, but its possible a user was unknown previously and then logged in, or logged out and switched to a different account.  Use this function to update the gates/configs and associate event logs with the user.
   * @param {typedefs.StatsigUser} updatedUser - a set of user attributes identifying the user
   * @returns {Promise<boolean>} - a promise which *always resolves* to a value which indicates success or failure
   */
  updateUser: function (updatedUser) {
    if (statsig._identity == null || !statsig._ready) {
      return Promise.resolve(false);
    }
    statsig._ready = false;
    updatedUser = trimUserObjIfNeeded(updatedUser);
    statsig._identity.setUser(updatedUser);
    statsig._logger.switchUser();
    return statsig
      ._fetchValues()
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
    statsig._logger?.flush(true);
    if (_AppState && typeof _AppState.removeEventListener === 'function') {
      _AppState.removeEventListener('change', this._handleAppStateChange);
    }
  },

  _setReactNativeDependencies: function (
    SDKPackageInfo,
    AsyncStorage = null,
    AppState = null,
    NativeModules = null,
    Platform = null,
    RNDeviceInfo = null,
    ExpoConstants = null,
    ExpoDevice = null,
  ) {
    _SDKPackageInfo = SDKPackageInfo;
    _AsyncStorage = AsyncStorage;
    _AppState = AppState;
    _NativeModules = NativeModules;
    _Platform = Platform;
    _RNDeviceInfo = RNDeviceInfo;
    _ExpoConstants = ExpoConstants;
    _ExpoDevice = ExpoDevice;
  },

  _handleAppStateChange: function (nextAppState) {
    if (
      _currentAppState === 'active' &&
      nextAppState.match(/inactive|background/)
    ) {
      statsig._logger?.flush(true);
    } else if (
      _currentAppState.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      statsig._logger?.sendLocalStorageRequests();
    }
    _currentAppState = nextAppState;
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
    return fetcher.postWithTimeout(
      statsig._options.api + '/initialize',
      statsig._sdkKey,
      {
        user: statsig._identity.getUser(),
        statsigMetadata: statsig._identity.getStatsigMetadata(),
      },
      (resJSON) => {
        statsig._store.save(resJSON.gates, resJSON.configs);
        statsig._configure(resJSON.sdkParams);
        if (typeof resolveCallback === 'function') {
          resolveCallback(resJSON);
        }
      },
      (e) => {
        statsig._logger.logInternal(
          statsig._identity.getUser(),
          'fetch_values_failed',
          null,
          {
            error: e.message,
          },
        );
        if (typeof rejectCallback === 'function') {
          rejectCallback(e);
        }
      },
      3000, // timeout for early return
      10, // retries
    );
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

import { Base64 } from './utils/Base64';
import DynamicConfig from './DynamicConfig';
import localStorage from './utils/storage';
import { sha256 } from 'js-sha256';

const INTERNAL_STORE_KEY = 'STATSIG_LOCAL_STORAGE_INTERNAL_STORE';

/**
 *
 * @param {*} identity
 * @param {*} logger
 * @returns
 */
export default function InternalStore(identity, logger) {
  let store = {};
  store.cache = {};

  function parseConfigs(configs) {
    if (typeof configs !== 'object' || configs == null) {
      return {};
    }
    let parsed = {};
    for (const configName in configs) {
      if (configName && configs[configName]) {
        parsed[configName] = new DynamicConfig(
          configName,
          configs[configName].value,
          configs[configName].rule,
        );
      }
    }
    return parsed;
  }

  store.loadFromLocalStorage = function () {
    return localStorage
      .getItemAsync(INTERNAL_STORE_KEY)
      .then((data) => {
        if (data) {
          try {
            let jsonCache = JSON.parse(data);
            if (jsonCache != null) {
              for (const [user, data] of Object.entries(jsonCache)) {
                store.cache[user] = {
                  gates: data.featureGates,
                  configs: {},
                };
                if (data.configs != null) {
                  for (const [configName, configData] of Object.entries(
                    data.configs,
                  )) {
                    store.cache[user].configs[configName] = new DynamicConfig(
                      configData.name,
                      configData.value,
                      configData._ruleID,
                    );
                  }
                }
              }
            }
          } catch (e) {
            // Cached value corrupted, remove cache
            localStorage.removeItemAsync(INTERNAL_STORE_KEY);
          }
        }
        return Promise.resolve();
      })
      .catch((e) => {
        // Never reject when local storage fails to load
        return Promise.resolve();
      });
  };

  store.save = function (gates, configs) {
    const userID = identity.getUserID();
    if (!userID) {
      console.error('Cannot save for user without a valid user ID');
      return;
    }
    // saves to in memory cache
    store.cache[userID] = {
      gates: gates ?? {},
      configs: parseConfigs(configs),
    };

    return localStorage
      .setItemAsync(INTERNAL_STORE_KEY, JSON.stringify(store.cache))
      .catch(() => {
        return Promise.resolve();
      });
  };

  store.checkGate = function (gateName) {
    if (typeof gateName !== 'string' || gateName.length === 0) {
      console.error(
        'gateName must be a valid string. Returning false as the default.',
      );
      return false;
    }

    let buffer = sha256.create().update(gateName).arrayBuffer();
    var gateNameHash = Base64.encodeArrayBuffer(buffer);
    const userID = identity.getUserID();
    let gateValue = { value: false, rule: '' };
    if (userID && store.cache[userID]?.gates[gateNameHash]) {
      gateValue = store.cache[userID].gates[gateNameHash];
    }
    logger.logGateExposure(
      identity.getUser(),
      gateName,
      gateValue.value === true,
      gateValue.rule,
    );
    return gateValue.value === true;
  };

  store.getConfig = function (configName) {
    if (typeof configName !== 'string' || configName.length === 0) {
      console.error(
        'configName must be a valid string. The config will only return default values.',
      );
      return null;
    }

    let buffer = sha256.create().update(configName).arrayBuffer();
    var configNameHash = Base64.encodeArrayBuffer(buffer);
    const userID = identity.getUserID();
    let value = null;
    if (userID && store.cache[userID]?.configs[configNameHash]) {
      value = store.cache[userID].configs[configNameHash];
      logger.logConfigExposure(
        identity.getUser(),
        configName,
        value.getRuleID(),
      );
    }
    return value;
  };

  return store;
}

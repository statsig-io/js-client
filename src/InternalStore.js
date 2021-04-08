import sha256 from 'crypto-js/sha256';
import Base64 from 'crypto-js/enc-base64';
import { logConfigExposure, logGateExposure } from './utils/logging';
import localStorage from './utils/storage';
import { fallbackConfig } from './utils/defaults';
import DynamicConfig from './DynamicConfig';

const INTERNAL_STORE_KEY = 'STATSIG_LOCAL_STORAGE_INTERNAL_STORE';

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
          configs[configName].group,
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
                  gates: data.gates,
                  configs: {},
                };
                if (data.configs != null) {
                  for (const [configName, configData] of Object.entries(
                    data.configs,
                  )) {
                    store.cache[user].configs[configName] = new DynamicConfig(
                      configData.name,
                      configData.value,
                      configData._groupName,
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
    let hash = sha256(gateName);
    let gateNameHash = Base64.stringify(hash);
    const userID = identity.getUserID();
    let value = false;
    if (userID && store.cache[userID]?.gates[gateNameHash]) {
      value = store.cache[userID].gates[gateNameHash];
    }
    logGateExposure(logger, identity.getUser(), gateName, value);
    return value;
  };

  store.getConfig = function (configName) {
    if (typeof configName !== 'string' || configName.length === 0) {
      console.error(
        'configName must be a valid string. The config will only return default values.',
      );
      return fallbackConfig();
    }
    let hash = sha256(configName);
    let configNameHash = Base64.stringify(hash);
    const userID = identity.getUserID();
    let value = fallbackConfig();
    if (userID && store.cache[userID]?.configs[configNameHash]) {
      value = store.cache[userID].configs[configNameHash];
      logConfigExposure(
        logger,
        identity.getUser(),
        configName,
        value.getGroupName(),
      );
    }
    return value;
  };

  return store;
}

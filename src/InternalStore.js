import sha256 from 'crypto-js/sha256';
import Base64 from 'crypto-js/enc-base64';
import { logConfigExposure, logGateExposure } from './utils/logging';
import { localGet, localSet, localRemove } from './utils/storage';
import { fallbackConfig } from './utils/defaults';
import DynamicConfig from './DynamicConfig';

export default function InternalStore(identity, logger) {
  let store = {};
  store.cache = {};
  const localStorageKey = 'STATSIG_LOCAL_STORE';
  let localCache = localGet(localStorageKey);
  if (localCache) {
    try {
      let jsonCache = JSON.parse(localCache);
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
      localRemove(localStorageKey);
    }
  }

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

  store.save = function (gates, configs) {
    const userID = identity.getUserID();
    if (!userID) {
      console.error('Cannot save for user without a valid user ID');
      return;
    }
    store.cache[userID] = {
      gates: gates ?? {},
      configs: parseConfigs(configs),
    };
    localSet(localStorageKey, JSON.stringify(store.cache));
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

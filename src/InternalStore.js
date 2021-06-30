import { Base64 } from './utils/Base64';
import DynamicConfig from './DynamicConfig';
import localStorage from './utils/storage';
import { sha256 } from 'js-sha256';

const INTERNAL_STORE_KEY = 'STATSIG_LOCAL_STORAGE_INTERNAL_STORE';
const OVERRIDE_STORE_KEY = 'STATSIG_LOCAL_STORAGE_INTERNAL_STORE_OVERRIDES';

function getHashValue(value) {
  let buffer = sha256.create().update(value).arrayBuffer();
  return Base64.encodeArrayBuffer(buffer);
}

/**
 *
 * @param {*} identity
 * @param {*} logger
 * @returns
 */
export default function InternalStore(identity, logger) {
  let store = {};
  store.cache = {};
  store.overrides = {};

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
          configs[configName].rule_id,
        );
      }
    }
    return parsed;
  }

  store.loadFromLocalStorage = function () {
    if (localStorage.canUseSyncAPI()) {
      const cacheData = localStorage.getNullableItem(INTERNAL_STORE_KEY);
      if (cacheData != null) {
        try {
          store._configureFromCachedData(cacheData);
        } catch (e) {
          localStorage.removeItem(INTERNAL_STORE_KEY);
        }
      }
    }
  };

  store.loadFromLocalStorageAsync = function () {
    const loadCache = localStorage
      .getItemAsync(INTERNAL_STORE_KEY)
      .then((data) => {
        if (data) {
          try {
            store._configureFromCachedData(data);
          } catch (e) {
            // Cached value corrupted, remove cache
            localStorage.removeItemAsync(INTERNAL_STORE_KEY);
          }
        }
        return Promise.resolve();
      });
    const loadOverrides = localStorage
      .getItemAsync(OVERRIDE_STORE_KEY)
      .then((data) => {
        if (data) {
          try {
            store.overrides = JSON.parse(data);
          } catch (e) {
            localStorage.removeItemAsync(OVERRIDE_STORE_KEY);
          }
        }
        return Promise.resolve();
      });

    return Promise.all([loadCache, loadOverrides]).catch((e) => {
      // don't reject when local storage fails to load
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

  store.removeOverride = function (name) {
    // delete all overrides if a name is not provided
    if (name == null) {
      store.overrides = {};
      localStorage.removeItemAsync(OVERRIDE_STORE_KEY);
    } else {
      delete store.overrides[name];
      localStorage.setItemAsync(
        OVERRIDE_STORE_KEY,
        JSON.stringify(store.overrides),
      );
    }
  };

  store.getOverrides = function () {
    return store.overrides;
  };

  store.overrideGate = function (gateName, value) {
    if (!this.hasGate(gateName)) {
      console.warn(
        'The provided gateName does not exist as a valid feature gate.',
      );
      return;
    }
    store.overrides[gateName] = value;
    localStorage.setItemAsync(
      OVERRIDE_STORE_KEY,
      JSON.stringify(store.overrides),
    );
  };

  store.hasGate = function (gateName) {
    var gateNameHash = getHashValue(gateName);
    return store?.cache?.[identity.getUserID()]?.gates?.[gateNameHash] != null;
  };

  store.checkGate = function (gateName) {
    if (typeof gateName !== 'string' || gateName.length === 0) {
      throw new Error('Must pass a valid string as the gateName.');
    }

    var gateNameHash = getHashValue(gateName);
    const userID = identity.getUserID();
    let gateValue = { value: false, rule_id: '' };
    if (store?.overrides[gateName] != null) {
      gateValue = {
        value: store?.overrides[gateName] === true,
        rule_id: 'override',
      };
    } else if (userID && store?.cache?.[userID]?.gates?.[gateNameHash]) {
      gateValue = store.cache[userID].gates[gateNameHash];
    }
    logger.logGateExposure(
      identity.getUser(),
      gateName,
      gateValue.value === true,
      gateValue.rule_id,
    );

    return gateValue.value === true;
  };

  store.getConfig = function (configName) {
    if (typeof configName !== 'string' || configName.length === 0) {
      throw new Error('Must pass a valid string as the configName.');
    }

    var configNameHash = getHashValue(configName);
    const userID = identity.getUserID();
    let value = new DynamicConfig(configName);
    if (userID && store?.cache?.[userID]?.configs?.[configNameHash]) {
      value = store.cache[userID].configs[configNameHash];
    }
    logger.logConfigExposure(identity.getUser(), configName, value.getRuleID());
    return value;
  };

  store._configureFromCachedData = function (data) {
    let jsonCache = JSON.parse(data);
    if (jsonCache != null) {
      for (const [user, data] of Object.entries(jsonCache)) {
        store.cache[user] = {
          gates: data.gates,
          configs: {},
        };
        if (data.configs != null) {
          for (const [configName, configData] of Object.entries(data.configs)) {
            store.cache[user].configs[configName] = new DynamicConfig(
              configData.name,
              configData.value,
              configData._ruleID,
            );
          }
        }
      }
    }
  };

  return store;
}

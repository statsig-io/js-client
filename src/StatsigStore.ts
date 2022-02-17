import { sha256 } from 'js-sha256';

import DynamicConfig from './DynamicConfig';
import { IHasStatsigInternal, StatsigOverrides } from './StatsigClient';
import { Base64 } from './utils/Base64';
import StatsigAsyncStorage from './utils/StatsigAsyncStorage';
import StatsigLocalStorage from './utils/StatsigLocalStorage';

function getHashValue(value: string) {
  let buffer = sha256.create().update(value).arrayBuffer();
  return Base64.encodeArrayBuffer(buffer);
}

type APIFeatureGate = {
  name: string;
  value: boolean;
  rule_id: string;
  secondary_exposures: [];
};

type APIDynamicConfig = {
  name: string;
  value: { [key: string]: unknown };
  rule_id: string;
  secondary_exposures: [];
  is_device_based?: boolean;
  is_user_in_experiment?: boolean;
  is_experiment_active?: boolean;
};

type APILayerConfig = {
  default_values: { [key: string]: unknown };
  allocated_experiment_name: string | null;
};

type APIInitializeData = {
  dynamic_configs: Record<string, APIDynamicConfig | undefined>;
  feature_gates: Record<string, APIFeatureGate | undefined>;
  layer_configs: Record<string, APILayerConfig | undefined>;
};

type UserCacheValues = {
  dynamic_configs: Record<string, APIDynamicConfig | undefined>;
  feature_gates: Record<string, APIFeatureGate | undefined>;
  sticky_experiments: Record<string, APIDynamicConfig | undefined>;
  layer_configs: Record<string, APILayerConfig | undefined>;
  time: number;
};

const OVERRIDES_STORE_KEY = 'STATSIG_LOCAL_STORAGE_INTERNAL_STORE_OVERRIDES_V3';
const STICKY_DEVICE_EXPERIMENTS_KEY =
  'STATSIG_LOCAL_STORAGE_STICKY_DEVICE_EXPERIMENTS';

// V4 change: values are now cached on a specific user ID. We store values for up to 10 different user IDs at a time.
const INTERNAL_STORE_KEY = 'STATSIG_LOCAL_STORAGE_INTERNAL_STORE_V4';

const MAX_USER_VALUE_CACHED = 10;

export default class StatsigStore {
  private sdkInternal: IHasStatsigInternal;

  private overrides: StatsigOverrides = {
    gates: {},
    configs: {},
  };

  private loaded: boolean;
  private values: Record<string, UserCacheValues | undefined>;
  private stickyDeviceExperiments: Record<string, APIDynamicConfig>;

  public constructor(sdkInternal: IHasStatsigInternal) {
    this.sdkInternal = sdkInternal;
    this.values = {};
    this.values[this.getCurrentUserCacheKey()] = {
      feature_gates: {},
      dynamic_configs: {},
      sticky_experiments: {},
      layer_configs: {},
      time: 0,
    };
    this.stickyDeviceExperiments = {};
    this.loaded = false;
    this.loadFromLocalStorage();
  }

  public async loadFromAsyncStorage(): Promise<void> {
    this.parseCachedValues(
      await StatsigAsyncStorage.getItemAsync(INTERNAL_STORE_KEY),
      await StatsigAsyncStorage.getItemAsync(STICKY_DEVICE_EXPERIMENTS_KEY),
    );
    this.loaded = true;
  }

  private loadFromLocalStorage(): void {
    if (StatsigAsyncStorage.asyncStorage) {
      return;
    }
    this.parseCachedValues(
      StatsigLocalStorage.getItem(INTERNAL_STORE_KEY),
      StatsigLocalStorage.getItem(STICKY_DEVICE_EXPERIMENTS_KEY),
    );
    this.loaded = true;
  }

  public isLoaded(): boolean {
    return this.loaded;
  }

  private parseCachedValues(
    allValues: string | null,
    deviceExperiments: string | null,
  ): void {
    try {
      this.values = allValues ? JSON.parse(allValues) : this.values;
    } catch (e) {
      // Cached value corrupted, remove cache
      this.removeFromStorage(INTERNAL_STORE_KEY);
    }

    try {
      const deviceExpParsed = deviceExperiments
        ? JSON.parse(deviceExperiments)
        : null;
      if (deviceExpParsed) {
        this.stickyDeviceExperiments = deviceExpParsed;
      }
    } catch (e) {
      this.removeFromStorage(STICKY_DEVICE_EXPERIMENTS_KEY);
    }

    this.loadOverrides();
  }

  private removeFromStorage(key: string) {
    StatsigAsyncStorage.removeItemAsync(key);
    StatsigLocalStorage.removeItem(key);
  }

  private loadOverrides(): void {
    const overrides = StatsigLocalStorage.getItem(OVERRIDES_STORE_KEY);
    if (overrides != null) {
      try {
        this.overrides = JSON.parse(overrides);
      } catch (e) {
        StatsigLocalStorage.removeItem(OVERRIDES_STORE_KEY);
      }
    }
  }

  public async save(
    userCacheKey: string,
    jsonConfigs: Record<string, any>,
  ): Promise<void> {
    this.values[userCacheKey] = {
      ...(jsonConfigs as APIInitializeData),
      sticky_experiments: this.values[userCacheKey]?.sticky_experiments ?? {},
      time: Date.now(),
    };
    if (Object.entries(this.values).length > MAX_USER_VALUE_CACHED) {
      let minTime = null;
      let minKey = null;
      for (const entry of Object.entries(this.values)) {
        if (entry[1] == null) {
          continue;
        }
        if (minTime == null || minTime > entry[1].time) {
          minTime = entry[1].time;
          minKey = entry[0];
        }
      }
      if (minKey) {
        delete this.values[minKey];
      }
    }
    if (StatsigAsyncStorage.asyncStorage) {
      await StatsigAsyncStorage.setItemAsync(
        INTERNAL_STORE_KEY,
        JSON.stringify(this.values),
      );
    } else {
      StatsigLocalStorage.setItem(
        INTERNAL_STORE_KEY,
        JSON.stringify(this.values),
      );
    }
  }

  public checkGate(
    gateName: string,
    ignoreOverrides: boolean = false,
  ): boolean {
    const gateNameHash = getHashValue(gateName);
    let gateValue = { value: false, rule_id: '', secondary_exposures: [] };
    if (!ignoreOverrides && this.overrides.gates[gateName] != null) {
      gateValue = {
        value: this.overrides.gates[gateName],
        rule_id: 'override',
        secondary_exposures: [],
      };
    } else {
      gateValue =
        this.values[this.getCurrentUserCacheKey()]?.feature_gates[
          gateNameHash
        ] ?? gateValue;
    }
    this.sdkInternal
      .getLogger()
      .logGateExposure(
        this.sdkInternal.getCurrentUser(),
        gateName,
        gateValue.value,
        gateValue.rule_id,
        gateValue.secondary_exposures,
      );
    return gateValue.value === true;
  }

  public getConfig(
    configName: string,
    ignoreOverrides: boolean = false,
  ): DynamicConfig {
    const configNameHash = getHashValue(configName);
    let configValue = new DynamicConfig(configName);
    if (!ignoreOverrides && this.overrides.configs[configName] != null) {
      configValue = new DynamicConfig(
        configName,
        this.overrides.configs[configName],
        'override',
      );
    } else if (
      this.values[this.getCurrentUserCacheKey()]?.dynamic_configs[
        configNameHash
      ] != null
    ) {
      const rawConfigValue =
        this.values[this.getCurrentUserCacheKey()]?.dynamic_configs[
          configNameHash
        ];
      configValue = this.createDynamicConfig(configName, rawConfigValue);
    }
    this.sdkInternal
      .getLogger()
      .logConfigExposure(
        this.sdkInternal.getCurrentUser(),
        configName,
        configValue.getRuleID(),
        configValue._getSecondaryExposures(),
      );
    return configValue;
  }

  public getExperiment(
    expName: string,
    keepDeviceValue: boolean = false,
    ignoreOverrides: boolean = false,
  ): DynamicConfig {
    const expNameHash = getHashValue(expName);
    let exp = new DynamicConfig(expName);
    if (!ignoreOverrides && this.overrides.configs[expName] != null) {
      exp = new DynamicConfig(
        expName,
        this.overrides.configs[expName],
        'override',
      );
    } else {
      const userCacheKey = this.getCurrentUserCacheKey();
      const userValues = this.values[userCacheKey];

      let stickyValue =
        userValues?.sticky_experiments[expNameHash] ??
        this.stickyDeviceExperiments[expNameHash];
      let latestValue = userValues?.dynamic_configs[expNameHash];

      // If flag is false, or experiment is NOT active, simply remove the
      // sticky experiment value, and return the latest value
      if (!keepDeviceValue || latestValue?.is_experiment_active == false) {
        this.removeStickyValue(userCacheKey, expName);
        exp = this.createDynamicConfig(expName, latestValue);
      } else if (stickyValue != null) {
        // If sticky value is already in cache, use it
        exp = this.createDynamicConfig(expName, stickyValue);
      } else if (latestValue != null) {
        // Here the user has NOT been exposed before.
        // If they are IN this ACTIVE experiment, then we save the value as sticky
        if (
          latestValue.is_experiment_active &&
          latestValue.is_user_in_experiment
        ) {
          this.saveStickyValue(userCacheKey, expNameHash, latestValue);
        }
        exp = this.createDynamicConfig(expName, latestValue);
      }
    }
    this.sdkInternal
      .getLogger()
      .logConfigExposure(
        this.sdkInternal.getCurrentUser(),
        expName,
        exp.getRuleID(),
        exp._getSecondaryExposures(),
      );
    return exp;
  }

  public getLayer(layerName: string, keepDeviceValue: boolean): DynamicConfig {
    const config = (() => {
      const layerNameHash = getHashValue(layerName);
      const userCacheKey = this.getCurrentUserCacheKey();
      const userValues = this.values[userCacheKey];

      const stickyValue =
        userValues?.sticky_experiments[layerNameHash] ??
        this.stickyDeviceExperiments[layerNameHash];

      if (stickyValue) {
        if (keepDeviceValue) {
          const stickyHash = stickyValue.name;
          const stickyData = userValues?.dynamic_configs[stickyHash];

          if (stickyData?.is_experiment_active) {
            return this.createDynamicConfig(layerName, stickyValue);
          }
        }

        this.removeStickyValue(userCacheKey, layerNameHash);
      }

      const layerConfigData = userValues?.layer_configs[layerNameHash];
      const layerConfigDefaults = layerConfigData?.default_values;

      if (!layerConfigDefaults) {
        return new DynamicConfig(layerName);
      }

      const hashedExperimentName =
        layerConfigData.allocated_experiment_name ?? '';
      const experimentConfig =
        userValues?.dynamic_configs[hashedExperimentName];
      if (!experimentConfig) {
        return new DynamicConfig(
          layerName,
          layerConfigDefaults,
          'layer_defaults',
        );
      }

      if (keepDeviceValue && experimentConfig.is_experiment_active === true) {
        this.saveStickyValue(userCacheKey, layerNameHash, experimentConfig);
      }

      return this.createDynamicConfig(layerName, experimentConfig);
    })();

    this.sdkInternal
      .getLogger()
      .logConfigExposure(
        this.sdkInternal.getCurrentUser(),
        layerName,
        config.getRuleID(),
        config._getSecondaryExposures(),
        config._getHash(),
      );

    return config;
  }

  public overrideConfig(configName: string, value: Record<string, any>): void {
    try {
      JSON.stringify(value);
    } catch (e) {
      console.warn('Failed to stringify given config override.  Dropping', e);
      return;
    }
    this.overrides.configs[configName] = value;
    this.saveOverrides();
  }

  public overrideGate(gateName: string, value: boolean): void {
    this.overrides.gates[gateName] = value;
    this.saveOverrides();
  }

  public removeGateOverride(gateName?: string): void {
    if (gateName == null) {
      this.overrides.gates = {};
    } else {
      delete this.overrides.gates[gateName];
    }
    this.saveOverrides();
  }

  public removeConfigOverride(configName?: string): void {
    if (configName == null) {
      this.overrides.configs = {};
    } else {
      delete this.overrides.configs[configName];
    }
    this.saveOverrides();
  }

  public getAllOverrides(): StatsigOverrides {
    return this.overrides;
  }

  private saveOverrides(): void {
    try {
      StatsigLocalStorage.setItem(
        OVERRIDES_STORE_KEY,
        JSON.stringify(this.overrides),
      );
    } catch (e) {
      console.warn('Failed to persist gate/config overrides');
    }
  }

  private getCurrentUserCacheKey(): string {
    return this.sdkInternal.getCurrentUserCacheKey();
  }

  private createDynamicConfig(
    name: string,
    apiConfig: APIDynamicConfig | undefined,
  ) {
    return new DynamicConfig(
      name,
      apiConfig?.value,
      apiConfig?.rule_id,
      apiConfig?.secondary_exposures,
      apiConfig?.name,
    );
  }

  private saveStickyValue(
    userCacheKey: string,
    key: string,
    config: APIDynamicConfig,
  ) {
    const userValues = this.values[userCacheKey];

    if (config.is_device_based === true) {
      // save sticky values in memory
      this.stickyDeviceExperiments[key] = config;
    } else if (userValues) {
      userValues.sticky_experiments[key] = config;
    }
    // also save to persistent storage
    this.saveStickyValuesToStorage();
  }

  private removeStickyValue(userCacheKey: string, key: string) {
    delete this.values[userCacheKey]?.sticky_experiments[key];
    delete this.stickyDeviceExperiments[key];
    this.saveStickyValuesToStorage();
  }

  private saveStickyValuesToStorage() {
    if (StatsigAsyncStorage.asyncStorage) {
      StatsigAsyncStorage.setItemAsync(
        INTERNAL_STORE_KEY,
        JSON.stringify(this.values),
      );
      StatsigAsyncStorage.setItemAsync(
        STICKY_DEVICE_EXPERIMENTS_KEY,
        JSON.stringify(this.stickyDeviceExperiments),
      );
    } else {
      StatsigLocalStorage.setItem(
        INTERNAL_STORE_KEY,
        JSON.stringify(this.values),
      );
      StatsigLocalStorage.setItem(
        STICKY_DEVICE_EXPERIMENTS_KEY,
        JSON.stringify(this.stickyDeviceExperiments),
      );
    }
  }
}

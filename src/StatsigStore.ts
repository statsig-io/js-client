import { sha256 } from 'js-sha256';

import DynamicConfig from './DynamicConfig';
import Layer from './Layer';
import { IHasStatsigInternal, StatsigOverrides } from './StatsigClient';
import { Base64 } from './utils/Base64';
import {
  INTERNAL_STORE_KEY,
  OVERRIDES_STORE_KEY,
  STICKY_DEVICE_EXPERIMENTS_KEY,
} from './utils/Constants';
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
  allocated_experiment_name: string | null;
};

type APIInitializeData = {
  dynamic_configs: Record<string, APIDynamicConfig | undefined>;
  feature_gates: Record<string, APIFeatureGate | undefined>;
  layer_configs: Record<string, APIDynamicConfig | undefined>;
};

type UserCacheValues = {
  dynamic_configs: Record<string, APIDynamicConfig | undefined>;
  feature_gates: Record<string, APIFeatureGate | undefined>;
  sticky_experiments: Record<string, APIDynamicConfig | undefined>;
  layer_configs: Record<string, APIDynamicConfig | undefined>;
  time: number;
};

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
    // We append to the values after removing one, so must have at most MAX - 1
    const filteredValues = Object.entries(this.values)
      .sort(({ 1: a }, { 1: b }) => {
        if (a == null) {
          return 1;
        }
        if (b == null) {
          return -1;
        }
        return b?.time - a?.time;
      })
      .slice(0, MAX_USER_VALUE_CACHED - 1);
    this.values = Object.fromEntries(filteredValues);
    this.values[userCacheKey] = {
      ...(jsonConfigs as APIInitializeData),
      sticky_experiments: this.values[userCacheKey]?.sticky_experiments ?? {},
      time: Date.now(),
    };
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
    let exp: DynamicConfig = new DynamicConfig(expName);
    if (!ignoreOverrides && this.overrides.configs[expName] != null) {
      exp = new DynamicConfig(
        expName,
        this.overrides.configs[expName],
        'override',
      );
    } else {
      const latestValue = this.getLatestValue(expName, 'dynamic_configs');
      const finalValue = this.getPossiblyStickyValue(
        expName,
        latestValue,
        keepDeviceValue,
      );
      exp = this.createDynamicConfig(expName, finalValue);
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

  public getLayer(layerName: string, keepDeviceValue: boolean): Layer {
    const latestValue = this.getLatestValue(layerName, 'layer_configs');
    const finalValue = this.getPossiblyStickyValue(
      layerName,
      latestValue,
      keepDeviceValue,
    );
    const config = new Layer(
      layerName,
      finalValue?.value,
      finalValue?.rule_id,
      finalValue?.secondary_exposures,
      finalValue?.allocated_experiment_name ?? '',
    );

    this.sdkInternal
      .getLogger()
      .logLayerExposure(
        this.sdkInternal.getCurrentUser(),
        layerName,
        config.getRuleID(),
        config._getSecondaryExposures(),
        config._getAllocatedExperimentName(),
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

  private getLatestValue(
    name: string,
    topLevelKey: 'layer_configs' | 'dynamic_configs',
  ): APIDynamicConfig | undefined {
    const hash = getHashValue(name);
    const userCacheKey = this.getCurrentUserCacheKey();
    const userValues = this.values[userCacheKey];
    return userValues?.[topLevelKey]?.[hash];
  }

  private getPossiblyStickyValue(
    name: string,
    latestValue: APIDynamicConfig | undefined,
    keepDeviceValue: boolean,
  ): APIDynamicConfig | undefined {
    const hashedName = getHashValue(name);

    const userCacheKey = this.getCurrentUserCacheKey();
    let stickyValue = this.getStickyValue(userCacheKey, hashedName);

    // If flag is false, or experiment is NOT active, simply remove the
    // sticky experiment value, and return the latest value
    if (!keepDeviceValue || latestValue?.is_experiment_active == false) {
      this.removeStickyValue(userCacheKey, hashedName);
      return latestValue;
    }

    if (stickyValue != null) {
      // If sticky value is already in cache, use it
      return stickyValue;
    }

    if (latestValue != null && keepDeviceValue) {
      // Here the user has NOT been exposed before.
      // If they are IN this ACTIVE experiment, then we save the value as sticky
      this.saveStickyValueIfNeeded(userCacheKey, hashedName, latestValue);
    }

    return latestValue;
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
      apiConfig?.allocated_experiment_name ?? '',
    );
  }

  private getStickyValue(userCacheKey: string, key: string) {
    const userValues = this.values[userCacheKey];

    return (
      userValues?.sticky_experiments[key] ?? this.stickyDeviceExperiments[key]
    );
  }

  private saveStickyValueIfNeeded(
    userCacheKey: string,
    key: string,
    config: APIDynamicConfig,
  ) {
    if (!config.is_user_in_experiment || !config.is_experiment_active) {
      return;
    }

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

import { sha256 } from 'js-sha256';

import DynamicConfig from './DynamicConfig';
import { IHasStatsigInternal, StatsigOverrides } from './StatsigClient';
import { Base64 } from './utils/Base64';
import StatsigAsyncStorage from './utils/StatsigAsyncLocalStorage';
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

type APIInitializeData = {
  dynamic_configs: Record<string, APIDynamicConfig | undefined>;
  feature_gates: Record<string, APIFeatureGate | undefined>;
};

type StickyUserExperiments = {
  user_id: string | number | null;
  experiments: Record<string, APIDynamicConfig | undefined>;
};

const INTERNAL_STORE_KEY = 'STATSIG_LOCAL_STORAGE_INTERNAL_STORE_V3';
const OVERRIDES_STORE_KEY = 'STATSIG_LOCAL_STORAGE_INTERNAL_STORE_OVERRIDES_V3';
const STICKY_USER_EXPERIMENTS_KEY =
  'STATSIG_LOCAL_STORAGE_STICKY_USER_EXPERIMENTS';
const STICKY_DEVICE_EXPERIMENTS_KEY =
  'STATSIG_LOCAL_STORAGE_STICKY_DEVICE_EXPERIMENTS';

export default class StatsigStore {
  private sdkInternal: IHasStatsigInternal;

  private overrides: StatsigOverrides = {
    gates: {},
    configs: {},
  };

  private loaded: boolean;
  private values: APIInitializeData;
  private stickyUserExperiments: StickyUserExperiments;
  private stickyDeviceExperiments: Record<string, APIDynamicConfig>;

  public constructor(sdkInternal: IHasStatsigInternal) {
    this.sdkInternal = sdkInternal;
    this.values = { feature_gates: {}, dynamic_configs: {} };
    this.stickyUserExperiments = {
      user_id: sdkInternal.getCurrentUser()?.userID ?? null,
      experiments: {},
    };
    this.stickyDeviceExperiments = {};
    this.loaded = false;
  }

  public async loadFromAsyncStorage(): Promise<void> {
    this.parseCachedValues(
      await StatsigAsyncStorage.getItemAsync(INTERNAL_STORE_KEY),
      await StatsigAsyncStorage.getItemAsync(STICKY_USER_EXPERIMENTS_KEY),
      await StatsigAsyncStorage.getItemAsync(STICKY_DEVICE_EXPERIMENTS_KEY),
    );
    this.loaded = true;
  }

  public loadFromLocalStorage(): void {
    this.parseCachedValues(
      StatsigLocalStorage.getItem(INTERNAL_STORE_KEY),
      StatsigLocalStorage.getItem(STICKY_USER_EXPERIMENTS_KEY),
      StatsigLocalStorage.getItem(STICKY_DEVICE_EXPERIMENTS_KEY),
    );
    this.loaded = true;
  }

  public isLoaded(): boolean {
    return this.loaded;
  }

  private parseCachedValues(
    allValues: string | null,
    userExperiments: string | null,
    deviceExperiments: string | null,
  ): void {
    try {
      const allValuesParsed = allValues ? JSON.parse(allValues) : null;
      if (
        allValuesParsed &&
        allValuesParsed.feature_gates != null &&
        allValuesParsed.dynamic_configs != null
      ) {
        this.values = allValuesParsed;
      }
    } catch (e) {
      // Cached value corrupted, remove cache
      this.removeFromStorage(INTERNAL_STORE_KEY);
    }

    try {
      const userExpParsed = userExperiments
        ? JSON.parse(userExperiments)
        : null;
      if (
        userExpParsed &&
        userExpParsed.user_id === this.sdkInternal.getCurrentUser()?.userID
      ) {
        this.stickyUserExperiments = userExpParsed;
      }
    } catch (e) {
      this.removeFromStorage(STICKY_USER_EXPERIMENTS_KEY);
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

  public async save(jsonConfigs: Record<string, any>): Promise<void> {
    this.values = jsonConfigs as APIInitializeData;
    if (StatsigAsyncStorage.asyncStorage) {
      await StatsigAsyncStorage.setItemAsync(
        INTERNAL_STORE_KEY,
        JSON.stringify(jsonConfigs),
      );
    } else {
      StatsigLocalStorage.setItem(
        INTERNAL_STORE_KEY,
        JSON.stringify(jsonConfigs),
      );
    }
  }

  public checkGate(gateName: string): boolean {
    const gateNameHash = getHashValue(gateName);
    let gateValue = { value: false, rule_id: '', secondary_exposures: [] };
    if (this.overrides.gates[gateName] != null) {
      gateValue = {
        value: this.overrides.gates[gateName],
        rule_id: 'override',
        secondary_exposures: [],
      };
    } else {
      gateValue = this.values.feature_gates[gateNameHash] ?? gateValue;
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

  public getConfig(configName: string): DynamicConfig {
    const configNameHash = getHashValue(configName);
    let configValue = new DynamicConfig(configName);
    if (this.overrides.configs[configName] != null) {
      configValue = new DynamicConfig(
        configName,
        this.overrides.configs[configName],
        'override',
      );
    } else if (this.values.dynamic_configs[configNameHash] != null) {
      const rawConfigValue = this.values.dynamic_configs[configNameHash];
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
  ): DynamicConfig {
    const expNameHash = getHashValue(expName);
    let exp = new DynamicConfig(expName);
    if (this.overrides.configs[expName] != null) {
      exp = new DynamicConfig(
        expName,
        this.overrides.configs[expName],
        'override',
      );
    } else {
      let stickyValue =
        this.stickyUserExperiments.experiments[expNameHash] ??
        this.stickyDeviceExperiments[expNameHash];
      let latestValue = this.values.dynamic_configs[expNameHash];

      // If flag is false, or experiment is NOT active, simply remove the
      // sticky experiment value, and return the latest value
      if (!keepDeviceValue || latestValue?.is_experiment_active == false) {
        this.removeStickyValue(expName);
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
          if (latestValue.is_device_based) {
            // save sticky values in memory
            this.stickyDeviceExperiments[expNameHash] = latestValue;
          } else {
            this.stickyUserExperiments.experiments[expNameHash] = latestValue;
          }
          // also save to persistent storage
          this.saveStickyValuesToStorage();
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

  public overrideConfig(configName: string, value: Record<string, any>): void {
    if (!this.hasConfig(configName)) {
      console.warn(
        'The provided configName does not exist as a valid config/experiment.',
      );
      return;
    }
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
    if (!this.hasGate(gateName)) {
      console.warn(
        'The provided gateName does not exist as a valid feature gate.',
      );
      return;
    }
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

  public updateUser(newUserID: string | number | null) {
    if (newUserID !== this.stickyUserExperiments.user_id) {
      this.stickyUserExperiments = { user_id: newUserID, experiments: {} };
      this.removeFromStorage(STICKY_USER_EXPERIMENTS_KEY);
    }
  }

  private hasConfig(configName: string): boolean {
    const hash = getHashValue(configName);
    return this.values.dynamic_configs[hash] != null;
  }

  private hasGate(gateName: string): boolean {
    const hash = getHashValue(gateName);
    return this.values.feature_gates[hash] != null;
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
    );
  }

  private removeStickyValue(key: string) {
    delete this.stickyUserExperiments.experiments[key];
    delete this.stickyDeviceExperiments[key];
    this.saveStickyValuesToStorage();
  }

  private saveStickyValuesToStorage() {
    if (StatsigAsyncStorage.asyncStorage) {
      StatsigAsyncStorage.setItemAsync(
        STICKY_USER_EXPERIMENTS_KEY,
        JSON.stringify(this.stickyUserExperiments),
      );
      StatsigAsyncStorage.setItemAsync(
        STICKY_DEVICE_EXPERIMENTS_KEY,
        JSON.stringify(this.stickyDeviceExperiments),
      );
    } else {
      StatsigLocalStorage.setItem(
        STICKY_USER_EXPERIMENTS_KEY,
        JSON.stringify(this.stickyUserExperiments),
      );
      StatsigLocalStorage.setItem(
        STICKY_DEVICE_EXPERIMENTS_KEY,
        JSON.stringify(this.stickyDeviceExperiments),
      );
    }
  }
}

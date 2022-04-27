import DynamicConfig from './DynamicConfig';
import Layer from './Layer';
import { IHasStatsigInternal, StatsigOverrides } from './StatsigClient';
import {
  INTERNAL_STORE_KEY,
  OVERRIDES_STORE_KEY,
  STICKY_DEVICE_EXPERIMENTS_KEY,
} from './utils/Constants';
import { getHashValue } from './utils/Hashing';
import StatsigAsyncStorage from './utils/StatsigAsyncStorage';
import StatsigLocalStorage from './utils/StatsigLocalStorage';

export enum EvaluationReason {
  Network = 'Network',
  Bootstrap = 'Bootstrap',
  Cache = 'Cache',
  Sticky = 'Sticky',
  LocalOverride = 'LocalOverride',
  Unrecognized = 'Unrecognized',
  Uninitialized = 'Uninitialized',
}

export type EvaluationDetails = {
  time: number;
  reason: EvaluationReason;
};

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
  undelegated_secondary_exposures?: [];
  explicit_parameters?: string[];
};

type APIInitializeData = {
  dynamic_configs: Record<string, APIDynamicConfig | undefined>;
  feature_gates: Record<string, APIFeatureGate | undefined>;
  layer_configs: Record<string, APIDynamicConfig | undefined>;
};

type UserCacheValues = APIInitializeData & {
  sticky_experiments: Record<string, APIDynamicConfig | undefined>;
  time: number;
  evaluation_time?: number;
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
  private userValues: UserCacheValues;
  private stickyDeviceExperiments: Record<string, APIDynamicConfig>;
  private userCacheKey: string;
  private reason: EvaluationReason;

  public constructor(sdkInternal: IHasStatsigInternal) {
    this.sdkInternal = sdkInternal;
    this.userCacheKey = this.sdkInternal.getCurrentUserCacheKey();
    this.values = {};
    this.userValues = {
      feature_gates: {},
      dynamic_configs: {},
      sticky_experiments: {},
      layer_configs: {},
      time: 0,
    };
    this.stickyDeviceExperiments = {};
    this.loaded = false;
    this.reason = EvaluationReason.Uninitialized;
    this.loadFromLocalStorage();
  }

  public updateUser() {
    this.userCacheKey = this.sdkInternal.getCurrentUserCacheKey();
    this.setUserValueFromCache();
  }

  public async loadFromAsyncStorage(): Promise<void> {
    this.parseCachedValues(
      await StatsigAsyncStorage.getItemAsync(INTERNAL_STORE_KEY),
      await StatsigAsyncStorage.getItemAsync(STICKY_DEVICE_EXPERIMENTS_KEY),
    );
    this.loaded = true;
  }

  public bootstrap(initializeValues: Record<string, any>): void {
    const key = this.sdkInternal.getCurrentUserCacheKey();
    // clients are going to assume that the SDK is bootstraped after this method runs
    // if we fail to parse, we will fall back to defaults, but we dont want to throw
    // when clients try to check gates/configs/etc after this point
    this.loaded = true;
    try {
      this.userValues.feature_gates = initializeValues.feature_gates ?? {};
      this.userValues.dynamic_configs = initializeValues.dynamic_configs ?? {};
      this.userValues.layer_configs = initializeValues.layer_configs ?? {};
      this.userValues.time = Date.now();
      this.userValues.evaluation_time =
        initializeValues.evaluation_time ?? Date.now();
      this.values[key] = this.userValues;
      this.reason = EvaluationReason.Bootstrap;
      this.loadOverrides();
    } catch (_e) {
      return;
    }
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
      this.setUserValueFromCache();
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

  private setUserValueFromCache() {
    let cachedValues = this.values[this.userCacheKey];
    if (cachedValues == null) {
      this.userValues = {
        feature_gates: {},
        dynamic_configs: {},
        sticky_experiments: {},
        layer_configs: {},
        time: 0,
      };
      this.reason = EvaluationReason.Uninitialized;
    } else {
      this.userValues = cachedValues;
      this.reason = EvaluationReason.Cache;
    }
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
    this.userValues = {
      ...(jsonConfigs as APIInitializeData),
      sticky_experiments:
        this.values[this.userCacheKey]?.sticky_experiments ?? {},
      time: Date.now(),
      evaluation_time: Date.now(),
    };
    this.values[this.userCacheKey] = this.userValues;
    this.reason = EvaluationReason.Network;

    // trim values to only have the max allowed
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
      .slice(0, MAX_USER_VALUE_CACHED);
    this.values = Object.fromEntries(filteredValues);
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
    let details: EvaluationDetails;
    if (!ignoreOverrides && this.overrides.gates[gateName] != null) {
      gateValue = {
        value: this.overrides.gates[gateName],
        rule_id: 'override',
        secondary_exposures: [],
      };
      details = this.getEvaluationDetails(
        false,
        EvaluationReason.LocalOverride,
      );
    } else {
      let value = this.userValues?.feature_gates[gateNameHash];
      if (value) {
        gateValue = value;
      }
      details = this.getEvaluationDetails(value != null);
    }
    this.sdkInternal
      .getLogger()
      .logGateExposure(
        this.sdkInternal.getCurrentUser(),
        gateName,
        gateValue.value,
        gateValue.rule_id,
        gateValue.secondary_exposures,
        details,
      );
    return gateValue.value === true;
  }

  public getConfig(
    configName: string,
    ignoreOverrides: boolean = false,
  ): DynamicConfig {
    const configNameHash = getHashValue(configName);
    let configValue: DynamicConfig;
    let details: EvaluationDetails;
    if (!ignoreOverrides && this.overrides.configs[configName] != null) {
      details = this.getEvaluationDetails(
        false,
        EvaluationReason.LocalOverride,
      );
      configValue = new DynamicConfig(
        configName,
        this.overrides.configs[configName],
        'override',
        details,
      );
    } else if (this.userValues?.dynamic_configs[configNameHash] != null) {
      const rawConfigValue = this.userValues?.dynamic_configs[configNameHash];
      details = this.getEvaluationDetails(true);
      configValue = this.createDynamicConfig(
        configName,
        rawConfigValue,
        details,
      );
    } else {
      details = this.getEvaluationDetails(false);
      configValue = new DynamicConfig(configName, {}, '', details);
    }
    this.sdkInternal
      .getLogger()
      .logConfigExposure(
        this.sdkInternal.getCurrentUser(),
        configName,
        configValue.getRuleID(),
        configValue._getSecondaryExposures(),
        details,
      );
    return configValue;
  }

  public getExperiment(
    expName: string,
    keepDeviceValue: boolean = false,
    ignoreOverrides: boolean = false,
  ): DynamicConfig {
    let exp: DynamicConfig;
    let details: EvaluationDetails;
    if (!ignoreOverrides && this.overrides.configs[expName] != null) {
      details = this.getEvaluationDetails(
        false,
        EvaluationReason.LocalOverride,
      );
      exp = new DynamicConfig(
        expName,
        this.overrides.configs[expName],
        'override',
        details,
      );
    } else {
      const latestValue = this.getLatestValue(expName, 'dynamic_configs');
      details = this.getEvaluationDetails(latestValue != null);

      const finalValue = this.getPossiblyStickyValue(
        expName,
        latestValue,
        keepDeviceValue,
        false /* isLayer */,
        details,
      );
      exp = this.createDynamicConfig(expName, finalValue, details);
    }

    this.sdkInternal
      .getLogger()
      .logConfigExposure(
        this.sdkInternal.getCurrentUser(),
        expName,
        exp.getRuleID(),
        exp._getSecondaryExposures(),
        details,
      );
    return exp;
  }

  public getLayer(layerName: string, keepDeviceValue: boolean): Layer {
    const latestValue = this.getLatestValue(layerName, 'layer_configs');
    const details = this.getEvaluationDetails(latestValue != null);
    const finalValue = this.getPossiblyStickyValue(
      layerName,
      latestValue,
      keepDeviceValue,
      true /* isLayer */,
      details,
    );

    return Layer._create(
      layerName,
      finalValue?.value ?? {},
      finalValue?.rule_id ?? '',
      details,
      this.sdkInternal,
      finalValue?.secondary_exposures,
      finalValue?.undelegated_secondary_exposures,
      finalValue?.allocated_experiment_name ?? '',
      finalValue?.explicit_parameters,
    );
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

  private getLatestValue(
    name: string,
    topLevelKey: 'layer_configs' | 'dynamic_configs',
  ): APIDynamicConfig | undefined {
    const hash = getHashValue(name);
    return (
      this.userValues?.[topLevelKey]?.[hash] ??
      this.userValues?.[topLevelKey]?.[name]
    );
  }

  // Sticky Logic: https://gist.github.com/daniel-statsig/3d8dfc9bdee531cffc96901c1a06a402
  private getPossiblyStickyValue(
    name: string,
    latestValue: APIDynamicConfig | undefined,
    keepDeviceValue: boolean,
    isLayer: boolean,
    details: EvaluationDetails,
  ): APIDynamicConfig | undefined {
    // We don't want sticky behavior. Clear any sticky values and return latest.
    if (!keepDeviceValue) {
      this.removeStickyValue(name);
      return latestValue;
    }

    // If there is no sticky value, save latest as sticky and return latest.
    const stickyValue = this.getStickyValue(name);
    if (!stickyValue) {
      this.attemptToSaveStickyValue(name, latestValue);
      return latestValue;
    }

    // Get the latest config value. Layers require a lookup by allocated_experiment_name.
    let latestExperimentValue = null;
    if (isLayer) {
      latestExperimentValue = this.getLatestValue(
        stickyValue?.allocated_experiment_name ?? '',
        'dynamic_configs',
      );
    } else {
      latestExperimentValue = latestValue;
    }

    if (latestExperimentValue?.is_experiment_active == true) {
      details.reason = EvaluationReason.Sticky;
      return stickyValue;
    }

    if (latestValue?.is_experiment_active == true) {
      this.attemptToSaveStickyValue(name, latestValue);
    } else {
      this.removeStickyValue(name);
    }

    return latestValue;
  }

  private createDynamicConfig(
    name: string,
    apiConfig: APIDynamicConfig | undefined,
    details: EvaluationDetails,
  ) {
    return new DynamicConfig(
      name,
      apiConfig?.value ?? {},
      apiConfig?.rule_id ?? '',
      details,
      apiConfig?.secondary_exposures,
      apiConfig?.allocated_experiment_name ?? '',
    );
  }

  private getStickyValue(name: string) {
    const key = getHashValue(name);

    return (
      this.userValues?.sticky_experiments[key] ??
      this.stickyDeviceExperiments[key]
    );
  }

  private attemptToSaveStickyValue(name: string, config?: APIDynamicConfig) {
    if (!config) {
      return;
    }

    if (!config.is_user_in_experiment || !config.is_experiment_active) {
      return;
    }

    const key = getHashValue(name);
    if (config.is_device_based === true) {
      // save sticky values in memory
      this.stickyDeviceExperiments[key] = config;
    } else if (this.userValues?.sticky_experiments) {
      this.userValues.sticky_experiments[key] = config;
    }
    // also save to persistent storage
    this.saveStickyValuesToStorage();
  }

  private removeStickyValue(name: string) {
    const key = getHashValue(name);

    delete this.userValues?.sticky_experiments[key];
    delete this.stickyDeviceExperiments[key];
    this.saveStickyValuesToStorage();
  }

  private saveStickyValuesToStorage() {
    this.values[this.userCacheKey] = this.userValues;
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

  private getEvaluationDetails(
    valueExists: Boolean,
    reasonOverride?: EvaluationReason,
  ): EvaluationDetails {
    if (valueExists) {
      return {
        reason: this.reason,
        time: this.userValues.evaluation_time ?? Date.now(),
      };
    } else {
      return {
        reason:
          reasonOverride ??
          (this.reason == EvaluationReason.Uninitialized
            ? EvaluationReason.Uninitialized
            : EvaluationReason.Unrecognized),
        time: Date.now(),
      };
    }
  }
}

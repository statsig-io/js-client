import DynamicConfig from './DynamicConfig';
import Layer, { LogParameterFunction } from './Layer';
import { IHasStatsigInternal, StatsigOverrides } from './StatsigClient';
import BootstrapValidator from './utils/BootstrapValidator';
import { StatsigUser } from './StatsigUser';
import {
  INTERNAL_STORE_KEY,
  OVERRIDES_STORE_KEY,
  STICKY_DEVICE_EXPERIMENTS_KEY,
} from './utils/Constants';
import { getHashValue, getUserCacheKey } from './utils/Hashing';
import StatsigAsyncStorage from './utils/StatsigAsyncStorage';
import StatsigLocalStorage from './utils/StatsigLocalStorage';

export enum EvaluationReason {
  Network = 'Network',
  Bootstrap = 'Bootstrap',
  InvalidBootstrap = 'InvalidBootstrap',
  Cache = 'Cache',
  Prefetch = 'Prefetch',
  Sticky = 'Sticky',
  LocalOverride = 'LocalOverride',
  Unrecognized = 'Unrecognized',
  Uninitialized = 'Uninitialized',
  Error = 'Error',
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

export type StoreGateFetchResult = {
  gate: APIFeatureGate;
  evaluationDetails: EvaluationDetails;
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
  has_updates?: boolean;
  time: number;
  user_hash?: string;
};

type APIInitializeDataWithPrefetchedUsers = APIInitializeData & {
  prefetched_user_values?: Record<string, APIInitializeData>;
};

type UserCacheValues = APIInitializeDataWithPrefetchedUsers & {
  sticky_experiments: Record<string, APIDynamicConfig | undefined>;
  evaluation_time?: number;
};

const MAX_USER_VALUE_CACHED = 10;

export default class StatsigStore {
  private sdkInternal: IHasStatsigInternal;

  private overrides: StatsigOverrides = {
    gates: {},
    configs: {},
    layers: {},
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
      has_updates: false,
      time: 0,
      evaluation_time: 0,
    };
    this.stickyDeviceExperiments = {};
    this.loaded = false;
    this.reason = EvaluationReason.Uninitialized;
    this.loadFromLocalStorage();
  }

  public updateUser(isUserPrefetched: boolean): boolean {
    this.userCacheKey = this.sdkInternal.getCurrentUserCacheKey();
    return this.setUserValueFromCache(isUserPrefetched);
  }

  public async loadFromAsyncStorage(): Promise<void> {
    this.parseCachedValues(
      await StatsigAsyncStorage.getItemAsync(INTERNAL_STORE_KEY),
      await StatsigAsyncStorage.getItemAsync(STICKY_DEVICE_EXPERIMENTS_KEY),
    );
    this.loaded = true;
  }

  public bootstrap(
    stableID: string,
    initializeValues: Record<string, any>,
  ): void {
    const key = this.sdkInternal.getCurrentUserCacheKey();
    const user = this.sdkInternal.getCurrentUser();

    const reason = BootstrapValidator.isValid(user, initializeValues)
      ? EvaluationReason.Bootstrap
      : EvaluationReason.InvalidBootstrap;

    // clients are going to assume that the SDK is bootstraped after this method runs
    // if we fail to parse, we will fall back to defaults, but we dont want to throw
    // when clients try to check gates/configs/etc after this point
    this.loaded = true;
    try {
      this.userValues.feature_gates = initializeValues.feature_gates ?? {};
      this.userValues.dynamic_configs = initializeValues.dynamic_configs ?? {};
      this.userValues.layer_configs = initializeValues.layer_configs ?? {};
      this.userValues.evaluation_time = Date.now();
      this.userValues.time = Date.now();
      this.values[key] = this.userValues;
      this.reason = reason;
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

  public getLastUpdateTime(user: StatsigUser | null): number | null {
    const userHash = getHashValue(JSON.stringify(user));
    if (this.userValues.user_hash == userHash) {
      return this.userValues.time;
    }
    return null;
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

  private setUserValueFromCache(isUserPrefetched: boolean = false): boolean {
    let cachedValues = this.values[this.userCacheKey];
    if (cachedValues == null) {
      this.resetUserValues();
      this.reason = EvaluationReason.Uninitialized;
      return false;
    }

    this.userValues = cachedValues;
    this.reason = isUserPrefetched
      ? EvaluationReason.Prefetch
      : EvaluationReason.Cache;
    return true;
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
    user: StatsigUser | null,
    jsonConfigs: Record<string, any>,
  ): Promise<void> {
    const requestedUserCacheKey = getUserCacheKey(
      this.sdkInternal.getStatsigMetadata().stableID as string,
      user,
    );
    const data = jsonConfigs as APIInitializeDataWithPrefetchedUsers;
    if (data.prefetched_user_values) {
      const cacheKeys = Object.keys(data.prefetched_user_values);
      for (const key of cacheKeys) {
        const prefetched = data.prefetched_user_values[key];
        this.values[key] = this.convertAPIDataToCacheValues(prefetched, key);
      }
    }

    if (requestedUserCacheKey) {
      const requestedUserValues = this.convertAPIDataToCacheValues(
        data,
        requestedUserCacheKey,
      );
      if (data.has_updates && data.time) {
        const userHash = getHashValue(JSON.stringify(user));
        requestedUserValues.user_hash = userHash;
      }
      this.values[requestedUserCacheKey] = requestedUserValues;

      if (requestedUserCacheKey == this.userCacheKey) {
        this.userValues = requestedUserValues;
        this.reason = EvaluationReason.Network;
      }
    }

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
  ): StoreGateFetchResult {
    const gateNameHash = getHashValue(gateName);
    let gateValue: APIFeatureGate = {
      name: gateName,
      value: false,
      rule_id: '',
      secondary_exposures: [],
    };
    let details: EvaluationDetails;
    if (!ignoreOverrides && this.overrides.gates[gateName] != null) {
      gateValue = {
        name: gateName,
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

    return { evaluationDetails: details, gate: gateValue };
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

    return exp;
  }

  public getLayer(
    logParameterFunction: LogParameterFunction | null,
    layerName: string,
    keepDeviceValue: boolean,
  ): Layer {
    if (this.overrides.layers[layerName] != null) {
      const details = this.getEvaluationDetails(
        false,
        EvaluationReason.LocalOverride,
      );
      return Layer._create(
        layerName,
        this.overrides.layers[layerName] ?? {},
        'override',
        details,
        logParameterFunction,
      );
    }

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
      logParameterFunction,
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

  public overrideLayer(layerName: string, value: Record<string, any>): void {
    try {
      JSON.stringify(value);
    } catch (e) {
      console.warn('Failed to stringify given layer override.  Dropping', e);
      return;
    }
    this.overrides.layers[layerName] = value;
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

  public removeLayerOverride(layerName?: string): void {
    if (layerName == null) {
      this.overrides.layers = {};
    } else {
      delete this.overrides.layers[layerName];
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
    if (
      !config ||
      !config.is_user_in_experiment ||
      !config.is_experiment_active
    ) {
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
    if (
      Object.keys(this.userValues?.sticky_experiments ?? {}).length === 0 &&
      Object.keys(this.stickyDeviceExperiments ?? {}).length === 0
    ) {
      return;
    }

    const key = getHashValue(name);

    delete this.userValues?.sticky_experiments[key];
    delete this.stickyDeviceExperiments[key];
    this.saveStickyValuesToStorage();
  }

  private saveStickyValuesToStorage() {
    this.values[this.userCacheKey] = this.userValues;
    this.setItemToStorage(INTERNAL_STORE_KEY, JSON.stringify(this.values));
    this.setItemToStorage(
      STICKY_DEVICE_EXPERIMENTS_KEY,
      JSON.stringify(this.stickyDeviceExperiments),
    );
  }

  public getGlobalEvaluationDetails(): EvaluationDetails {
    return {
      reason: this.reason ?? EvaluationReason.Uninitialized,
      time: this.userValues.evaluation_time ?? 0,
    };
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

  private resetUserValues() {
    this.userValues = {
      feature_gates: {},
      dynamic_configs: {},
      sticky_experiments: {},
      layer_configs: {},
      time: 0,
      evaluation_time: 0,
    };
  }

  private convertAPIDataToCacheValues(
    data: APIInitializeData,
    cacheKey: string,
  ): UserCacheValues {
    // Specifically pulling keys from data here to avoid pulling in unwanted keys
    return {
      feature_gates: data.feature_gates,
      layer_configs: data.layer_configs,
      dynamic_configs: data.dynamic_configs,
      sticky_experiments: this.values[cacheKey]?.sticky_experiments ?? {},
      time: data.time == null || isNaN(data.time) ? 0 : data.time,
      evaluation_time: Date.now(),
    };
  }

  private setItemToStorage(key: string, value: string) {
    if (StatsigAsyncStorage.asyncStorage) {
      StatsigAsyncStorage.setItemAsync(key, value);
    } else {
      StatsigLocalStorage.setItem(key, value);
    }
  }
}

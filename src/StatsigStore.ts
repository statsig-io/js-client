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

type FeatureGate = {
  name: string;
  value: boolean;
  rule_id: string;
  secondary_exposures: [];
};

const INTERNAL_STORE_KEY = 'STATSIG_LOCAL_STORAGE_INTERNAL_STORE_V3';
const OVERRIDES_STORE_KEY = 'STATSIG_LOCAL_STORAGE_INTERNAL_STORE_OVERRIDES_V3';

export default class StatsigStore {
  private sdkInternal: IHasStatsigInternal;

  private overrides: StatsigOverrides = {
    gates: {},
    configs: {},
  };

  private gates: Record<string, FeatureGate> = {};
  private configs: Record<string, DynamicConfig> = {};

  public constructor(sdkInternal: IHasStatsigInternal) {
    this.sdkInternal = sdkInternal;
  }

  public async loadFromAsyncStorage(): Promise<void> {
    const persisted = await StatsigAsyncStorage.getItemAsync(INTERNAL_STORE_KEY);
    this.loadFrom(persisted);
  }

  public loadFromLocalStorage(): void {
    const persisted = StatsigLocalStorage.getItem(INTERNAL_STORE_KEY);
    this.loadFrom(persisted);
  }

  private loadFrom(persisted: string | null): void {
    if (persisted == null) {
      this.loadOverrides();
      return;
    }
    try {
      const persistedJsonConfigs = JSON.parse(persisted);
      if (persistedJsonConfigs == null) {
        return;
      }
      this.parseConfigs(persistedJsonConfigs);
    } catch (e) {
      // Cached value corrupted, remove cache
      StatsigLocalStorage.removeItem(INTERNAL_STORE_KEY);
    }
    this.loadOverrides();
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
    this.parseConfigs(jsonConfigs);

    if (StatsigAsyncStorage.asyncStorage) {
      await StatsigAsyncStorage.setItemAsync(INTERNAL_STORE_KEY, JSON.stringify(jsonConfigs));
    }

    StatsigLocalStorage.setItem(
      INTERNAL_STORE_KEY,
      JSON.stringify(jsonConfigs),
    );
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
    } else if (this.gates[gateNameHash] != null) {
      gateValue = this.gates[gateNameHash];
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
    } else if (this.configs[configNameHash] != null) {
      configValue = this.configs[configNameHash];
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

  public overrideConfig(configName: string, value: Record<string, any>): void {
    if (!this.hasConfig(configName)) {
      console.warn(
        'The provided configName does not exist as a valid config/experiment.',
      );
      return;
    }
    try {
      JSON.stringify(value);
    } catch(e) {
      console.warn("Failed to stringify given config override.  Dropping", e);
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
      console.warn("Failed to persist gate/config overrides");
    }
  }

  private hasConfig(configName: string): boolean {
    const hash = getHashValue(configName);
    return this.configs[hash] != null;
  }

  private hasGate(gateName: string): boolean {
    const hash = getHashValue(gateName);
    return this.gates[hash] != null;
  }

  private parseConfigs(jsonConfigs: Record<string, any>): void {
    if (jsonConfigs.feature_gates) {
      this.gates = jsonConfigs.feature_gates;
    }
    if (jsonConfigs.dynamic_configs) {
      let parsed: Record<string, DynamicConfig> = {};
      let dynamicConfigs = jsonConfigs.dynamic_configs;
      for (const configName in dynamicConfigs) {
        if (configName && dynamicConfigs[configName]) {
          parsed[configName] = new DynamicConfig(
            configName,
            dynamicConfigs[configName].value,
            dynamicConfigs[configName].rule_id,
            dynamicConfigs[configName].secondary_exposures,
          );
        }
      }
      this.configs = parsed;
    }
  }
}

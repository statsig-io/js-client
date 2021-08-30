import { sha256 } from 'js-sha256';
import DynamicConfig from './DynamicConfig';
import { IHasStatsigInternal } from './StatsigClient';
import { Base64 } from './utils/Base64';
import StatsigLocalStorage from './utils/StatsigLocalStorage';

function getHashValue(value: string) {
  let buffer = sha256.create().update(value).arrayBuffer();
  return Base64.encodeArrayBuffer(buffer);
}

type FeatureGate = {
  name: string;
  value: boolean;
  rule_id: string;
};
const INTERNAL_STORE_KEY = 'STATSIG_LOCAL_STORAGE_INTERNAL_STORE_V2';
const OVERRIDE_STORE_KEY = 'STATSIG_LOCAL_STORAGE_INTERNAL_STORE_OVERRIDES_V2';

export default class StatsigStore {
  private sdkInternal: IHasStatsigInternal;

  private gates: Record<string, FeatureGate> = {};
  private configs: Record<string, DynamicConfig> = {};

  private overrides: Record<string, boolean> = {};

  public constructor(sdkInternal: IHasStatsigInternal) {
    this.sdkInternal = sdkInternal;
  }

  public loadFromLocalStorage(): void {
    const persisted = StatsigLocalStorage.getItem(INTERNAL_STORE_KEY);
    if (persisted == null) {
      this.loadOverrides();
      return;
    }
    try {
      const jsonPersisted = JSON.parse(persisted);
      if (jsonPersisted == null) {
        return;
      }
      this.gates = jsonPersisted.gates;
      if (jsonPersisted.configs) {
        for (const [configName, configData] of Object.entries(
          jsonPersisted.configs,
        )) {
          this.configs[configName] = new DynamicConfig(
            // @ts-ignore
            configData.name,
            // @ts-ignore
            configData.value,
            // @ts-ignore
            configData.ruleID,
          );
        }
      }
    } catch (e) {
      // Cached value corrupted, remove cache
      StatsigLocalStorage.removeItem(INTERNAL_STORE_KEY);
    }
    this.loadOverrides();
  }

  private loadOverrides(): void {
    const overrides = StatsigLocalStorage.getItem(OVERRIDE_STORE_KEY);
    if (overrides == null) {
      return;
    }
    try {
      this.overrides = JSON.parse(overrides);
    } catch (e) {
      StatsigLocalStorage.removeItem(OVERRIDE_STORE_KEY);
    }
  }

  public save(json: Record<string, any>): void {
    if (json.feature_gates) {
      this.gates = json.feature_gates;
    }
    if (json.dynamic_configs) {
      this.configs = this.parseConfigs(json.dynamic_configs);
    }

    StatsigLocalStorage.setItem(
      INTERNAL_STORE_KEY,
      JSON.stringify({
        gates: this.gates,
        configs: this.configs,
      }),
    );
  }

  public checkGate(gateName: string): boolean {
    const gateNameHash = getHashValue(gateName);
    let gateValue = { value: false, rule_id: '' };
    if (this.overrides[gateName] != null) {
      gateValue = { value: this.overrides[gateName], rule_id: 'override' };
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
      );
    return gateValue.value === true;
  }

  public getConfig(configName: string): DynamicConfig {
    const configNameHash = getHashValue(configName);
    let configValue = new DynamicConfig(configName);
    if (this.configs[configNameHash] != null) {
      configValue = this.configs[configNameHash];
    }
    this.sdkInternal
      .getLogger()
      .logConfigExposure(
        this.sdkInternal.getCurrentUser(),
        configName,
        configValue.getRuleID(),
      );
    return configValue;
  }

  public overrideGate(gateName: string, value: boolean): void {
    if (!this.hasGate(gateName)) {
      console.warn(
        'The provided gateName does not exist as a valid feature gate.',
      );
      return;
    }
    this.overrides[gateName] = value;
    StatsigLocalStorage.setItem(
      OVERRIDE_STORE_KEY,
      JSON.stringify(this.overrides),
    );
  }

  public removeOverride(gateName?: string): void {
    if (gateName == null) {
      this.overrides = {};
      StatsigLocalStorage.removeItem(OVERRIDE_STORE_KEY);
    } else {
      delete this.overrides[gateName];
      StatsigLocalStorage.setItem(
        OVERRIDE_STORE_KEY,
        JSON.stringify(this.overrides),
      );
    }
  }

  public getOverrides(): Record<string, any> {
    return this.overrides;
  }

  private hasGate(gateName: string): boolean {
    const hash = getHashValue(gateName);
    return this.gates[hash] != null;
  }

  private parseConfigs(
    json: Record<string, any>,
  ): Record<string, DynamicConfig> {
    let parsed: Record<string, DynamicConfig> = {};
    for (const configName in json) {
      if (configName && json[configName]) {
        parsed[configName] = new DynamicConfig(
          configName,
          json[configName].value,
          json[configName].rule_id,
        );
      }
    }
    return parsed;
  }
}

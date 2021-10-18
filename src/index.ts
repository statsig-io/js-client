import DynamicConfig from './DynamicConfig';
import StatsigClient, { StatsigOverrides } from './StatsigClient';
import { StatsigOptions } from './StatsigSDKOptions';
import { StatsigUser } from './StatsigUser';

export { StatsigOptions, StatsigEnvironment } from './StatsigSDKOptions';
export { StatsigUser } from './StatsigUser';
export { default as DynamicConfig } from './DynamicConfig';
export { default as StatsigClient } from './StatsigClient';
export type { _SDKPackageInfo as _SDKPackageInfo } from './StatsigClient';
export type { AppState as AppState } from './StatsigClient';
export type { AppStateStatus as AppStateStatus } from './StatsigClient';
export { IStatsig, StatsigOverrides } from './StatsigClient';

export type {
  NativeModules,
  Platform,
  DeviceInfo,
  ExpoConstants,
  ExpoDevice,
} from './StatsigIdentity';

export type { AsyncStorage } from './utils/StatsigAsyncLocalStorage';

export default class Statsig {
  private static instance: StatsigClient;

  private constructor() {}

  public static async initialize(
    sdkKey: string,
    user?: StatsigUser | null,
    options?: StatsigOptions | null,
  ): Promise<void> {
    if (!Statsig.instance) {
      Statsig.instance = new StatsigClient();
    }
    return Statsig.instance.initializeAsync(sdkKey, user, options);
  }

  public static checkGate(gateName: string): boolean {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    return Statsig.instance.checkGate(gateName);
  }

  public static getConfig(configName: string): DynamicConfig {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    return Statsig.instance.getConfig(configName);
  }

  public static async getFailsafeConfig(): Promise<DynamicConfig> {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    return await Statsig.instance.getFailsafeConfig();
  }

  public static getExperiment(
    experimentName: string,
    keepDeviceValue: boolean = false,
  ): DynamicConfig {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    return Statsig.instance.getExperiment(experimentName, keepDeviceValue);
  }

  public static logEvent(
    eventName: string,
    value: string | number | null = null,
    metadata: Record<string, string> | null = null,
  ): void {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    Statsig.instance.logEvent(eventName, value, metadata);
  }

  public static updateUser(user: StatsigUser | null): Promise<boolean> {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    return Statsig.instance.updateUser(user);
  }

  public static shutdown() {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    Statsig.instance.shutdown();
  }

  /**
   * Overrides the given gate locally with the given value
   * @param gateName - name of the gate to override
   * @param value - value to assign to the gate
   */
  public static overrideGate(gateName: string, value: boolean): void {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    Statsig.instance.overrideGate(gateName, value);
  }

  /**
   * Overrides the given config locally with the given value
   * @param configName - name of the config to override
   * @param value - value to assign to the config
   */
  public static overrideConfig(configName: string, value: object): void {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    Statsig.instance.overrideConfig(configName, value);
  }

  /**
   * @deprecated use removeGateOverride or removeConfigOverride
   * @param name the gate override to remove
   */
  public static removeOverride(name?: string): void {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    Statsig.instance.removeOverride(name);
  }

  /**
   * @param name the gate override to remove
   */
  public static removeGateOverride(name?: string): void {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    Statsig.instance.removeGateOverride(name);
  }

  /**
   * @param name the config override to remove
   */
  public static removeConfigOverride(name?: string): void {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    Statsig.instance.removeConfigOverride(name);
  }

  /**
   * @deprecated use getAllOverrides
   * @returns the gate overrides
   */
  public static getOverrides(): Record<string, any> {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    return Statsig.instance.getOverrides();
  }

  /**
   * @returns The local gate and config overrides
   */
  public static getAllOverrides(): StatsigOverrides {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    return Statsig.instance.getAllOverrides();
  }
}

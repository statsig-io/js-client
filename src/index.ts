import DynamicConfig from './DynamicConfig';
import StatsigClient, {
  AppState,
  StatsigOverrides,
  _SDKPackageInfo,
} from './StatsigClient';
import {
  DeviceInfo,
  ExpoConstants,
  ExpoDevice,
  NativeModules,
  Platform,
} from './StatsigIdentity';
import { StatsigOptions } from './StatsigSDKOptions';
import { StatsigUser } from './StatsigUser';
import StatsigAsyncStorage, {
  AsyncStorage,
} from './utils/StatsigAsyncLocalStorage';

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

  // RN static dependencies
  private static sdkPackageInfo?: _SDKPackageInfo;
  private static appState?: AppState;
  private static nativeModules?: NativeModules;
  private static platform?: Platform;
  private static deviceInfo?: DeviceInfo;
  // RN Expo static dependencies
  private static expoConstants?: ExpoConstants;
  private static expoDevice?: ExpoDevice;

  private constructor() {}

  public static async initialize(
    sdkKey: string,
    user?: StatsigUser | null,
    options?: StatsigOptions | null,
  ): Promise<void> {
    if (!Statsig.instance) {
      Statsig.instance = new StatsigClient(sdkKey, user, options);
      Statsig.instance.setSDKPackageInfo(this.sdkPackageInfo);
      Statsig.instance.setAppState(this.appState);
      Statsig.instance.setNativeModules(this.nativeModules);
      Statsig.instance.setPlatform(this.platform);
      Statsig.instance.setRNDeviceInfo(this.deviceInfo);
      Statsig.instance.setExpoConstants(this.expoConstants);
      Statsig.instance.setExpoDevice(this.expoDevice);
    }
    return Statsig.instance.initializeAsync();
  }

  public static checkGate(
    gateName: string,
    ignoreOverrides: boolean = false,
  ): boolean {
    this.ensureInitialized();
    return Statsig.instance.checkGate(gateName, ignoreOverrides);
  }

  public static getConfig(
    configName: string,
    ignoreOverrides: boolean = false,
  ): DynamicConfig {
    this.ensureInitialized();
    return Statsig.instance.getConfig(configName, ignoreOverrides);
  }

  public static getExperiment(
    experimentName: string,
    keepDeviceValue: boolean = false,
    ignoreOverrides: boolean = false,
  ): DynamicConfig {
    this.ensureInitialized();
    return Statsig.instance.getExperiment(
      experimentName,
      keepDeviceValue,
      ignoreOverrides,
    );
  }

  public static logEvent(
    eventName: string,
    value: string | number | null = null,
    metadata: Record<string, string> | null = null,
  ): void {
    this.ensureInitialized();
    Statsig.instance.logEvent(eventName, value, metadata);
  }

  public static updateUser(user: StatsigUser | null): Promise<boolean> {
    this.ensureInitialized();
    return Statsig.instance.updateUser(user);
  }

  public static shutdown() {
    this.ensureInitialized();
    Statsig.instance.shutdown();
  }

  /**
   * Overrides the given gate locally with the given value
   * @param gateName - name of the gate to override
   * @param value - value to assign to the gate
   */
  public static overrideGate(gateName: string, value: boolean): void {
    this.ensureInitialized();
    Statsig.instance.overrideGate(gateName, value);
  }

  /**
   * Overrides the given config locally with the given value
   * @param configName - name of the config to override
   * @param value - value to assign to the config
   */
  public static overrideConfig(configName: string, value: object): void {
    this.ensureInitialized();
    Statsig.instance.overrideConfig(configName, value);
  }

  /**
   * @deprecated use removeGateOverride or removeConfigOverride
   * @param name the gate override to remove
   */
  public static removeOverride(name?: string): void {
    this.ensureInitialized();
    Statsig.instance.removeOverride(name);
  }

  /**
   * @param name the gate override to remove
   */
  public static removeGateOverride(name?: string): void {
    this.ensureInitialized();
    Statsig.instance.removeGateOverride(name);
  }

  /**
   * @param name the config override to remove
   */
  public static removeConfigOverride(name?: string): void {
    this.ensureInitialized();
    Statsig.instance.removeConfigOverride(name);
  }

  /**
   * @deprecated use getAllOverrides
   * @returns the gate overrides
   */
  public static getOverrides(): Record<string, any> {
    this.ensureInitialized();
    return Statsig.instance.getOverrides();
  }

  /**
   * @returns The local gate and config overrides
   */
  public static getAllOverrides(): StatsigOverrides {
    this.ensureInitialized();
    return Statsig.instance.getAllOverrides();
  }

  /**
   * @returns The Statsig stable ID used for device level experiments
   */
  public static getStableID(): string {
    this.ensureInitialized();
    return Statsig.instance.getStableID();
  }

  private static ensureInitialized() {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
  }

  // All methods below are for the statsig react native SDK internal usage only!
  public setSDKPackageInfo(sdkPackageInfo: _SDKPackageInfo) {
    Statsig.sdkPackageInfo = sdkPackageInfo;
  }

  public static setAsyncStorage(asyncStorage?: AsyncStorage | null): void {
    if (asyncStorage != null) {
      StatsigAsyncStorage.asyncStorage = asyncStorage;
    }
  }

  public static setAppState(appState?: AppState | null): void {
    if (appState != null) {
      Statsig.appState = appState;
    }
  }

  public static setNativeModules(nativeModules?: NativeModules | null): void {
    if (nativeModules != null) {
      Statsig.nativeModules = nativeModules;
    }
  }

  public static setPlatform(platform?: Platform | null): void {
    if (platform != null) {
      Statsig.platform = platform;
    }
  }

  public setRNDeviceInfo(deviceInfo?: DeviceInfo | null): void {
    if (deviceInfo != null) {
      Statsig.deviceInfo = deviceInfo;
    }
  }

  public setExpoConstants(expoConstants?: ExpoConstants | null): void {
    if (expoConstants != null) {
      Statsig.expoConstants = expoConstants;
    }
  }

  public setExpoDevice(expoDevice?: ExpoDevice | null): void {
    if (expoDevice != null) {
      Statsig.expoDevice = expoDevice;
    }
  }
}

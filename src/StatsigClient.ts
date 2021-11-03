import DynamicConfig from './DynamicConfig';
import LogEvent from './LogEvent';
import StatsigIdentity, { UUID } from './StatsigIdentity';
import type {
  DeviceInfo,
  ExpoConstants,
  ExpoDevice,
  NativeModules,
  Platform,
} from './StatsigIdentity';
import StatsigLogger from './StatsigLogger';
import StatsigNetwork from './StatsigNetwork';
import StatsigSDKOptions, { StatsigOptions } from './StatsigSDKOptions';
import StatsigStore from './StatsigStore';
import { StatsigUser } from './StatsigUser';
import StatsigAsyncStorage from './utils/StatsigAsyncStorage';
import type { AsyncStorage } from './utils/StatsigAsyncStorage';

const MAX_VALUE_SIZE = 64;
const MAX_OBJ_SIZE = 1024;

import type { AppState, AppStateStatus } from 'react-native';

export type _SDKPackageInfo = {
  sdkType: string;
  sdkVersion: string;
};

export interface IStatsig {
  initializeAsync(): Promise<void>;
  checkGate(gateName: string, ignoreOverrides?: boolean): boolean;
  getConfig(configName: string, ignoreOverrides?: boolean): DynamicConfig;
  getExperiment(
    experimentName: string,
    keepDeviceValue?: boolean,
    ignoreOverrides?: boolean,
  ): DynamicConfig;
  logEvent(
    eventName: string,
    value?: string | number | null,
    metadata?: Record<string, string> | null,
  ): void;
  updateUser(user: StatsigUser | null): Promise<boolean>;
  shutdown(): void;
  overrideGate(gateName: string, value: boolean): void;
  overrideConfig(gateName: string, value: Record<string, any>): void;
  removeGateOverride(gateName?: string): void;
  removeConfigOverride(configName?: string): void;
  getAllOverrides(): StatsigOverrides;
  getStableID(): string;

  // DEPRECATED
  removeOverride(overrideName?: string | null): void;
  getOverrides(): Record<string, any>;
}

export interface IHasStatsigInternal {
  getNetwork(): StatsigNetwork;
  getStore(): StatsigStore;
  getLogger(): StatsigLogger;
  getOptions(): StatsigSDKOptions;
  getCurrentUser(): StatsigUser | null;
  getSDKKey(): string;
  getStatsigMetadata(): Record<string, string | number>;
}

export type StatsigOverrides = {
  gates: Record<string, boolean>;
  configs: Record<string, Record<string, any>>;
};

export default class StatsigClient implements IHasStatsigInternal, IStatsig {
  // RN dependencies
  private static reactNativeUUID?: UUID;
  private appState: AppState | null = null;
  private currentAppState: AppStateStatus | null = null;

  private ready: boolean;
  private initCalled: boolean = false;
  private pendingInitPromise: Promise<void> | null = null;

  private network: StatsigNetwork;
  public getNetwork(): StatsigNetwork {
    return this.network;
  }

  private store: StatsigStore;
  public getStore(): StatsigStore {
    return this.store;
  }

  private logger: StatsigLogger;
  public getLogger(): StatsigLogger {
    return this.logger;
  }

  private options: StatsigSDKOptions;
  public getOptions(): StatsigSDKOptions {
    return this.options;
  }

  private sdkKey: string | null;
  public getSDKKey(): string {
    if (this.sdkKey == null) {
      return '';
    }
    return this.sdkKey;
  }

  private identity: StatsigIdentity;
  public getCurrentUser(): StatsigUser | null {
    return this.identity.getUser();
  }
  public getStatsigMetadata(): Record<string, string | number> {
    return this.identity.getStatsigMetadata();
  }

  public constructor(
    sdkKey: string,
    user?: StatsigUser | null,
    options?: StatsigOptions | null,
  ) {
    if (typeof sdkKey !== 'string' || !sdkKey.startsWith('client-')) {
      throw new Error(
        'Invalid key provided.  You must use a Client SDK Key from the Statsig console to initialize the sdk',
      );
    }
    this.ready = false;
    this.sdkKey = sdkKey;
    this.options = new StatsigSDKOptions(options);
    this.identity = new StatsigIdentity(
      this.normalizeUser(user ?? null),
      this.options.getOverrideStableID(),
      StatsigClient.reactNativeUUID,
    );
    this.network = new StatsigNetwork(this);
    this.store = new StatsigStore(this);
    this.logger = new StatsigLogger(this);
  }

  public async initializeAsync(): Promise<void> {
    if (this.pendingInitPromise != null) {
      return this.pendingInitPromise;
    }
    if (this.ready) {
      return Promise.resolve();
    }
    this.initCalled = true;
    if (StatsigAsyncStorage.asyncStorage) {
      await this.identity.initAsync();
      await this.store.loadFromAsyncStorage();
    }

    if (this.appState) {
      this.currentAppState = this.appState.currentState;
      this.appState.addEventListener('change', this.handleAppStateChange);
    }

    this.pendingInitPromise = this.network
      .fetchValues(
        this.identity.getUser(),
        async (json: Record<string, any>): Promise<void> => {
          await this.store.save(json);
          return;
        },
        (e: Error) => {},
      )
      .finally(async () => {
        this.pendingInitPromise = null;
        this.ready = true;
        this.logger.sendSavedRequests();
      });
    return this.pendingInitPromise;
  }

  /**
   * Checks the value of a gate for the current user
   * @param {string} gateName - the name of the gate to check
   * @returns {boolean} - value of a gate for the user. Gates are "off" (return false) by default
   * @throws Error if initialize() is not called first, or gateName is not a string
   */
  public checkGate(
    gateName: string,
    ignoreOverrides: boolean = false,
  ): boolean {
    this.ensureStoreLoaded();
    if (typeof gateName !== 'string' || gateName.length === 0) {
      throw new Error('Must pass a valid string as the gateName.');
    }
    return this.store.checkGate(gateName, ignoreOverrides);
  }

  /**
   * Checks the value of a config for the current user
   * @param {string} configName - the name of the config to get
   * @returns {DynamicConfig} - value of a config for the user
   * @throws Error if initialize() is not called first, or configName is not a string
   */
  public getConfig(
    configName: string,
    ignoreOverrides: boolean = false,
  ): DynamicConfig {
    this.ensureStoreLoaded();
    if (typeof configName !== 'string' || configName.length === 0) {
      throw new Error('Must pass a valid string as the configName.');
    }

    return this.store.getConfig(configName, ignoreOverrides);
  }

  /**
   * Gets the experiment for a given user
   * @param {string} experimentName - the name of the experiment to get
   * @returns {DynamicConfig} - value of the experiment for the user, represented by a Dynamic Config object
   * @throws Error if initialize() is not called first, or experimentName is not a string
   */
  public getExperiment(
    experimentName: string,
    keepDeviceValue: boolean = false,
    ignoreOverrides: boolean = false,
  ): DynamicConfig {
    this.ensureStoreLoaded();
    if (typeof experimentName !== 'string' || experimentName.length === 0) {
      throw new Error('Must pass a valid string as the experimentName.');
    }
    return this.store.getExperiment(
      experimentName,
      keepDeviceValue,
      ignoreOverrides,
    );
  }

  public logEvent(
    eventName: string,
    value: string | number | null = null,
    metadata: Record<string, string> | null = null,
  ): void {
    if (!this.logger || !this.sdkKey) {
      throw new Error('Must initialize() before logging events.');
    }
    if (typeof eventName !== 'string' || eventName.length === 0) {
      console.error('Event not logged. No valid eventName passed.');
      return;
    }
    if (this.shouldTrimParam(eventName, MAX_VALUE_SIZE)) {
      console.warn(
        'eventName is too long, trimming to ' + MAX_VALUE_SIZE + ' characters.',
      );
      eventName = eventName.substring(0, MAX_VALUE_SIZE);
    }
    if (
      typeof value === 'string' &&
      this.shouldTrimParam(value, MAX_VALUE_SIZE)
    ) {
      console.warn('value is too long, trimming to ' + MAX_VALUE_SIZE + '.');
      value = value.substring(0, MAX_VALUE_SIZE);
    }
    if (this.shouldTrimParam(metadata, MAX_OBJ_SIZE)) {
      console.warn('metadata is too big. Dropping the metadata.');
      metadata = { error: 'not logged due to size too large' };
    }
    const event = new LogEvent(eventName);
    event.setValue(value);
    event.setMetadata(metadata);
    event.setUser(this.getCurrentUser());
    this.logger.log(event);
  }

  public async updateUser(user: StatsigUser | null): Promise<boolean> {
    if (!this.initCalled) {
      throw new Error('Call initialize() first.');
    }
    if (this.pendingInitPromise != null) {
      await this.pendingInitPromise;
    }

    const normalizedUser = this.normalizeUser(user);
    this.identity.updateUser(normalizedUser);
    this.store.updateUser(normalizedUser.userID ?? null);
    this.pendingInitPromise = this.network
      .fetchValues(
        this.identity.getUser(),
        async (json: Record<string, any>): Promise<void> => {
          await this.store.save(json);
        },
        (e: Error) => {
          throw e;
        },
      )
      .finally(() => {
        this.pendingInitPromise = null;
      });
    return this.pendingInitPromise
      .then(() => {
        return Promise.resolve(true);
      })
      .catch(() => {
        return Promise.resolve(false);
      });
  }

  /**
   * Informs the statsig SDK that the client is closing or shutting down
   * so the SDK can clean up internal state
   */
  public shutdown(): void {
    this.logger.flush(true);
    if (this.appState) {
      this.appState.removeEventListener('change', this.handleAppStateChange);
    }
  }

  /**
   * Stores a local gate override
   * @param gateName the gate to override
   * @param value the value to override the gate to
   */
  public overrideGate(gateName: string, value: boolean): void {
    this.ensureStoreLoaded();
    this.store.overrideGate(gateName, value);
  }

  /**
   * Stores a local config override
   * @param gateName the config to override
   * @param value the json value to override the config to
   */
  public overrideConfig(configName: string, value: Record<string, any>): void {
    this.ensureStoreLoaded();
    this.store.overrideConfig(configName, value);
  }

  /**
   * Removes the given gate override
   * @param gateName
   */
  public removeGateOverride(gateName?: string): void {
    this.ensureStoreLoaded();
    this.store.removeGateOverride(gateName);
  }

  /**
   * Removes the given config override
   * @param configName
   */
  public removeConfigOverride(configName?: string): void {
    this.ensureStoreLoaded();
    this.store.removeConfigOverride(configName);
  }

  /**
   * @deprecated - use removeGateOverride or removeConfig override
   * Removes the given gate override
   * @param gateName
   */
  public removeOverride(gateName?: string): void {
    this.ensureStoreLoaded();
    this.store.removeGateOverride(gateName);
  }

  /**
   * @deprecated - use getAllOverrides to get gate and config overrides
   * @returns Gate overrides
   */
  public getOverrides(): Record<string, any> {
    this.ensureStoreLoaded();
    return this.store.getAllOverrides().gates;
  }

  /**
   * @returns The local gate and config overrides
   */
  public getAllOverrides(): StatsigOverrides {
    this.ensureStoreLoaded();
    return this.store.getAllOverrides();
  }

  /**
   * @returns The Statsig stable ID used for device level experiments
   */
  public getStableID(): string {
    return this.identity.getStatsigMetadata().stableID;
  }

  public initializeCalled(): boolean {
    return this.initCalled;
  }

  // All methods below are for the statsig react native SDK internal usage only!
  public setSDKPackageInfo(sdkPackageInfo?: _SDKPackageInfo) {
    if (sdkPackageInfo != null) {
      this.identity.setSDKPackageInfo(sdkPackageInfo);
    }
  }

  public static setAsyncStorage(asyncStorage?: AsyncStorage | null): void {
    if (asyncStorage != null) {
      StatsigAsyncStorage.asyncStorage = asyncStorage;
    }
  }

  public static setReactNativeUUID(uuid?: UUID): void {
    StatsigClient.reactNativeUUID = uuid;
  }

  public setAppState(appState?: AppState | null): void {
    if (appState != null) {
      this.appState = appState;
    }
  }

  public setNativeModules(nativeModules?: NativeModules | null): void {
    if (nativeModules != null) {
      this.identity.setNativeModules(nativeModules);
    }
  }

  public setPlatform(platform?: Platform | null): void {
    if (platform != null) {
      this.identity.setPlatform(platform);
    }
  }

  public setRNDeviceInfo(deviceInfo?: DeviceInfo | null): void {
    if (deviceInfo != null) {
      this.identity.setRNDeviceInfo(deviceInfo);
    }
  }

  public setExpoConstants(expoConstants?: ExpoConstants | null): void {
    if (expoConstants != null) {
      this.identity.setExpoConstants(expoConstants);
    }
  }

  public setExpoDevice(expoDevice?: ExpoDevice | null): void {
    if (expoDevice != null) {
      this.identity.setExpoDevice(expoDevice);
    }
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (
      this.currentAppState === 'active' &&
      nextAppState.match(/inactive|background/)
    ) {
      this.logger.flush(true);
    } else if (
      this.currentAppState?.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      this.logger.sendSavedRequests();
    }
    this.currentAppState = nextAppState;
  }

  private shouldTrimParam(
    entity: string | number | object | null,
    size: number,
  ): boolean {
    if (entity == null) return false;
    if (typeof entity === 'string') return entity.length > size;
    if (typeof entity === 'object') {
      return JSON.stringify(entity).length > size;
    }
    if (typeof entity === 'number') return entity.toString().length > size;
    return false;
  }

  private normalizeUser(user: StatsigUser | null): StatsigUser {
    user = this.trimUserObjIfNeeded(user);
    if (this.options.getEnvironment() != null) {
      // @ts-ignore
      user.statsigEnvironment = this.options.getEnvironment();
    }
    return user;
  }

  private trimUserObjIfNeeded(user: StatsigUser | null): StatsigUser {
    if (user == null) {
      return {};
    }
    if (this.shouldTrimParam(user.userID ?? null, MAX_VALUE_SIZE)) {
      console.warn(
        'User ID is too large, trimming to ' + MAX_VALUE_SIZE + 'characters',
      );
      user.userID = user.userID?.toString().substring(0, MAX_VALUE_SIZE);
    }
    if (this.shouldTrimParam(user, MAX_OBJ_SIZE)) {
      user.custom = {};
      if (this.shouldTrimParam(user, MAX_OBJ_SIZE)) {
        console.warn('User object is too large, only keeping the user ID.');
        user = { userID: user.userID };
      } else {
        console.warn('User object is too large, dropping the custom property.');
      }
    }
    return user;
  }

  private ensureStoreLoaded(): void {
    if (!this.store.isLoaded()) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
  }
}

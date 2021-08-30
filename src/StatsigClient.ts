import DynamicConfig from './DynamicConfig';
import LogEvent from './LogEvent';
import StatsigIdentity from './StatsigIdentity';
import StatsigLogger from './StatsigLogger';
import StatsigNetwork from './StatsigNetwork';
import StatsigSDKOptions, { StatsigOptions } from './StatsigSDKOptions';
import StatsigStore from './StatsigStore';
import { StatsigUser } from './StatsigUser';
import StatsigAsyncStorage from './utils/StatsigAsyncLocalStorage';
import type { AsyncStorage } from './utils/StatsigAsyncLocalStorage';
import type {
  NativeModules,
  Platform,
  DeviceInfo,
  ExpoConstants,
  ExpoDevice,
} from './StatsigIdentity';

const MAX_VALUE_SIZE = 64;
const MAX_OBJ_SIZE = 1024;

export type AppState = {
  currentState: AppStateStatus;
  addEventListener: (
    event: string,
    handler: (newState: string) => void,
  ) => void;
  removeEventListener: (
    event: string,
    handler: (newState: string) => void,
  ) => void;
};

export type AppStateStatus = string;

export type _SDKPackageInfo = {
  sdkType: string;
  sdkVersion: string;
};

export interface IHasStatsigInternal {
  getNetwork(): StatsigNetwork;
  getStore(): StatsigStore;
  getLogger(): StatsigLogger;
  getOptions(): StatsigSDKOptions;
  getCurrentUser(): object | null;
  getSDKKey(): string;
  getStatsigMetadata(): Record<string, string | number>;
}

export default class StatsigClient implements IHasStatsigInternal {
  // RN dependencies
  private appState: AppState | null = null;
  private currentAppState: AppStateStatus | null = null;

  private ready: boolean;
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

  public constructor() {
    this.ready = false;
    this.sdkKey = null;
    this.network = new StatsigNetwork(this);
    this.store = new StatsigStore(this);
    this.logger = new StatsigLogger(this);
    this.options = new StatsigSDKOptions();
    this.identity = new StatsigIdentity();
  }

  public async initializeAsync(
    sdkKey: string,
    user?: StatsigUser | null,
    options?: StatsigOptions | null,
  ): Promise<void> {
    if (this.pendingInitPromise != null) {
      return this.pendingInitPromise;
    }
    if (this.ready) {
      return Promise.resolve();
    }
    this.sdkKey = sdkKey;
    this.identity.setUser(this.normalizeUser(user ?? null));
    this.options = new StatsigSDKOptions(options);
    this.store.loadFromLocalStorage();
    // TODO fetch from async storage first

    if (this.appState) {
      this.currentAppState = this.appState.currentState;
      this.appState.addEventListener('change', this.handleAppStateChange);
    }

    this.pendingInitPromise = this.network
      .fetchValues(
        this.identity.getUser(),
        (json: Record<string, any>): void => {
          this.store.save(json);
          return;
        },
        (e: Error) => {},
      )
      .finally(() => {
        this.pendingInitPromise = null;
        this.logger.sendLocalStorageRequests();
        this.ready = true;
      });
    return this.pendingInitPromise;
  }

  public checkGate(gateName: string): boolean {
    if (!this.ready) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    return this.store.checkGate(gateName);
  }

  public getConfig(configName: string): DynamicConfig {
    if (!this.ready) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    return this.store.getConfig(configName);
  }

  public getExperiment(experimentName: string): DynamicConfig {
    if (!this.ready) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    return this.store.getConfig(experimentName);
  }

  public logEvent(
    eventName: string,
    value: string | number | null = null,
    metadata: Record<string, string> | null = null,
  ): void {
    if (!this.ready) {
      throw new Error('Call and wait for initialize() to finish first.');
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

  public updateUser(user: StatsigUser | null): Promise<boolean> {
    if (!this.ready) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    this.identity.updateUser(this.normalizeUser(user));
    this.pendingInitPromise = this.network
      .fetchValues(
        this.identity.getUser(),
        (json: Record<string, any>): void => {
          this.store.save(json);
        },
        (e: Error) => {
          throw e;
        },
      )
      .finally(() => {
        this.pendingInitPromise = null;
        this.ready = true;
      });
    return this.pendingInitPromise
      .then(() => {
        return Promise.resolve(true);
      })
      .catch(() => {
        return Promise.resolve(false);
      });
  }

  public shutdown(): void {
    this.logger.flush(true);
    if (this.appState) {
      this.appState.removeEventListener('change', this.handleAppStateChange);
    }
  }

  public overrideGate(gateName: string, value: boolean): void {
    this.store.overrideGate(gateName, value);
  }

  public removeOverride(name?: string): void {
    this.store.removeOverride(name);
  }

  public getOverrides(): Record<string, any> {
    return this.store.getOverrides();
  }

  public setSDKPackageInfo(sdkPackageInfo: _SDKPackageInfo) {
    this.identity.setSDKPackageInfo(sdkPackageInfo);
  }

  public setAsyncStorage(asyncStorage: AsyncStorage): void {
    StatsigAsyncStorage.asyncStorage = asyncStorage;
  }

  public setAppState(appState: AppState): void {
    this.appState = appState;
  }

  public setNativeModules(nativeModules: NativeModules): void {
    this.identity.setNativeModules(nativeModules);
  }

  public setPlatform(platform: Platform): void {
    this.identity.setPlatform(platform);
  }

  public setRNDeviceInfo(deviceInfo: DeviceInfo): void {
    this.identity.setRNDeviceInfo(deviceInfo);
  }

  public setExpoConstants(expoConstants: ExpoConstants): void {
    this.identity.setExpoConstants(expoConstants);
  }

  public setExpoDevice(expoDevice: ExpoDevice): void {
    this.identity.setExpoDevice(expoDevice);
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
      this.logger.sendLocalStorageRequests();
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
    // @ts-ignore
    user.statsigEnvironment = this.options.getEnvironment();
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
}

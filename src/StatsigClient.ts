import DynamicConfig from './DynamicConfig';
import Layer from './Layer';
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
import StatsigStore, {
  EvaluationDetails,
  EvaluationReason,
} from './StatsigStore';
import { StatsigUser } from './StatsigUser';
import { SimpleHash } from './utils/Hashing';
import StatsigAsyncStorage from './utils/StatsigAsyncStorage';
import type { AsyncStorage } from './utils/StatsigAsyncStorage';
import StatsigLocalStorage from './utils/StatsigLocalStorage';
import {
  StatsigInvalidArgumentError,
  StatsigUninitializedError,
} from './Errors';
import ErrorBoundary from './ErrorBoundary';

const MAX_VALUE_SIZE = 64;
const MAX_OBJ_SIZE = 2048;

export type AppStateEvent = 'change' | 'memoryWarning' | 'blur' | 'focus';
export type AppStateStatus =
  | 'active'
  | 'background'
  | 'inactive'
  | 'unknown'
  | 'extension';

export type AppState = {
  currentState: AppStateStatus;
  addEventListener: (
    event: AppStateEvent,
    handler: (newState: AppStateStatus) => void,
  ) => void;
  removeEventListener: (
    event: AppStateEvent,
    handler: (newState: AppStateStatus) => void,
  ) => void;
};

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
  getCurrentUserCacheKey(): string;
  getSDKKey(): string;
  getStatsigMetadata(): Record<string, string | number>;
  getErrorBoundary(): ErrorBoundary;
  getSDKType(): string;
  getSDKVersion(): string;
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
  private optionalLoggingSetup: boolean = false;

  private errorBoundary: ErrorBoundary;
  public getErrorBoundary(): ErrorBoundary {
    return this.errorBoundary;
  }

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
  public getCurrentUserCacheKey(): string {
    let key = `userID:${String(
      this.identity.getUser()?.userID ?? '',
    )};stableID:${this.getStableID()}`;

    const customIDs = this.identity.getUser()?.customIDs;
    if (customIDs != null) {
      for (const [type, value] of Object.entries(customIDs)) {
        key += `;${type}:${value}`;
      }
    }

    return SimpleHash(key);
  }

  public getStatsigMetadata(): Record<string, string | number> {
    return this.identity.getStatsigMetadata();
  }

  public getSDKType(): string {
    return this.identity.getSDKType();
  }

  public getSDKVersion(): string {
    return this.identity.getSDKVersion();
  }

  public constructor(
    sdkKey: string,
    user?: StatsigUser | null,
    options?: StatsigOptions | null,
  ) {
    if (typeof sdkKey !== 'string' || !sdkKey.startsWith('client-')) {
      throw new StatsigInvalidArgumentError(
        'Invalid key provided.  You must use a Client SDK Key from the Statsig console to initialize the sdk',
      );
    }
    this.errorBoundary = new ErrorBoundary(sdkKey);
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
    if (options?.initializeValues != null) {
      this.setInitializeValues(options?.initializeValues);
    }

    this.errorBoundary.setStatsigMetadata(this.getStatsigMetadata());
  }

  public setInitializeValues(initializeValues: Record<string, unknown>): void {
    this.errorBoundary.capture(
      'setInitializeValues',
      () => {
        this.store.bootstrap(initializeValues);
        if (!this.ready) {
          // the sdk is usable and considered initialized when configured
          // with initializeValues
          this.ready = true;
          this.initCalled = true;
        }
        // we wont have access to window/document/localStorage if these run on the server
        // so try to run whenever this is called
        this.handleOptionalLogging();
        this.logger.sendSavedRequests();
      },
      () => {
        this.ready = true;
        this.initCalled = true;
      },
    );
  }

  public async initializeAsync(): Promise<void> {
    return this.errorBoundary.capture(
      'initializeAsync',
      async () => {
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

        if (
          this.appState &&
          this.appState.addEventListener &&
          typeof this.appState.addEventListener === 'function'
        ) {
          this.currentAppState = this.appState.currentState;
          this.appState.addEventListener(
            'change',
            this.handleAppStateChange.bind(this),
          );
        }

        if (this.options.getLocalModeEnabled()) {
          return Promise.resolve();
        }

        this.pendingInitPromise = this.network
          .fetchValues(
            this.identity.getUser(),
            this.options.getInitTimeoutMs(),
            async (json: Record<string, any>): Promise<void> => {
              await this.store.save(json);
              return;
            },
            (e: Error) => {},
          )
          .catch((e) => {})
          .finally(async () => {
            this.pendingInitPromise = null;
            this.ready = true;
            this.logger.sendSavedRequests();
          });

        this.handleOptionalLogging();
        return this.pendingInitPromise;
      },
      () => {
        this.ready = true;
        this.initCalled = true;
        return Promise.resolve();
      },
    );
  }

  public getEvaluationDetails(): EvaluationDetails {
    return this.store.getGlobalEvaluationDetails();
  }

  /**
   * Checks the value of a gate for the current user
   * @param {string} gateName - the name of the gate to check
   * @param {boolean} ignoreOverrides = false if this check should ignore local overrides
   * @returns {boolean} - value of a gate for the user. Gates are "off" (return false) by default
   * @throws Error if initialize() is not called first, or gateName is not a string
   */
  public checkGate(
    gateName: string,
    ignoreOverrides: boolean = false,
  ): boolean {
    return this.errorBoundary.capture(
      'checkGate',
      () => {
        this.ensureStoreLoaded();
        if (typeof gateName !== 'string' || gateName.length === 0) {
          throw new StatsigInvalidArgumentError(
            'Must pass a valid string as the gateName.',
          );
        }
        return this.store.checkGate(gateName, ignoreOverrides);
      },
      () => false,
    );
  }

  /**
   * Checks the value of a config for the current user
   * @param {string} configName - the name of the config to get
   * @param {boolean} ignoreOverrides = false if this check should ignore local overrides
   * @returns {DynamicConfig} - value of a config for the user
   * @throws Error if initialize() is not called first, or configName is not a string
   */
  public getConfig(
    configName: string,
    ignoreOverrides: boolean = false,
  ): DynamicConfig {
    return this.errorBoundary.capture(
      'getConfig',
      () => {
        this.ensureStoreLoaded();
        if (typeof configName !== 'string' || configName.length === 0) {
          throw new StatsigInvalidArgumentError(
            'Must pass a valid string as the configName.',
          );
        }

        return this.store.getConfig(configName, ignoreOverrides);
      },
      () =>
        new DynamicConfig(
          configName,
          {},
          '',
          this.getEvalutionDetailsForError(),
        ),
    );
  }

  /**
   * Gets the experiment for a given user
   * @param {string} experimentName - the name of the experiment to get
   * @param {boolean} keepDeviceValue = false if this should use "sticky" values persisted in local storage
   * @param {boolean} ignoreOverrides = false if this check should ignore local overrides
   * @returns {DynamicConfig} - value of the experiment for the user, represented by a Dynamic Config object
   * @throws Error if initialize() is not called first, or experimentName is not a string
   */
  public getExperiment(
    experimentName: string,
    keepDeviceValue: boolean = false,
    ignoreOverrides: boolean = false,
  ): DynamicConfig {
    return this.errorBoundary.capture(
      'getExperiment',
      () => {
        this.ensureStoreLoaded();
        if (typeof experimentName !== 'string' || experimentName.length === 0) {
          throw new StatsigInvalidArgumentError(
            'Must pass a valid string as the experimentName.',
          );
        }
        return this.store.getExperiment(
          experimentName,
          keepDeviceValue,
          ignoreOverrides,
        );
      },
      () =>
        new DynamicConfig(
          experimentName,
          {},
          '',
          this.getEvalutionDetailsForError(),
        ),
    );
  }

  public getLayer(layerName: string, keepDeviceValue: boolean = false): Layer {
    return this.errorBoundary.capture(
      'getLayer',
      () => {
        this.ensureStoreLoaded();
        if (typeof layerName !== 'string' || layerName.length === 0) {
          throw new StatsigInvalidArgumentError(
            'Must pass a valid string as the layerName.',
          );
        }

        return this.store.getLayer(layerName, keepDeviceValue);
      },
      () =>
        Layer._create(layerName, {}, '', this.getEvalutionDetailsForError()),
    );
  }

  public logEvent(
    eventName: string,
    value: string | number | null = null,
    metadata: Record<string, string> | null = null,
  ): void {
    this.errorBoundary.swallow('logEvent', () => {
      if (!this.logger || !this.sdkKey) {
        throw new StatsigUninitializedError(
          'Must initialize() before logging events.',
        );
      }
      if (typeof eventName !== 'string' || eventName.length === 0) {
        console.error('Event not logged. No valid eventName passed.');
        return;
      }
      if (this.shouldTrimParam(eventName, MAX_VALUE_SIZE)) {
        console.warn(
          'eventName is too long, trimming to ' +
            MAX_VALUE_SIZE +
            ' characters.',
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
    });
  }

  public async updateUser(user: StatsigUser | null): Promise<boolean> {
    return this.errorBoundary.capture(
      'updateUser',
      async () => {
        if (!this.initializeCalled()) {
          throw new StatsigUninitializedError('Call initialize() first.');
        }

        this.identity.updateUser(this.normalizeUser(user));
        this.store.updateUser();
        this.logger.resetDedupeKeys();

        const currentUser = this.identity.getUser();

        if (this.pendingInitPromise != null) {
          await this.pendingInitPromise;
        }

        if (this.options.getLocalModeEnabled()) {
          return Promise.resolve(true);
        }

        this.pendingInitPromise = this.network
          .fetchValues(
            currentUser,
            this.options.getInitTimeoutMs(),
            async (json: Record<string, any>): Promise<void> => {
              await this.store.save(json);
            },
            (e: Error) => {},
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
      },
      () => Promise.resolve(false),
    );
  }

  /**
   * Informs the statsig SDK that the client is closing or shutting down
   * so the SDK can clean up internal state
   */
  public shutdown(): void {
    this.errorBoundary.swallow('shutdown', () => {
      this.logger.flush(true);
      if (
        this.appState &&
        this.appState.removeEventListener &&
        typeof this.appState.removeEventListener === 'function'
      ) {
        this.appState.removeEventListener(
          'change',
          this.handleAppStateChange.bind(this),
        );
      }
      StatsigLocalStorage.cleanup();
    });
  }

  /**
   * Stores a local gate override
   * @param gateName the gate to override
   * @param value the value to override the gate to
   */
  public overrideGate(gateName: string, value: boolean): void {
    this.errorBoundary.swallow('overrideGate', () => {
      this.ensureStoreLoaded();
      this.store.overrideGate(gateName, value);
    });
  }

  /**
   * Stores a local config override
   * @param gateName the config to override
   * @param value the json value to override the config to
   */
  public overrideConfig(configName: string, value: Record<string, any>): void {
    this.errorBoundary.swallow('overrideConfig', () => {
      this.ensureStoreLoaded();
      this.store.overrideConfig(configName, value);
    });
  }

  /**
   * Removes the given gate override
   * @param gateName
   */
  public removeGateOverride(gateName?: string): void {
    this.errorBoundary.swallow('removeGateOverride', () => {
      this.ensureStoreLoaded();
      this.store.removeGateOverride(gateName);
    });
  }

  /**
   * Removes the given config override
   * @param configName
   */
  public removeConfigOverride(configName?: string): void {
    this.errorBoundary.swallow('removeConfigOverride', () => {
      this.ensureStoreLoaded();
      this.store.removeConfigOverride(configName);
    });
  }

  /**
   * @deprecated - use removeGateOverride or removeConfig override
   * Removes the given gate override
   * @param gateName
   */
  public removeOverride(gateName?: string): void {
    this.errorBoundary.swallow('removeOverride', () => {
      this.ensureStoreLoaded();
      this.store.removeGateOverride(gateName);
    });
  }

  /**
   * @deprecated - use getAllOverrides to get gate and config overrides
   * @returns Gate overrides
   */
  public getOverrides(): Record<string, any> {
    return this.errorBoundary.capture(
      'getOverrides',
      () => {
        this.ensureStoreLoaded();
        return this.store.getAllOverrides().gates;
      },
      () => ({}),
    );
  }

  /**
   * @returns The local gate and config overrides
   */
  public getAllOverrides(): StatsigOverrides {
    return this.errorBoundary.capture(
      'getAllOverrides',
      () => {
        this.ensureStoreLoaded();
        return this.store.getAllOverrides();
      },
      () => ({ gates: {}, configs: {} }),
    );
  }

  /**
   * @returns The Statsig stable ID used for device level experiments
   */
  public getStableID(): string {
    return this.errorBoundary.capture(
      'getStableID',
      () => this.identity.getStatsigMetadata().stableID,
      () => '',
    );
  }

  public initializeCalled(): boolean {
    return this.initCalled;
  }

  // All methods below are for the statsig react native SDK internal usage only!
  public setSDKPackageInfo(sdkPackageInfo?: _SDKPackageInfo) {
    if (sdkPackageInfo != null) {
      this.identity.setSDKPackageInfo(sdkPackageInfo);
      this.errorBoundary.setStatsigMetadata(this.getStatsigMetadata());
    }
  }

  public static setAsyncStorage(asyncStorage?: AsyncStorage | null): void {
    if (asyncStorage != null) {
      StatsigAsyncStorage.asyncStorage = asyncStorage;
    }
  }

  public static setReactNativeUUID(uuid?: UUID | null): void {
    if (uuid != null) {
      StatsigClient.reactNativeUUID = uuid;
    }
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

  private handleOptionalLogging(): void {
    if (typeof window === 'undefined' || !window || !window.addEventListener) {
      return;
    }
    if (this.optionalLoggingSetup) {
      return;
    }
    const user = this.identity.getUser();
    if (!this.options.getDisableErrorLogging()) {
      window.addEventListener('error', (e) => {
        let errorObj = e.error;
        if (errorObj != null && typeof errorObj === 'object') {
          try {
            errorObj = JSON.stringify(errorObj);
          } catch (e) {}
        }
        this.logger.logAppError(user, e.message ?? '', {
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          error_obj: errorObj,
        });
      });
    }
    if (!this.options.getDisableAutoMetricsLogging()) {
      if (
        typeof document === 'undefined' ||
        !document ||
        typeof setTimeout === 'undefined' ||
        !setTimeout
      ) {
        return;
      }

      const work = () => {
        setTimeout(() => {
          this.logger.logAppMetrics(user);
        }, 1000);
      };

      if (document.readyState === 'complete') {
        work();
      } else {
        window.addEventListener('load', () => work());
      }
    }
    this.optionalLoggingSetup = true;
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
    let userCopy = JSON.parse(JSON.stringify(user));
    userCopy = this.trimUserObjIfNeeded(userCopy);
    if (this.options.getEnvironment() != null) {
      // @ts-ignore
      userCopy.statsigEnvironment = this.options.getEnvironment();
    }
    return userCopy;
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
      throw new StatsigUninitializedError(
        'Call and wait for initialize() to finish first.',
      );
    }
  }

  private getEvalutionDetailsForError(): EvaluationDetails {
    return {
      time: Date.now(),
      reason: EvaluationReason.Error,
    };
  }
}

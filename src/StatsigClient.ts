import DynamicConfig from './DynamicConfig';
import ErrorBoundary from './ErrorBoundary';
import {
  StatsigInvalidArgumentError,
  StatsigUninitializedError,
} from './Errors';
import Layer, { LogParameterFunction } from './Layer';
import LogEvent from './LogEvent';
import type {
  DeviceInfo,
  ExpoConstants,
  ExpoDevice,
  NativeModules,
  Platform,
} from './StatsigIdentity';
import StatsigIdentity, { UUID } from './StatsigIdentity';
import StatsigLogger from './StatsigLogger';
import StatsigNetwork from './StatsigNetwork';
import StatsigSDKOptions, { StatsigOptions } from './StatsigSDKOptions';
import StatsigStore, {
  EvaluationDetails,
  EvaluationReason,
  StoreGateFetchResult,
} from './StatsigStore';
import { StatsigUser } from './StatsigUser';
import { getUserCacheKey } from './utils/Hashing';
import type { AsyncStorage } from './utils/StatsigAsyncStorage';
import StatsigAsyncStorage from './utils/StatsigAsyncStorage';
import StatsigLocalStorage from './utils/StatsigLocalStorage';
import Diagnostics from './utils/Diagnostics';
import ConsoleLogger from './utils/ConsoleLogger';
import { now } from './utils/Timing';

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

/* Should be Record<string, unknown>, but that is a breaking change for React */
/* eslint-disable @typescript-eslint/no-explicit-any */
type LegacyOverrideValue = Record<string, any>;

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
  overrideConfig(gateName: string, value: Record<string, unknown>): void;
  removeGateOverride(gateName?: string): void;
  removeConfigOverride(configName?: string): void;
  getAllOverrides(): StatsigOverrides;
  getStableID(): string;

  // DEPRECATED
  removeOverride(overrideName?: string | null): void;
  getOverrides(): Record<string, unknown>;
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
  getConsoleLogger(): ConsoleLogger;
}

export type StatsigOverrides = {
  gates: Record<string, boolean>;
  configs: Record<string, Record<string, unknown>>;
  layers: Record<string, Record<string, unknown>>;
};

export default class StatsigClient implements IHasStatsigInternal, IStatsig {
  // RN dependencies
  private static reactNativeUUID?: UUID;
  private appState: AppState | null = null;
  private currentAppState: AppStateStatus | null = null;
  private onCacheLoadedForReact: (() => void) | null = null;

  private ready: boolean;
  private initCalled = false;
  private pendingInitPromise: Promise<void> | null = null;
  private optionalLoggingSetup = false;
  private prefetchedUsersByCacheKey: Record<string, StatsigUser> = {};
  private startTime;

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
    return this.errorBoundary.capture(
      'getSDKKey',
      () => {
        return this.sdkKey ?? '';
      },
      () => '',
    );
  }

  private identity: StatsigIdentity;
  public getCurrentUser(): StatsigUser | null {
    return this.errorBoundary.capture(
      'getCurrentUser',
      () => this.identity.getUser(),
      () => null,
    );
  }
  public getCurrentUserCacheKey(): string {
    return this.errorBoundary.capture(
      'getCurrentUserCacheKey',
      () => getUserCacheKey(this.getCurrentUser()),
      () => `userID:''`,
    );
  }

  public getStatsigMetadata(): Record<string, string | number> {
    return this.errorBoundary.capture(
      'getStatsigMetadata',
      () => this.identity.getStatsigMetadata(),
      () => {
        return {};
      },
    );
  }

  public getSDKType(): string {
    return this.errorBoundary.capture(
      'getSDKType',
      () => this.identity.getSDKType(),
      () => '',
    );
  }

  public getSDKVersion(): string {
    return this.errorBoundary.capture(
      'getSDKVersion',
      () => this.identity.getSDKVersion(),
      () => '',
    );
  }

  private consoleLogger: ConsoleLogger;
  public getConsoleLogger(): ConsoleLogger {
    return this.consoleLogger;
  }

  public constructor(
    sdkKey: string,
    user?: StatsigUser | null,
    options?: StatsigOptions | null,
  ) {
    if (
      options?.localMode !== true &&
      (typeof sdkKey !== 'string' || !sdkKey.startsWith('client-'))
    ) {
      throw new StatsigInvalidArgumentError(
        'Invalid key provided.  You must use a Client SDK Key from the Statsig console to initialize the sdk',
      );
    }
    this.startTime = now();
    this.options = new StatsigSDKOptions(options);
    this.logger = new StatsigLogger(this);
    Diagnostics.initialize({
      options: this.options,
    });
    this.errorBoundary = new ErrorBoundary(sdkKey);
    this.ready = false;
    this.sdkKey = sdkKey;
    this.consoleLogger = new ConsoleLogger(this.options.getLogLevel());
    StatsigLocalStorage.disabled = this.options.getDisableLocalStorage();
    this.identity = new StatsigIdentity(
      this.normalizeUser(user ?? null),
      this.options.getOverrideStableID(),
      StatsigClient.reactNativeUUID,
    );

    this.network = new StatsigNetwork(this);
    this.store = new StatsigStore(this, this.options.getInitializeValues());
    this.errorBoundary.setStatsigMetadata(this.getStatsigMetadata());

    if (this.options.getInitializeValues() != null) {
      const cb = this.options.getInitCompletionCallback();
      this.ready = true;
      this.initCalled = true;

      setTimeout(() => this.delayedSetup(), 20);
      this.handleOptionalLogging();
      if (cb) {
        cb(now() - this.startTime, true, null);
      }
    }
  }

  private delayedSetup(): void {
    this.errorBoundary.swallow('delayedSetup', () => {
      if (this.options.getInitializeValues() != null) {
        this.fireAndForgetPrefechUsers();
      }
      this.identity.saveStableID();
      this.logger
        .sendSavedRequests()
        .catch((reason) =>
          this.errorBoundary.logError('sendSavedRequests:delayedSetup', reason),
        );
    });
  }

  public setInitializeValues(initializeValues: Record<string, unknown>): void {
    this.errorBoundary.capture(
      'setInitializeValues',
      () => {
        this.store.bootstrap(initializeValues);
        let cb = null;
        if (!this.ready) {
          // the sdk is usable and considered initialized when configured
          // with initializeValues
          this.ready = true;
          this.initCalled = true;

          // only callback on the first time initialize values are set and the
          // sdk is usable
          cb = this.options.getInitCompletionCallback();
        }
        // we wont have access to window/document/localStorage if these run on the server
        // so try to run whenever this is called
        this.handleOptionalLogging();
        this.logger
          .sendSavedRequests()
          .catch((reason) =>
            this.errorBoundary.logError(
              'sendSavedRequests:setInitializeValues',
              reason,
            ),
          );
        if (cb) {
          cb(now() - this.startTime, true, null);
        }
      },
      () => {
        this.ready = true;
        this.initCalled = true;
        const cb = this.options.getInitCompletionCallback();
        if (cb) {
          cb(
            now() - this.startTime,
            false,
            'Caught an exception during setInitializeValues',
          );
        }
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
        Diagnostics.mark.overall.start({});

        this.initCalled = true;
        if (StatsigAsyncStorage.asyncStorage) {
          await this.identity.initAsync();
          await this.store.loadFromAsyncStorage();
        }

        this.onCacheLoadedForReact?.();

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

        const user = this.identity.getUser();
        this.pendingInitPromise = this.fetchAndSaveValues(
          user,
          this.options.getPrefetchUsers(),
          this.options.getInitTimeoutMs(),
        )
          .then(() => {
            Diagnostics.mark.overall.end({ success: true });
            return { success: true, message: null };
          })
          .catch((e) => {
            this.errorBoundary.logError(
              'initializeAsync:fetchAndSaveValues',
              e,
            );
            Diagnostics.mark.overall.end({ success: false });
            return { success: false, message: e.message };
          })
          .then(({ success, message }) => {
            const cb = this.options.getInitCompletionCallback();
            if (cb) {
              cb(now() - this.startTime, success, message);
            }

            return;
          })
          .finally(async () => {
            this.pendingInitPromise = null;
            this.ready = true;
            this.delayedSetup();
            this.logger.logDiagnostics(user, 'initialize');
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

  public async prefetchUsers(users: StatsigUser[]): Promise<void> {
    return this.errorBoundary.capture(
      'prefetchUsers',
      () => {
        if (!users || users.length == 0) {
          return;
        }

        return this.fetchAndSaveValues(null, users, 0);
      },
      () => {
        return Promise.resolve();
      },
    );
  }

  public getEvaluationDetails(): EvaluationDetails {
    return this.errorBoundary.capture(
      'getEvaluationDetails',
      () => {
        return this.store.getGlobalEvaluationDetails();
      },
      () => {
        return {
          time: Date.now(),
          reason: EvaluationReason.Error,
        };
      },
    );
  }

  /**
   * Checks the value of a gate for the current user
   * @param {string} gateName - the name of the gate to check
   * @param {boolean} ignoreOverrides = false if this check should ignore local overrides
   * @returns {boolean} - value of a gate for the user. Gates are "off" (return false) by default
   * @throws Error if initialize() is not called first, or gateName is not a string
   */
  public checkGate(gateName: string, ignoreOverrides = false): boolean {
    return this.errorBoundary.capture(
      'checkGate',
      () => {
        const result = this.checkGateImpl(gateName, ignoreOverrides);
        this.logGateExposureImpl(gateName, result);
        const cb = this.options.getGateEvaluationCallback();
        if (cb) {
          cb(gateName, result.gate.value, {
            withExposureLoggingDisabled: false,
          });
        }
        return result.gate.value === true;
      },
      () => false,
    );
  }

  public checkGateWithExposureLoggingDisabled(
    gateName: string,
    ignoreOverrides = false,
  ): boolean {
    return this.errorBoundary.capture(
      'checkGateWithExposureLoggingDisabled',
      () => {
        const result = this.checkGateImpl(gateName, ignoreOverrides);
        const cb = this.options.getGateEvaluationCallback();
        if (cb) {
          cb(gateName, result.gate.value, {
            withExposureLoggingDisabled: true,
          });
        }
        return result.gate.value === true;
      },
      () => false,
    );
  }

  public logGateExposure(gateName: string) {
    this.errorBoundary.swallow('logGateExposure', () => {
      this.logGateExposureImpl(gateName);
    });
  }

  /**
   * Checks the value of a config for the current user
   * @param {string} configName - the name of the config to get
   * @param {boolean} ignoreOverrides = false if this check should ignore local overrides
   * @returns {DynamicConfig} - value of a config for the user
   * @throws Error if initialize() is not called first, or configName is not a string
   */
  public getConfig(configName: string, ignoreOverrides = false): DynamicConfig {
    return this.errorBoundary.capture(
      'getConfig',
      () => {
        const result = this.getConfigImpl(configName, ignoreOverrides);
        this.logConfigExposureImpl(configName, result);
        return result;
      },
      () => this.getEmptyConfig(configName),
    );
  }

  public getConfigWithExposureLoggingDisabled(
    configName: string,
    ignoreOverrides = false,
  ): DynamicConfig {
    return this.errorBoundary.capture(
      'getConfig',
      () => {
        return this.getConfigImpl(configName, ignoreOverrides);
      },
      () => this.getEmptyConfig(configName),
    );
  }

  public logConfigExposure(configName: string) {
    this.errorBoundary.swallow('logConfigExposure', () => {
      this.logConfigExposureImpl(configName);
    });
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
    keepDeviceValue = false,
    ignoreOverrides = false,
  ): DynamicConfig {
    return this.errorBoundary.capture(
      'getExperiment',
      () => {
        const result = this.getExperimentImpl(
          experimentName,
          keepDeviceValue,
          ignoreOverrides,
        );
        this.logExperimentExposureImpl(experimentName, keepDeviceValue, result);
        return result;
      },
      () => this.getEmptyConfig(experimentName),
    );
  }

  public getExperimentWithExposureLoggingDisabled(
    experimentName: string,
    keepDeviceValue = false,
    ignoreOverrides = false,
  ): DynamicConfig {
    return this.errorBoundary.capture(
      'getExperimentWithExposureLoggingDisabled',
      () => {
        return this.getExperimentImpl(
          experimentName,
          keepDeviceValue,
          ignoreOverrides,
        );
      },
      () => this.getEmptyConfig(experimentName),
    );
  }

  public logExperimentExposure(
    experimentName: string,
    keepDeviceValue: boolean,
  ) {
    this.errorBoundary.swallow('logExperimentExposure', () => {
      this.logExperimentExposureImpl(experimentName, keepDeviceValue);
    });
  }

  public getLayer(layerName: string, keepDeviceValue = false): Layer {
    return this.errorBoundary.capture(
      'getLayer',
      () => {
        return this.getLayerImpl(
          this.logLayerParameterExposureForLayer,
          layerName,
          keepDeviceValue,
        );
      },
      () =>
        Layer._create(layerName, {}, '', this.getEvalutionDetailsForError()),
    );
  }

  public getLayerWithExposureLoggingDisabled(
    layerName: string,
    keepDeviceValue = false,
  ): Layer {
    return this.errorBoundary.capture(
      'getLayerWithExposureLoggingDisabled',
      () => {
        return this.getLayerImpl(null, layerName, keepDeviceValue);
      },
      () =>
        Layer._create(layerName, {}, '', this.getEvalutionDetailsForError()),
    );
  }

  public logLayerParameterExposure(
    layerName: string,
    parameterName: string,
    keepDeviceValue = false,
  ) {
    this.errorBoundary.swallow('logLayerParameterExposure', () => {
      const layer = this.getLayerImpl(null, layerName, keepDeviceValue);
      this.logLayerParameterExposureForLayer(layer, parameterName, true);
    });
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
        this.consoleLogger.error(
          'Event not logged. No valid eventName passed.',
        );
        return;
      }
      if (this.shouldTrimParam(eventName, MAX_VALUE_SIZE)) {
        this.consoleLogger.info(
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
        this.consoleLogger.info(
          'value is too long, trimming to ' + MAX_VALUE_SIZE + '.',
        );
        value = value.substring(0, MAX_VALUE_SIZE);
      }
      if (this.shouldTrimParam(metadata, MAX_OBJ_SIZE)) {
        this.consoleLogger.info('metadata is too big. Dropping the metadata.');
        metadata = { error: 'not logged due to size too large' };
      }
      const event = new LogEvent(eventName);
      event.setValue(value);
      event.setMetadata(metadata);
      event.setUser(this.getCurrentUser());
      this.logger.log(event);
    });
  }

  public updateUserWithValues(
    user: StatsigUser | null,
    values: Record<string, unknown>,
  ): boolean {
    // eslint-disable-next-line statsig-linter/public-methods-error-boundary
    const updateStartTime = Date.now();
    // eslint-disable-next-line statsig-linter/public-methods-error-boundary
    let fireCompletionCallback: (
      success: boolean,
      error: string | null,
    ) => void | null;

    return this.errorBoundary.capture(
      'updateUserWithValues',
      () => {
        if (!this.initializeCalled()) {
          throw new StatsigUninitializedError('Call initialize() first.');
        }

        fireCompletionCallback = (success: boolean, error: string | null) => {
          const cb = this.options.getUpdateUserCompletionCallback();
          cb?.(Date.now() - updateStartTime, success, error);
        };

        this.identity.updateUser(this.normalizeUser(user));
        this.store.bootstrap(values);
        fireCompletionCallback(true, null);
        return true;
      },
      () => {
        fireCompletionCallback?.(
          false,
          'Failed to update user. An unexpected error occured.',
        );
        return false;
      },
    );
  }

  public async updateUser(user: StatsigUser | null): Promise<boolean> {
    // eslint-disable-next-line statsig-linter/public-methods-error-boundary
    const updateStartTime = Date.now();
    // eslint-disable-next-line statsig-linter/public-methods-error-boundary
    let fireCompletionCallback: (
      success: boolean,
      error: string | null,
    ) => void | null;

    return this.errorBoundary.capture(
      'updateUser',
      async () => {
        if (!this.initializeCalled()) {
          throw new StatsigUninitializedError('Call initialize() first.');
        }

        fireCompletionCallback = (success: boolean, error: string | null) => {
          const cb = this.options.getUpdateUserCompletionCallback();
          cb?.(Date.now() - updateStartTime, success, error);
        };

        this.identity.updateUser(this.normalizeUser(user));

        const userCacheKey = this.getCurrentUserCacheKey();
        const isUserPrefetched = Boolean(
          this.prefetchedUsersByCacheKey[userCacheKey],
        );
        const cachedTime = this.store.updateUser(isUserPrefetched);

        Diagnostics.clearContext('error_boundary');
        this.logger.resetDedupeKeys();

        if (
          cachedTime != null &&
          (isUserPrefetched || this.isCacheValidForFetchMode(cachedTime))
        ) {
          fireCompletionCallback(true, null);
          return Promise.resolve(true);
        }

        if (this.pendingInitPromise != null) {
          await this.pendingInitPromise;
        }

        if (this.options.getLocalModeEnabled()) {
          fireCompletionCallback(true, null);
          return Promise.resolve(true);
        }

        const currentUser = this.identity.getUser();
        this.pendingInitPromise = this.fetchAndSaveValues(currentUser).finally(
          () => {
            this.pendingInitPromise = null;
          },
        );

        return this.pendingInitPromise
          .then(() => {
            fireCompletionCallback(true, null);
            return Promise.resolve(true);
          })
          .catch((error) => {
            fireCompletionCallback(false, `Failed to update user: ${error}`);
            return Promise.resolve(false);
          });
      },
      () => {
        fireCompletionCallback?.(
          false,
          'Failed to update user. An unexpected error occured.',
        );
        return Promise.resolve(false);
      },
    );
  }

  /**
   * Informs the statsig SDK that the client is closing or shutting down
   * so the SDK can clean up internal state
   */
  public shutdown(): void {
    this.errorBoundary.swallow('shutdown', () => {
      this.logger.shutdown();

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
   * @param configName the config to override
   * @param value the json value to override the config to
   */
  public overrideConfig(configName: string, value: LegacyOverrideValue): void {
    this.errorBoundary.swallow('overrideConfig', () => {
      this.ensureStoreLoaded();
      this.store.overrideConfig(configName, value);
    });
  }

  /**
   * Stores a local layer override
   * @param layerName the layer to override
   * @param value the json value to override the config to
   */
  public overrideLayer(layerName: string, value: LegacyOverrideValue): void {
    this.errorBoundary.swallow('overrideLayer', () => {
      this.ensureStoreLoaded();
      this.store.overrideLayer(layerName, value);
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
   * Removes the given layer override
   * @param layerName
   */
  public removeLayerOverride(layerName?: string): void {
    this.errorBoundary.swallow('removeLayerOverride', () => {
      this.ensureStoreLoaded();
      this.store.removeLayerOverride(layerName);
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
  public getOverrides(): Record<string, unknown> {
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
      () => ({ gates: {}, configs: {}, layers: {} }),
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
  /* eslint-disable statsig-linter/public-methods-error-boundary */
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

  public setOnCacheLoadedReactCallback(fn?: (() => void) | null) {
    this.onCacheLoadedForReact = fn ?? null;
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

  private isCacheValidForFetchMode(cachedTime: number): boolean {
    if (this.options.getFetchMode() !== 'cache-or-network') {
      return false;
    }

    // Only valid if the cache was during this session
    return cachedTime > this.startTime;
  }

  private handleOptionalLogging(): void {
    const isErrorLoggingDisabled = this.options.getDisableErrorLogging();
    const isAutoMetricsLoggingDisabled =
      this.options.getDisableAutoMetricsLogging();

    if (isErrorLoggingDisabled && isAutoMetricsLoggingDisabled) {
      return;
    }

    if (
      this.optionalLoggingSetup ||
      typeof window === 'undefined' ||
      !window ||
      !window.addEventListener
    ) {
      return;
    }

    const user = this.identity.getUser();
    if (!isErrorLoggingDisabled) {
      window.addEventListener('error', (e) => {
        let errorObj = e.error;
        if (errorObj != null && typeof errorObj === 'object') {
          try {
            errorObj = JSON.stringify(errorObj);
          } catch (e) {
            errorObj = 'Failed to stringify Error';
          }
        }
        this.logger.logAppError(user, e.message ?? '', {
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          error_obj: errorObj,
        });
      });
    }

    if (!isAutoMetricsLoggingDisabled) {
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
      this.logger
        .sendSavedRequests()
        .catch((reason) =>
          this.errorBoundary.logError(
            'sendSavedRequests:handleAppStateChange',
            reason,
          ),
        );
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

  private normalizePrefetchUsers(users: StatsigUser[] | null): StatsigUser[] {
    if (users == null) {
      return [];
    }

    return users.map((user) => this.normalizeUser(user));
  }

  private normalizeUser(user: StatsigUser | null): StatsigUser {
    let userCopy: StatsigUser & { statsigEnvironment?: unknown } = {};
    try {
      userCopy = JSON.parse(JSON.stringify(user));
    } catch (error) {
      throw new StatsigInvalidArgumentError(
        'User object must be convertable to JSON string.',
      );
    }

    userCopy = this.trimUserObjIfNeeded(userCopy);
    if (this.options.getEnvironment() != null) {
      userCopy.statsigEnvironment = this.options.getEnvironment();
    }
    return userCopy;
  }

  private trimUserObjIfNeeded(user: StatsigUser | null): StatsigUser {
    if (user == null) {
      return {};
    }
    if (this.shouldTrimParam(user.userID ?? null, MAX_VALUE_SIZE)) {
      this.consoleLogger.info(
        'User ID is too large, trimming to ' + MAX_VALUE_SIZE + 'characters',
      );
      user.userID = user.userID?.toString().substring(0, MAX_VALUE_SIZE);
    }
    if (this.shouldTrimParam(user, MAX_OBJ_SIZE)) {
      user.custom = {};
      if (this.shouldTrimParam(user, MAX_OBJ_SIZE)) {
        this.consoleLogger.info(
          'User object is too large, only keeping the user ID.',
        );
        user = { userID: user.userID };
      } else {
        this.consoleLogger.info(
          'User object is too large, dropping the custom property.',
        );
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

  private async fetchAndSaveValues(
    user: StatsigUser | null,
    prefetchUsers: StatsigUser[] = [],
    timeout: number = this.options.getInitTimeoutMs(),
  ): Promise<void> {
    if (prefetchUsers.length > 5) {
      this.consoleLogger.info('Cannot prefetch more than 5 users.');
    }

    const keyedPrefetchUsers = this.normalizePrefetchUsers(prefetchUsers)
      .slice(0, 5)
      .reduce((acc, curr) => {
        acc[getUserCacheKey(curr)] = curr;
        return acc;
      }, {} as Record<string, StatsigUser>);

    let sinceTime: number | null = null;
    if (prefetchUsers.length === 0) {
      sinceTime = this.store.getLastUpdateTime(user);
    }

    return this.network
      .fetchValues(
        user,
        sinceTime,
        timeout,
        prefetchUsers.length > 0 ? keyedPrefetchUsers : undefined,
      )
      .eventually((json) => {
        if (json?.has_updates) {
          this.store
            .saveWithoutUpdatingClientState(user, json)
            .catch((reason) =>
              this.errorBoundary.logError(
                'fetchAndSaveValues:eventually',
                reason,
              ),
            );
        }
      })
      .then(async (json: Record<string, unknown>) => {
        return this.errorBoundary.swallow('fetchAndSaveValues', async () => {
          Diagnostics.mark.intialize.process.start({});
          if (json?.has_updates) {
            await this.store.save(user, json);
          } else if (json?.is_no_content) {
            this.store.setEvaluationReason(EvaluationReason.NetworkNotModified);
          }

          this.prefetchedUsersByCacheKey = {
            ...this.prefetchedUsersByCacheKey,
            ...keyedPrefetchUsers,
          };
          Diagnostics.mark.intialize.process.end({ success: true });
        });
      });
  }

  private checkGateImpl(
    gateName: string,
    ignoreOverrides: boolean,
  ): StoreGateFetchResult {
    this.ensureStoreLoaded();
    if (typeof gateName !== 'string' || gateName.length === 0) {
      throw new StatsigInvalidArgumentError(
        'Must pass a valid string as the gateName.',
      );
    }
    return this.store.checkGate(gateName, ignoreOverrides);
  }

  private logGateExposureImpl(
    gateName: string,
    fetchResult?: StoreGateFetchResult,
  ) {
    const isManualExposure = !fetchResult;
    const result = fetchResult ?? this.checkGateImpl(gateName, false);
    const gate = result.gate;

    this.logger.logGateExposure(
      this.getCurrentUser(),
      gateName,
      gate.value,
      gate.rule_id,
      gate.secondary_exposures,
      result.evaluationDetails,
      isManualExposure,
    );
  }

  private getConfigImpl(
    configName: string,
    ignoreOverrides: boolean,
  ): DynamicConfig {
    this.ensureStoreLoaded();
    if (typeof configName !== 'string' || configName.length === 0) {
      throw new StatsigInvalidArgumentError(
        'Must pass a valid string as the configName.',
      );
    }

    return this.store.getConfig(configName, ignoreOverrides);
  }

  private logConfigExposureImpl(configName: string, config?: DynamicConfig) {
    const isManualExposure = !config;
    const localConfig = config ?? this.getConfigImpl(configName, false);

    this.logger.logConfigExposure(
      this.getCurrentUser(),
      configName,
      localConfig.getRuleID(),
      localConfig._getSecondaryExposures(),
      localConfig.getEvaluationDetails(),
      isManualExposure,
    );
  }

  private getExperimentImpl(
    experimentName: string,
    keepDeviceValue: boolean,
    ignoreOverrides: boolean,
  ) {
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
  }

  private logExperimentExposureImpl(
    experimentName: string,
    keepDeviceValue: boolean,
    config?: DynamicConfig,
  ) {
    const isManualExposure = !config;
    const localConfig =
      config ?? this.getExperimentImpl(experimentName, keepDeviceValue, false);

    this.logger.logConfigExposure(
      this.getCurrentUser(),
      experimentName,
      localConfig.getRuleID(),
      localConfig._getSecondaryExposures(),
      localConfig.getEvaluationDetails(),
      isManualExposure,
    );
  }

  private getLayerImpl(
    logParameterFunction: LogParameterFunction | null,
    layerName: string,
    keepDeviceValue: boolean,
  ): Layer {
    this.ensureStoreLoaded();
    if (typeof layerName !== 'string' || layerName.length === 0) {
      throw new StatsigInvalidArgumentError(
        'Must pass a valid string as the layerName.',
      );
    }

    return this.store.getLayer(
      logParameterFunction,
      layerName,
      keepDeviceValue,
    );
  }

  private logLayerParameterExposureForLayer = (
    layer: Layer,
    parameterName: string,
    isManualExposure = false,
  ) => {
    let allocatedExperiment = '';
    let exposures = layer._getUndelegatedSecondaryExposures();
    const isExplicit = layer._getExplicitParameters().includes(parameterName);
    if (isExplicit) {
      allocatedExperiment = layer._getAllocatedExperimentName();
      exposures = layer._getSecondaryExposures();
    }

    this.logger.logLayerExposure(
      this.getCurrentUser(),
      layer.getName(),
      layer.getRuleID(),
      exposures,
      allocatedExperiment,
      parameterName,
      isExplicit,
      layer._getEvaluationDetails(),
      isManualExposure,
    );
  };

  private getEmptyConfig(configName: string): DynamicConfig {
    return new DynamicConfig(
      configName,
      {},
      '',
      this.getEvalutionDetailsForError(),
    );
  }

  private fireAndForgetPrefechUsers() {
    this.prefetchUsers(this.options.getPrefetchUsers()).catch(() => {
      /* noop */
    });
  }
}

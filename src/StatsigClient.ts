import DynamicConfig from './DynamicConfig';
import ErrorBoundary from './ErrorBoundary';
import {
  StatsigInvalidArgumentError,
  StatsigUninitializedError,
} from './Errors';
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
import {
  EvaluationDetails,
  EvaluationReason,
} from './StatsigStore';
import { StatsigUser } from './StatsigUser';
import { getUserCacheKey } from './utils/Hashing';
import type { AsyncStorage } from './utils/StatsigAsyncStorage';
import StatsigAsyncStorage from './utils/StatsigAsyncStorage';
import StatsigLocalStorage from './utils/StatsigLocalStorage';
import Diagnostics, {
  DiagnosticsEvent,
  DiagnosticsKey,
} from './utils/Diagnostics';
import ConsoleLogger from './utils/ConsoleLogger';
import Evaluator from './Evaluator';

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
  logEvent(
    eventName: string,
    value?: string | number | null,
    metadata?: Record<string, string> | null,
  ): void;
  shutdown(): void;
  getStableID(): string;
}

export interface IHasStatsigInternal {
  getNetwork(): StatsigNetwork;
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
  configs: Record<string, Record<string, any>>;
  layers: Record<string, Record<string, any>>;
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
  private prefetchedUsersByCacheKey: Record<string, StatsigUser> = {};

  private initializeDiagnostics: Diagnostics;

  private errorBoundary: ErrorBoundary;
  public getErrorBoundary(): ErrorBoundary {
    return this.errorBoundary;
  }

  private network: StatsigNetwork;
  public getNetwork(): StatsigNetwork {
    return this.network;
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
    return getUserCacheKey(this.getCurrentUser());
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

  private consoleLogger: ConsoleLogger;
  public getConsoleLogger(): ConsoleLogger {
    return this.consoleLogger;
  }

  private evaluator: Evaluator;

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
    this.consoleLogger = new ConsoleLogger(this.options.getLogLevel());
    StatsigLocalStorage.disabled = this.options.getDisableLocalStorage();
    this.initializeDiagnostics = new Diagnostics('initialize');
    this.identity = new StatsigIdentity(
      this.normalizeUser(user ?? null),
      this.options.getOverrideStableID(),
      StatsigClient.reactNativeUUID,
    );
    this.network = new StatsigNetwork(this);
    this.logger = new StatsigLogger(this);
    this.evaluator = new Evaluator(options?.localEvaluationConfigs ?? {})

    this.errorBoundary.setStatsigMetadata(this.getStatsigMetadata());
  }

  public async genWebExperiment(experimentName: string): Promise<DynamicConfig> {
    return this.errorBoundary.capture(
      'genWebExperiment',
      async () => {
        const evaluation = await this.evaluator.getConfig(this.identity.getUser() || {}, experimentName);
        const result = new DynamicConfig(
          experimentName,
          evaluation.json_value as Record<string, unknown>,
          evaluation.rule_id,
          evaluation.evaluation_details,
          evaluation.secondary_exposures,
        );
        this.logConfigExposureImpl(experimentName, result);
        return result;
      },
      () => Promise.resolve(this.getEmptyConfig(experimentName)),
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
    if (typeof window === 'undefined' || !window) {
      return;
    }
    if (this.optionalLoggingSetup) {
      return;
    }

    if (!window.addEventListener) {
      return;
    }

    const user = this.identity.getUser();
    if (!this.options.getDisableErrorLogging()) {
      window.addEventListener('error', (e) => {
        let errorObj = e.error;
        if (errorObj != null && typeof errorObj === 'object') {
          try {
            errorObj = JSON.stringify(errorObj);
          } catch (e) { }
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
    let userCopy: StatsigUser = {};
    try {
      userCopy = JSON.parse(JSON.stringify(user));
    } catch (error) {
      throw new StatsigInvalidArgumentError(
        'User object must be convertable to JSON string.',
      );
    }

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

  private getEvalutionDetailsForError(): EvaluationDetails {
    return {
      time: Date.now(),
      reason: EvaluationReason.Error,
    };
  }

  private logConfigExposureImpl(configName: string, config: DynamicConfig) {
    const isManualExposure = !config;
    const localConfig = config;

    this.logger.logConfigExposure(
      this.getCurrentUser(),
      configName,
      localConfig.getRuleID(),
      localConfig._getSecondaryExposures(),
      localConfig.getEvaluationDetails(),
      isManualExposure,
    );
  }

  private getEmptyConfig(configName: string): DynamicConfig {
    return new DynamicConfig(
      configName,
      {},
      '',
      this.getEvalutionDetailsForError(),
    );
  }
}

import { StatsigUser } from './StatsigUser';

const DEFAULT_FEATURE_GATE_API = 'https://featuregates.org/v1/';
const DEFAULT_EVENT_LOGGING_API = 'https://events.statsigapi.net/v1/';

export const INIT_TIMEOUT_DEFAULT_MS = 3000;

export type StatsigEnvironment = {
  tier?: 'production' | 'staging' | 'development' | string;
  [key: string]: string | undefined;
};

export type InitCompletionCallback = (
  initDurationMs: number,
  success: boolean,
  message: string | null,
) => void;

export type UpdateUserCompletionCallback = (
  durationMs: number,
  success: boolean,
  message: string | null,
) => void;

export type GateEvaluationCallback = (
  key: string,
  value: boolean,
  details: {
    withExposureLoggingDisabled: boolean,
  }
) => void;

export interface UserPersistentStorageInterface {
  load(userID: string): string
  save(userID: string, data: string): void
}

export type StatsigOptions = {
  api?: string;
  disableCurrentPageLogging?: boolean;
  environment?: StatsigEnvironment;
  loggingIntervalMillis?: number;
  loggingBufferMaxSize?: number;
  disableNetworkKeepalive?: boolean;
  overrideStableID?: string;
  localMode?: boolean;
  initTimeoutMs?: number;
  disableErrorLogging?: boolean;
  disableAutoMetricsLogging?: boolean;
  initializeValues?: Record<string, unknown> | null;
  eventLoggingApi?: string;
  prefetchUsers?: StatsigUser[];
  disableLocalStorage?: boolean;
  initCompletionCallback?: InitCompletionCallback | null;
  updateUserCompletionCallback?: UpdateUserCompletionCallback | null;
  disableDiagnosticsLogging?: boolean;
  logLevel?: LogLevel | null;
  ignoreWindowUndefined?: boolean;
  fetchMode?: FetchMode;
  disableLocalOverrides?: boolean;
  gateEvaluationCallback?: GateEvaluationCallback;
  userPersistentStorage?: UserPersistentStorageInterface;
};

export enum LogLevel {
  'NONE',
  'INFO',
  'DEBUG',
}

export type FetchMode = 'cache-or-network' | 'network-only';

type BoundedNumberInput = {
  default: number;
  min: number;
  max: number;
};

export default class StatsigSDKOptions {
  private api: string;
  private disableCurrentPageLogging: boolean;
  private environment: StatsigEnvironment | null;
  private loggingIntervalMillis: number;
  private loggingBufferMaxSize: number;
  private disableNetworkKeepalive: boolean;
  private overrideStableID: string | null;
  private localMode: boolean;
  private initTimeoutMs: number;
  private disableErrorLogging: boolean;
  private disableAutoMetricsLogging: boolean;
  private initializeValues: Record<string, unknown> | null;
  private eventLoggingApi: string;
  private prefetchUsers: StatsigUser[];
  private disableLocalStorage: boolean;
  private initCompletionCallback: InitCompletionCallback | null;
  private updateCompletionCallback: UpdateUserCompletionCallback | null;
  private disableDiagnosticsLogging: boolean;
  private logLevel: LogLevel;
  private ignoreWindowUndefined: boolean;
  private fetchMode: FetchMode;
  private disableLocalOverrides: boolean;
  private gateEvaluationCallback: GateEvaluationCallback | null;
  private userPersistentStorage: UserPersistentStorageInterface | null;

  constructor(options?: StatsigOptions | null) {
    if (options == null) {
      options = {};
    }
    const api = options.api ?? DEFAULT_FEATURE_GATE_API;
    this.api = api.endsWith('/') ? api : api + '/';
    this.disableCurrentPageLogging = options.disableCurrentPageLogging ?? false;
    this.environment = options.environment ?? null;
    this.loggingIntervalMillis = this.normalizeNumberInput(
      options.loggingIntervalMillis,
      {
        default: 10000,
        min: 1000,
        max: 60000,
      },
    );
    this.loggingBufferMaxSize = this.normalizeNumberInput(
      options.loggingBufferMaxSize,
      {
        default: 100,
        min: 2,
        max: 500,
      },
    );

    this.disableNetworkKeepalive = options.disableNetworkKeepalive ?? false;
    this.overrideStableID = options.overrideStableID ?? null;
    this.localMode = options.localMode ?? false;
    this.initTimeoutMs =
      options.initTimeoutMs && options.initTimeoutMs >= 0
        ? options.initTimeoutMs
        : INIT_TIMEOUT_DEFAULT_MS;
    this.disableErrorLogging = options.disableErrorLogging ?? false;
    this.disableAutoMetricsLogging = options.disableAutoMetricsLogging ?? false;
    this.initializeValues = options.initializeValues ?? null;
    const eventLoggingApi =
      options.eventLoggingApi ?? options.api ?? DEFAULT_EVENT_LOGGING_API;
    this.eventLoggingApi = eventLoggingApi.endsWith('/')
      ? eventLoggingApi
      : eventLoggingApi + '/';
    this.prefetchUsers = options.prefetchUsers ?? [];
    this.disableLocalStorage = options.disableLocalStorage ?? false;
    this.initCompletionCallback = options.initCompletionCallback ?? null;
    this.updateCompletionCallback =
      options.updateUserCompletionCallback ?? null;
    this.disableDiagnosticsLogging = options.disableDiagnosticsLogging ?? false;
    this.logLevel = options?.logLevel ?? LogLevel.NONE;
    this.ignoreWindowUndefined = options?.ignoreWindowUndefined ?? false;
    this.fetchMode = options.fetchMode ?? 'network-only';
    this.disableLocalOverrides = options?.disableLocalOverrides ?? false;
    this.gateEvaluationCallback = options?.gateEvaluationCallback ?? null;
    this.userPersistentStorage = options?.userPersistentStorage ?? null;
  }

  getApi(): string {
    return this.api;
  }

  getEnvironment(): StatsigEnvironment | null {
    return this.environment;
  }

  getDisableCurrentPageLogging(): boolean {
    return this.disableCurrentPageLogging;
  }

  getLoggingIntervalMillis(): number {
    return this.loggingIntervalMillis;
  }

  getLoggingBufferMaxSize(): number {
    return this.loggingBufferMaxSize;
  }

  getDisableNetworkKeepalive(): boolean {
    return this.disableNetworkKeepalive;
  }

  getOverrideStableID(): string | null {
    return this.overrideStableID;
  }

  getLocalModeEnabled(): boolean {
    return this.localMode;
  }

  getInitTimeoutMs(): number {
    return this.initTimeoutMs;
  }

  getDisableErrorLogging(): boolean {
    return this.disableErrorLogging;
  }

  getDisableAutoMetricsLogging(): boolean {
    return this.disableAutoMetricsLogging;
  }

  getInitializeValues(): Record<string, unknown> | null {
    return this.initializeValues;
  }

  getEventLoggingApi(): string {
    return this.eventLoggingApi;
  }

  getPrefetchUsers(): StatsigUser[] {
    return this.prefetchUsers;
  }

  getDisableLocalStorage(): boolean {
    return this.disableLocalStorage;
  }

  getInitCompletionCallback(): InitCompletionCallback | null {
    return this.initCompletionCallback;
  }

  getUpdateUserCompletionCallback(): UpdateUserCompletionCallback | null {
    return this.updateCompletionCallback;
  }

  getDisableDiagnosticsLogging(): boolean {
    return this.disableDiagnosticsLogging;
  }

  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  getIgnoreWindowUndefined(): boolean {
    return this.ignoreWindowUndefined;
  }

  getFetchMode(): FetchMode {
    return this.fetchMode;
  }

  getDisableLocalOverrides(): boolean {
    return this.disableLocalOverrides;
  }

  getGateEvaluationCallback(): GateEvaluationCallback | null {
    return this.gateEvaluationCallback;
  }

  getUserPersistentStorage(): UserPersistentStorageInterface | null {
    return this.userPersistentStorage;
  }

  private normalizeNumberInput(
    input: number | undefined,
    bounds: BoundedNumberInput,
  ): number {
    if (input == null) {
      return bounds.default;
    }
    return Math.max(Math.min(input, bounds.max), bounds.min);
  }
}

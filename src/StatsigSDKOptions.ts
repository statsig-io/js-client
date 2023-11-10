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
    withExposureLoggingDisabled: boolean;
  },
) => void;

export interface UserPersistentStorageInterface {
  load(key: string): string;
  save(key: string, data: string): void;
  userIDType: string | undefined; // Defaults to userID if not provided
}

export type StatsigOptions = {
  api?: string;
  disableAllLogging?: boolean;
  disableAutoMetricsLogging?: boolean;
  disableCurrentPageLogging?: boolean;
  disableDiagnosticsLogging?: boolean;
  disableErrorLogging?: boolean;
  disableLocalOverrides?: boolean;
  disableLocalStorage?: boolean;
  disableNetworkKeepalive?: boolean;
  environment?: StatsigEnvironment;
  eventLoggingApi?: string;
  fetchMode?: FetchMode;
  gateEvaluationCallback?: GateEvaluationCallback;
  ignoreWindowUndefined?: boolean;
  initCompletionCallback?: InitCompletionCallback | null;
  initializeValues?: Record<string, unknown> | null;
  initTimeoutMs?: number;
  localMode?: boolean;
  loggingBufferMaxSize?: number;
  loggingIntervalMillis?: number;
  logLevel?: LogLevel | null;
  overrideStableID?: string;
  prefetchUsers?: StatsigUser[];
  updateUserCompletionCallback?: UpdateUserCompletionCallback | null;
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
  private disableAllLogging: boolean;
  private disableAutoMetricsLogging: boolean;
  private disableCurrentPageLogging: boolean;
  private disableDiagnosticsLogging: boolean;
  private disableErrorLogging: boolean;
  private disableLocalOverrides: boolean;
  private disableLocalStorage: boolean;
  private disableNetworkKeepalive: boolean;
  private environment: StatsigEnvironment | null;
  private eventLoggingApi: string;
  private fetchMode: FetchMode;
  private gateEvaluationCallback: GateEvaluationCallback | null;
  private ignoreWindowUndefined: boolean;
  private initCompletionCallback: InitCompletionCallback | null;
  private initializeValues: Record<string, unknown> | null;
  private initTimeoutMs: number;
  private localMode: boolean;
  private loggingBufferMaxSize: number;
  private loggingIntervalMillis: number;
  private logLevel: LogLevel;
  private overrideStableID: string | null;
  private prefetchUsers: StatsigUser[];
  private updateCompletionCallback: UpdateUserCompletionCallback | null;
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
    this.disableAllLogging = options.disableAllLogging ?? false;
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

  isAllLoggingDisabled(): boolean {
    return this.disableAllLogging;
  }

  reenableAllLogging(): void {
    this.disableAllLogging = false;
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

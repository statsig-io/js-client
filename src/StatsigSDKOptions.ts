const DEFAULT_API = 'https://api.statsig.com/v1/';

export type StatsigEnvironment = {
  tier?: 'production' | 'staging' | 'development';
  [key: string]: string | undefined;
};

export type StatsigOptions = {
  api?: string;
  disableCurrentPageLogging?: boolean;
  environment?: StatsigEnvironment;
  loggingIntervalMillis?: number;
  loggingBufferMaxSize?: number;
  disableNetworkKeepalive?: boolean;
};

type BoundedNumberInput = {
  default: number,
  min: number,
  max: number,
};

export default class StatsigSDKOptions {
  private api: string;
  private disableCurrentPageLogging: boolean;
  private environment: StatsigEnvironment | null;
  private loggingIntervalMillis: number;
  private loggingBufferMaxSize: number;

  private disableNetworkKeepalive: boolean;

  constructor(options?: StatsigOptions | null) {
    if (options == null) {
      options = {};
    }
    let api = options.api ?? DEFAULT_API;
    this.api = api.endsWith('/') ? api : api + '/';
    this.disableCurrentPageLogging = options.disableCurrentPageLogging ?? false;
    this.environment = options.environment ?? null;
    this.loggingIntervalMillis = this.normalizeNumberInput(
      options.loggingIntervalMillis, 
      {
        default: 5000,
        min: 1000,
        max: 60000,
      },
    );
    this.loggingBufferMaxSize = this.normalizeNumberInput(
      options.loggingBufferMaxSize, 
      {
        default: 10,
        min: 2,
        max: 500,
      },
    );

    this.disableNetworkKeepalive = options.disableNetworkKeepalive ?? false;
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

  private normalizeNumberInput(input: number | undefined, bounds: BoundedNumberInput): number {
    if (input == null) {
      return bounds.default;
    }
    return Math.max(Math.min(input, bounds.max), bounds.min);
  }
}

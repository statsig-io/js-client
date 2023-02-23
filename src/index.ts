import DynamicConfig from './DynamicConfig';
import { StatsigUninitializedError } from './Errors';
import StatsigClient from './StatsigClient';
import StatsigRuntime from './StatsigRuntime';
import { StatsigOptions } from './StatsigSDKOptions';
import { StatsigUser } from './StatsigUser';
import { default as PolyfillObjectEntries } from './utils/Object.entries';
import { default as PolyfillObjectFromEntries } from './utils/Object.fromEntries';
import { default as PolyfillPromiseFinally } from './utils/Promise.finally';

export { default as DynamicConfig } from './DynamicConfig';
export {
  default as StatsigClient,
  IStatsig,
  StatsigOverrides,
} from './StatsigClient';
export type {
  AppState,
  AppStateEvent,
  AppStateStatus,
  _SDKPackageInfo as _SDKPackageInfo,
} from './StatsigClient';
export type {
  DeviceInfo,
  ExpoConstants,
  ExpoDevice,
  NativeModules,
  Platform,
} from './StatsigIdentity';
export { StatsigEnvironment, StatsigOptions } from './StatsigSDKOptions';
export { EvaluationReason } from './StatsigStore';
export type { EvaluationDetails } from './StatsigStore';
export { StatsigUser } from './StatsigUser';
export { default as StatsigAsyncStorage } from './utils/StatsigAsyncStorage';
export type { AsyncStorage } from './utils/StatsigAsyncStorage';
export type { InitCompletionCallback } from './StatsigSDKOptions';

PolyfillObjectEntries();
PolyfillObjectFromEntries();
PolyfillPromiseFinally();

export default class Statsig {
  private static instance: StatsigClient | null = null;

  static get encodeIntializeCall(): boolean {
    return StatsigRuntime.encodeInitializeCall;
  }

  static set encodeIntializeCall(value: boolean) {
    StatsigRuntime.encodeInitializeCall = value;
  }

  private constructor() { }

  public static async initialize(
    sdkKey: string,
    user?: StatsigUser | null,
    options?: StatsigOptions | null,
  ): Promise<void> {
    const inst = Statsig.instance ?? new StatsigClient(sdkKey, user, options);

    if (!Statsig.instance) {
      Statsig.instance = inst;
    }
  }


  public static async genWebExperiment(experimentName: string): Promise<DynamicConfig> {
    return await Statsig.getClientX().genWebExperiment(experimentName);
  }

  public static logEvent(
    eventName: string,
    value: string | number | null = null,
    metadata: Record<string, string> | null = null,
  ): void {
    return Statsig.getClientX().logEvent(eventName, value, metadata);
  }

  public static shutdown() {
    Statsig.getClientX().shutdown();
    Statsig.instance = null;
  }

  /**
   * @returns The Statsig stable ID used for device level experiments
   */
  public static getStableID(): string {
    return Statsig.getClientX().getStableID();
  }

  private static getClientX(): StatsigClient {
    if (!Statsig.instance) {
      throw new StatsigUninitializedError();
    }
    return Statsig.instance;
  }
}

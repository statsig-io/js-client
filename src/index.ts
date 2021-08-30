import DynamicConfig from './DynamicConfig';
import StatsigClient from './StatsigClient';
import { StatsigOptions } from './StatsigSDKOptions';
import { StatsigUser } from './StatsigUser';

export default class Statsig {
  private static instance: StatsigClient;

  private constructor() {}

  public static async initialize(
    sdkKey: string,
    user: StatsigUser | null,
    options: StatsigOptions,
  ): Promise<void> {
    if (!Statsig.instance) {
      Statsig.instance = new StatsigClient();
    }
    return Statsig.instance.initializeAsync(sdkKey, user, options);
  }

  public static checkGate(gateName: string): boolean {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    return Statsig.instance.checkGate(gateName);
  }

  public static getConfig(configName: string): DynamicConfig {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    return Statsig.instance.getConfig(configName);
  }

  public static getExperiment(experimentName: string): DynamicConfig {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    return Statsig.instance.getExperiment(experimentName);
  }

  public static logEvent(
    eventName: string,
    value: string | number | null = null,
    metadata: Record<string, string> | null = null,
  ): void {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    Statsig.instance.logEvent(eventName, value, metadata);
  }

  public static updateUser(user: StatsigUser | null): Promise<boolean> {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    return Statsig.instance.updateUser(user);
  }

  public static shutdown() {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    Statsig.instance.shutdown();
  }

  public static overrideGate(gateName: string, value: boolean): void {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    Statsig.instance.overrideGate(gateName, value);
  }

  public static removeOverride(name?: string): void {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    Statsig.instance.removeOverride(name);
  }

  public static getOverrides(): Record<string, any> {
    if (!Statsig.instance) {
      throw new Error('Call and wait for initialize() to finish first.');
    }
    return Statsig.instance.getOverrides();
  }
}

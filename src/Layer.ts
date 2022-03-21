export default class Layer {
  private name: string;
  private value: Record<string, any>;
  private ruleID: string;
  private secondaryExposures: Record<string, string>[];
  private allocatedExperimentName: string;

  public constructor(
    configName: string,
    configValue: Record<string, any> = {},
    ruleID: string = '',
    secondaryExposures: Record<string, string>[] = [],
    allocatedExperimentName: string = '',
  ) {
    this.name = configName;
    this.value = JSON.parse(JSON.stringify(configValue));
    this.ruleID = ruleID;
    this.secondaryExposures = secondaryExposures;
    this.allocatedExperimentName = allocatedExperimentName;
  }

  public get<T>(
    key: string,
    defaultValue: T,
    typeGuard?: (value: unknown) => value is T,
  ): T {
    const val = (this.value[key] ?? null) as T;
    if (typeGuard) {
      return typeGuard(val) ? val : defaultValue;
    }
    if (defaultValue != null) {
      if (Array.isArray(defaultValue)) {
        if (Array.isArray(val)) {
          return val;
        }
        return defaultValue;
      } else if (typeof val !== typeof defaultValue) {
        return defaultValue;
      }
    }
    return val as unknown as T;
  }

  public getRuleID(): string {
    return this.ruleID;
  }

  public getName(): string {
    return this.name;
  }

  public _getSecondaryExposures(): Record<string, string>[] {
    return this.secondaryExposures;
  }

  public _getAllocatedExperimentName(): string {
    return this.allocatedExperimentName;
  }
}

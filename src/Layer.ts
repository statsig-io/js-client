export default class Layer {
  private name: string;
  private value: Record<string, any>;
  private ruleID: string;
  private secondaryExposures: Record<string, string>[];
  private allocatedExperimentName: string;

  public constructor(
    layerName: string,
    layerValue: Record<string, any> = {},
    ruleID: string = '',
    secondaryExposures: Record<string, string>[] = [],
    allocatedExperimentName: string = '',
  ) {
    this.name = layerName;
    this.value = JSON.parse(JSON.stringify(layerValue));
    this.ruleID = ruleID;
    this.secondaryExposures = secondaryExposures;
    this.allocatedExperimentName = allocatedExperimentName;
  }

  public get<T>(
    key: string,
    defaultValue: T,
    typeGuard?: (value: unknown) => value is T,
  ): T {
    const val = this.getValue(key, defaultValue);

    if (val == null) {
      return defaultValue;
    }

    if (typeGuard) {
      return typeGuard(val) ? val : defaultValue;
    }

    if (defaultValue == null) {
      return val as unknown as T;
    }

    if (
      typeof val === typeof defaultValue &&
      Array.isArray(defaultValue) === Array.isArray(val)
    ) {
      return val as unknown as T;
    }

    return defaultValue;
  }

  public getValue(
    key: string,
    defaultValue?: any | null,
  ): boolean | number | string | object | Array<any> | null {
    if (defaultValue == null) {
      defaultValue = null;
    }

    return this.value[key] ?? defaultValue;
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

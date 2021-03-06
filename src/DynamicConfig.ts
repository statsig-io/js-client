import { EvaluationDetails } from './StatsigStore';

export default class DynamicConfig {
  private name: string;
  public value: Record<string, any>;
  private ruleID: string;
  private secondaryExposures: Record<string, string>[];
  private allocatedExperimentName: string;
  private evaluationDetails: EvaluationDetails;

  public constructor(
    configName: string,
    configValue: Record<string, any>,
    ruleID: string,
    evaluationDetails: EvaluationDetails,
    secondaryExposures: Record<string, string>[] = [],
    allocatedExperimentName: string = '',
  ) {
    this.name = configName;
    this.value = JSON.parse(JSON.stringify(configValue ?? {}));
    this.ruleID = ruleID ?? '';
    this.secondaryExposures = secondaryExposures;
    this.allocatedExperimentName = allocatedExperimentName;
    this.evaluationDetails = evaluationDetails;
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
    key?: string,
    defaultValue?: any | null,
  ): boolean | number | string | object | Array<any> | null {
    if (key == null) {
      return this.value;
    }
    if (defaultValue == null) {
      defaultValue = null;
    }
    if (this.value[key] == null) {
      return defaultValue;
    }
    return this.value[key];
  }

  public getRuleID(): string {
    return this.ruleID;
  }

  public getName(): string {
    return this.name;
  }

  public getEvaluationDetails(): EvaluationDetails {
    return this.evaluationDetails;
  }

  public _getSecondaryExposures(): Record<string, string>[] {
    return this.secondaryExposures;
  }

  public _getAllocatedExperimentName(): string {
    return this.allocatedExperimentName;
  }
}

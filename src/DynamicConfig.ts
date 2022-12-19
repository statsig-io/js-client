import { EvaluationDetails } from './StatsigStore';

export type OnDefaultValueFallback = (
  config: DynamicConfig,
  parameter: string,
  defaultValueType: string,
  valueType: string,
) => void;

export default class DynamicConfig {
  private name: string;
  public value: Record<string, any>;
  private ruleID: string;
  private secondaryExposures: Record<string, string>[];
  private allocatedExperimentName: string;
  private evaluationDetails: EvaluationDetails;
  private onDefaultValueFallback: OnDefaultValueFallback | null = null;

  public constructor(
    configName: string,
    configValue: Record<string, any>,
    ruleID: string,
    evaluationDetails: EvaluationDetails,
    secondaryExposures: Record<string, string>[] = [],
    allocatedExperimentName: string = '',
    onDefaultValueFallback: OnDefaultValueFallback | null = null,
  ) {
    this.name = configName;
    this.value = JSON.parse(JSON.stringify(configValue ?? {}));
    this.ruleID = ruleID ?? '';
    this.secondaryExposures = secondaryExposures;
    this.allocatedExperimentName = allocatedExperimentName;
    this.evaluationDetails = evaluationDetails;
    this.onDefaultValueFallback = onDefaultValueFallback;
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

    if (this.onDefaultValueFallback != null) {
      this.onDefaultValueFallback(
        this,
        key,
        Array.isArray(defaultValue) ? 'array' : typeof defaultValue,
        Array.isArray(val) ? 'array' : typeof val,
      );
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

import { EvaluationDetails } from './StatsigStore';

export type OnDefaultValueFallback = (
  config: DynamicConfig,
  parameter: string,
  defaultValueType: string,
  valueType: string,
) => void;

export default class DynamicConfig {
  public value: Record<string, unknown>;

  private name: string;
  private ruleID: string;
  private groupName: string | null;
  private idType: string | null;
  private secondaryExposures: Record<string, string>[];
  private allocatedExperimentName: string;
  private evaluationDetails: EvaluationDetails;
  private onDefaultValueFallback: OnDefaultValueFallback | null = null;

  public constructor(
    configName: string,
    configValue: Record<string, unknown>,
    ruleID: string,
    evaluationDetails: EvaluationDetails,
    secondaryExposures: Record<string, string>[] = [],
    allocatedExperimentName = '',
    onDefaultValueFallback: OnDefaultValueFallback | null = null,
    groupName: string | null = null,
    idType: string | null = null,
  ) {
    this.name = configName;
    this.value = JSON.parse(JSON.stringify(configValue ?? {}));
    this.ruleID = ruleID ?? '';
    this.secondaryExposures = secondaryExposures;
    this.allocatedExperimentName = allocatedExperimentName;
    this.evaluationDetails = evaluationDetails;
    this.onDefaultValueFallback = onDefaultValueFallback;
    this.groupName = groupName;
    this.idType = idType;
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

    const expectedType = Array.isArray(defaultValue)
      ? 'array'
      : typeof defaultValue;
    const actualType = Array.isArray(val) ? 'array' : typeof val;

    if (typeGuard) {
      if (typeGuard(val)) {
        return val;
      }

      this.onDefaultValueFallback?.(this, key, expectedType, actualType);
      return defaultValue;
    }

    if (defaultValue == null || expectedType === actualType) {
      return val as unknown as T;
    }

    this.onDefaultValueFallback?.(this, key, expectedType, actualType);
    return defaultValue;
  }

  public getValue(key?: string, defaultValue?: unknown): unknown {
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

  public getGroupName(): string | null {
    return this.groupName;
  }

  public getIDType(): string | null {
    return this.idType;
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

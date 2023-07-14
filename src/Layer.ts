import { EvaluationDetails } from './StatsigStore';

export type LogParameterFunction = (
  layer: Layer,
  parameterName: string,
) => void;

export default class Layer {
  private logParameterFunction: LogParameterFunction | null;
  private name: string;
  private value: Record<string, unknown>;
  private ruleID: string;
  private groupName: string | null;
  private secondaryExposures: Record<string, string>[];
  private undelegatedSecondaryExposures: Record<string, string>[];
  private allocatedExperimentName: string;
  private explicitParameters: string[];
  private evaluationDetails: EvaluationDetails;

  private constructor(
    name: string,
    layerValue: Record<string, unknown>,
    ruleID: string,
    evaluationDetails: EvaluationDetails,
    logParameterFunction: LogParameterFunction | null = null,
    secondaryExposures: Record<string, string>[] = [],
    undelegatedSecondaryExposures: Record<string, string>[] = [],
    allocatedExperimentName = '',
    explicitParameters: string[] = [],
    groupName: string | null = null,
  ) {
    this.logParameterFunction = logParameterFunction;
    this.name = name;
    this.value = JSON.parse(JSON.stringify(layerValue ?? {}));
    this.ruleID = ruleID ?? '';
    this.evaluationDetails = evaluationDetails;
    this.secondaryExposures = secondaryExposures;
    this.undelegatedSecondaryExposures = undelegatedSecondaryExposures;
    this.allocatedExperimentName = allocatedExperimentName;
    this.explicitParameters = explicitParameters;
    this.groupName = groupName;
  }

  public static _create(
    name: string,
    value: Record<string, unknown>,
    ruleID: string,
    evaluationDetails: EvaluationDetails,
    logParameterFunction: LogParameterFunction | null = null,
    secondaryExposures: Record<string, string>[] = [],
    undelegatedSecondaryExposures: Record<string, string>[] = [],
    allocatedExperimentName = '',
    explicitParameters: string[] = [],
    groupName: string | null = null,
  ): Layer {
    return new Layer(
      name,
      value,
      ruleID,
      evaluationDetails,
      logParameterFunction,
      secondaryExposures,
      undelegatedSecondaryExposures,
      allocatedExperimentName,
      explicitParameters,
      groupName,
    );
  }

  public get<T>(
    key: string,
    defaultValue: T,
    typeGuard?: (value: unknown) => value is T,
  ): T {
    const val = this.value[key];

    if (val == null) {
      return defaultValue;
    }

    const logAndReturn = () => {
      this.logLayerParameterExposure(key);
      return val as unknown as T;
    };

    if (typeGuard) {
      return typeGuard(val) ? logAndReturn() : defaultValue;
    }

    if (defaultValue == null) {
      return logAndReturn();
    }

    if (
      typeof val === typeof defaultValue &&
      Array.isArray(defaultValue) === Array.isArray(val)
    ) {
      return logAndReturn();
    }

    return defaultValue;
  }

  public getValue(key: string, defaultValue?: unknown): unknown {
    if (defaultValue == undefined) {
      defaultValue = null;
    }

    const val = this.value[key];
    if (val != null) {
      this.logLayerParameterExposure(key);
    }

    return val ?? defaultValue;
  }

  public getRuleID(): string {
    return this.ruleID;
  }

  public getGroupName(): string | null {
    return this.groupName;
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

  public _getUndelegatedSecondaryExposures(): Record<string, string>[] {
    return this.undelegatedSecondaryExposures;
  }

  public _getAllocatedExperimentName(): string {
    return this.allocatedExperimentName;
  }

  public _getExplicitParameters(): string[] {
    return this.explicitParameters;
  }

  public _getEvaluationDetails(): EvaluationDetails {
    return this.evaluationDetails;
  }

  private logLayerParameterExposure(parameterName: string) {
    this.logParameterFunction?.(this, parameterName);
  }
}

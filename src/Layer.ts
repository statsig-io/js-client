import StatsigClient, { IHasStatsigInternal } from './StatsigClient';

export default class Layer {
  private sdkInternal: IHasStatsigInternal | null;
  private name: string;
  private value: Record<string, any>;
  private ruleID: string;
  private secondaryExposures: Record<string, string>[];
  private undelegatedSecondaryExposures: Record<string, string>[];
  private allocatedExperimentName: string;
  private explicitParameters: string[];

  private constructor(
    sdkInternal: IHasStatsigInternal | null,
    name: string,
    layerValue: Record<string, any> = {},
    ruleID: string = '',
    secondaryExposures: Record<string, string>[] = [],
    undelegatedSecondaryExposures: Record<string, string>[] = [],
    allocatedExperimentName: string = '',
    explicitParameters: string[] = [],
  ) {
    this.sdkInternal = sdkInternal;
    this.name = name;
    this.value = JSON.parse(JSON.stringify(layerValue));
    this.ruleID = ruleID;
    this.secondaryExposures = secondaryExposures;
    this.undelegatedSecondaryExposures = undelegatedSecondaryExposures;
    this.allocatedExperimentName = allocatedExperimentName;
    this.explicitParameters = explicitParameters;
  }

  public static _create(
    sdkInternal: IHasStatsigInternal,
    name: string,
    value: Record<string, any> = {},
    ruleID: string = '',
    secondaryExposures: Record<string, string>[] = [],
    undelegatedSecondaryExposures: Record<string, string>[] = [],
    allocatedExperimentName: string = '',
    explicitParameters: string[] = [],
  ): Layer {
    return new Layer(
      sdkInternal,
      name,
      value,
      ruleID,
      secondaryExposures,
      undelegatedSecondaryExposures,
      allocatedExperimentName,
      explicitParameters,
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

  public getValue(
    key: string,
    defaultValue?: any | null,
  ): boolean | number | string | object | Array<any> | null {
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

  public getName(): string {
    return this.name;
  }

  public _getSecondaryExposures(): Record<string, string>[] {
    return this.secondaryExposures;
  }

  public _getAllocatedExperimentName(): string {
    return this.allocatedExperimentName;
  }

  private logLayerParameterExposure(parameterName: string) {
    let allocatedExperiment = '';
    let exposures = this.undelegatedSecondaryExposures;
    const isExplicit = this.explicitParameters.includes(parameterName);
    if (isExplicit) {
      allocatedExperiment = this.allocatedExperimentName;
      exposures = this.secondaryExposures;
    }

    this.sdkInternal
      ?.getLogger()
      .logLayerExposure(
        this.sdkInternal.getCurrentUser(),
        this.name,
        this.ruleID,
        exposures,
        allocatedExperiment,
        parameterName,
        isExplicit,
      );
  }
}

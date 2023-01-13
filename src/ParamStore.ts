import { EvaluationDetails, Parameter, ParameterStore } from './StatsigStore';

export enum ParamType {
    STATIC = 'static',
    FEATURE_GATE = 'feature_gate',
    LAYER_PARAM = 'layer_param',
};

export type CheckGate = (
    gateName: string,
) => Boolean;

export type GetLayerParam = (
    layerName: string,
    paramName: string,
) => any;

export default class ParamStore {
  private name: string;
  private value: Record<string, any>;
  private defaultValues: Record<string, any>;
  private evaluationDetails: EvaluationDetails;
  private checkGate: CheckGate;
  private getLayerParam: GetLayerParam;

  private constructor(
    name: string,
    store: ParameterStore,
    defaultValues: Record<string, any>,
    evaluationDetails: EvaluationDetails,
    checkGate: CheckGate,
    getLayerParam: GetLayerParam,
  ) {
    this.name = name;
    this.value = JSON.parse(JSON.stringify(store));
    this.defaultValues = defaultValues;
    this.evaluationDetails = evaluationDetails;
    this.checkGate = checkGate;
    this.getLayerParam = getLayerParam;
  }

  public static _create(
    name: string,
    value: ParameterStore,
    defaultValues: Record<string, any>,
    evaluationDetails: EvaluationDetails,
    checkGate: CheckGate,
    getLayerParam: GetLayerParam,
  ): ParamStore {
    return new ParamStore(
      name,
      value,
      defaultValues,
      evaluationDetails,
      checkGate,
      getLayerParam,
    );
  }

  public getBool(name: string): boolean {
    const param: Parameter = this.value[name];
    if (param == null) {
        return this.defaultValues[name] === true;
    }
    if (param.type === ParamType.STATIC) {
        return (param.value === true);
    } else if (param.type === ParamType.FEATURE_GATE) {
        return this.checkGate(param.value as string) === true;
    } else if (param.type === ParamType.LAYER_PARAM) {
        return this.getLayerParam(param.value as string, param.reference as string) === true;
    }
    return this.defaultValues[name] === true;
  }

  public getString(name: string): string {
    const param: Parameter = this.value[name];
    if (param == null) {
        return this.defaultValues[name] as string;
    }
    if (param.type === ParamType.STATIC) {
        return param.value as string;
    } else if (param.type === ParamType.LAYER_PARAM) {
        return this.getLayerParam(param.value as string, param.reference as string) as string;
    }
    return this.defaultValues[name] as string;
  }

  public getNumber(name: string): number {
    const param: Parameter = this.value[name];
    if (param == null) {
        return this.defaultValues[name] as number;
    }
    if (param.type === ParamType.STATIC) {
        return param.value as number;
    } else if (param.type === ParamType.LAYER_PARAM) {
        return this.getLayerParam(param.value as string, param.reference as string) as number;
    }
    return this.defaultValues[name] as number;
  }


  public getName(): string {
    return this.name;
  }

  public getEvaluationDetails(): EvaluationDetails {
    return this.evaluationDetails;
  }

  public _getEvaluationDetails(): EvaluationDetails {
    return this.evaluationDetails;
  }
}

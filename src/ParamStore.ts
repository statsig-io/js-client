import { EvaluationDetails, Parameter, ParameterStore, ParamType } from './utils/StatsigTypes';

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
    if (param.referenceType === ParamType.STATIC) {
        console.log(param);
        return (param.value === 'true');
    } else if (param.referenceType === ParamType.FEATURE_GATE) {
        return this.checkGate(param.value as string) === true;
    } else if (param.referenceType === ParamType.LAYER_PARAM) {
        return this.getLayerParam(param.value as string, param.reference as string) === true;
    }
    return this.defaultValues[name] === true;
  }

  public getString(name: string): string {
    const param: Parameter = this.value[name];
    if (param == null) {
        return this.defaultValues[name] as string;
    }
    if (param.referenceType === ParamType.STATIC) {
        return param.value as string;
    } else if (param.referenceType === ParamType.LAYER_PARAM) {
        return this.getLayerParam(param.value as string, param.reference as string) as string;
    }
    return this.defaultValues[name] as string;
  }

  public getNumber(name: string): number {
    const param: Parameter = this.value[name];
    if (param == null) {
        return this.defaultValues[name] as number;
    }
    if (param.referenceType === ParamType.STATIC) {
        return Number(param.value);
    } else if (param.referenceType === ParamType.LAYER_PARAM) {
        return Number(this.getLayerParam(param.value as string, param.reference as string));
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

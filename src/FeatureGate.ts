import { EvaluationDetails } from './StatsigStore';

export default class FeatureGate {
  public value: boolean;

  private name: string;
  private ruleID: string;
  private groupName: string | null;
  private idType: string | null;
  private evaluationDetails: EvaluationDetails;

  public constructor(
    gateName: string,
    value: boolean,
    ruleID: string,
    evaluationDetails: EvaluationDetails,
    groupName: string | null = null,
    idType: string | null = null,
  ) {
    this.name = gateName;
    this.value = value;
    this.ruleID = ruleID ?? '';
    this.evaluationDetails = evaluationDetails;
    this.groupName = groupName;
    this.idType = idType;
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

  public getValue(): boolean {
    return this.value;
  }

  public getEvaluationDetails(): EvaluationDetails {
    return this.evaluationDetails;
  }
}

import { EvaluationDetails } from './StatsigStore';

export default class FeatureGate {
  public value: boolean;

  private name: string;
  private ruleID: string;
  private groupName: string | null;
  private idType: string | null;
  private evaluationDetails: EvaluationDetails;
  private secondaryExposures: Record<string, string>[];

  public constructor(
    gateName: string,
    value: boolean,
    ruleID: string,
    evaluationDetails: EvaluationDetails,
    groupName: string | null = null,
    idType: string | null = null,
    secondaryExposures: [] = [],
  ) {
    this.name = gateName;
    this.value = value;
    this.ruleID = ruleID ?? '';
    this.evaluationDetails = evaluationDetails;
    this.groupName = groupName;
    this.idType = idType;
    this.secondaryExposures = secondaryExposures;
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

  public getSecondaryExposures(): Record<string, string>[] {
    return this.secondaryExposures;
  }
}

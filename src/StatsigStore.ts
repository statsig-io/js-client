
export enum EvaluationReason {
  Network = 'Network',
  Bootstrap = 'Bootstrap',
  InvalidBootstrap = 'InvalidBootstrap',
  Cache = 'Cache',
  Prefetch = 'Prefetch',
  Sticky = 'Sticky',
  LocalOverride = 'LocalOverride',
  Unrecognized = 'Unrecognized',
  Uninitialized = 'Uninitialized',
  Error = 'Error',
  WebExperiment = 'WebExperiment',
}

export type EvaluationDetails = {
  time: number;
  reason: EvaluationReason;
};

type APIFeatureGate = {
  name: string;
  value: boolean;
  rule_id: string;
  secondary_exposures: [];
};

export type StoreGateFetchResult = {
  gate: APIFeatureGate;
  evaluationDetails: EvaluationDetails;
};

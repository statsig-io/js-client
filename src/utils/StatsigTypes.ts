
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
  }
  
  export type EvaluationDetails = {
    time: number;
    reason: EvaluationReason;
  };
  
  export type APIFeatureGate = {
    name: string;
    value: boolean;
    rule_id: string;
    secondary_exposures: [];
  };
  
  export type StoreGateFetchResult = {
    gate: APIFeatureGate;
    evaluationDetails: EvaluationDetails;
  };
  
  export type APIDynamicConfig = {
    name: string;
    value: { [key: string]: unknown };
    rule_id: string;
    secondary_exposures: [];
    is_device_based?: boolean;
    is_user_in_experiment?: boolean;
    is_experiment_active?: boolean;
    allocated_experiment_name: string | null;
    undelegated_secondary_exposures?: [];
    explicit_parameters?: string[];
  };
  
  export  type APIInitializeData = {
    dynamic_configs: Record<string, APIDynamicConfig | undefined>;
    feature_gates: Record<string, APIFeatureGate | undefined>;
    layer_configs: Record<string, APIDynamicConfig | undefined>;
    param_stores?: Record<string, ParameterStore> | undefined;
    has_updates?: boolean;
    time: number;
    user_hash?: string;
  };
  
  export type APIInitializeDataWithPrefetchedUsers = APIInitializeData & {
    prefetched_user_values?: Record<string, APIInitializeData>;
  };
  
  export  type UserCacheValues = APIInitializeDataWithPrefetchedUsers & {
    sticky_experiments: Record<string, APIDynamicConfig | undefined>;
    evaluation_time?: number;
  };
  
  export enum ParamType {
      STATIC = 'static',
      FEATURE_GATE = 'feature_gate',
      LAYER_PARAM = 'layer_param',
  };
  
  export type Parameter = {
      type: string,
      referenceType: ParamType
      value: string | number | boolean,
      reference?: string,
  }
  
  export type ParameterStore = {
      [key: string]: Parameter
  }

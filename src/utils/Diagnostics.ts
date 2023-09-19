import StatsigSDKOptions from '../StatsigSDKOptions';
import { EvaluationDetails } from '../StatsigStore';
import { now } from './Timing';

export type ContextType =
  | 'initialize'
  | 'config_sync'
  | 'event_logging'
  | 'api_call';

export type KeyType =
  | 'initialize'
  | 'bootstrap'
  | 'overall'
  // api_call keys
  | 'check_gate'
  | 'get_config'
  | 'get_experiment'
  | 'get_layer';

export type StepType = 'process' | 'network_request';
export type ActionType = 'start' | 'end';
export interface Marker {
  key: KeyType;
  action: ActionType;
  timestamp: number;
  step?: StepType;
  statusCode?: number;
  success?: boolean;
  url?: string;
  idListCount?: number;
  sdkRegion?: string | null;
  markerID?: string;
  attempt?: number;
  isRetry?: boolean;
  configName?: string;
  message?: string | null;
  evaluationDetails?: EvaluationDetails;
  error?: Record<string, unknown>;
}

type DiagnosticsMarkers = {
  initialize: Marker[];
  config_sync: Marker[];
  event_logging: Marker[];
  api_call: Marker[];
};

type DiagnosticsMaxMarkers = {
  [K in ContextType]: number;
};

export class DiagnosticsImpl {
  readonly mark = {
    overall: this.selectAction<OverrallDataType>('overall'),
    intialize: this.selectStep<InitializeDataType>('initialize'),
    bootstrap: this.selectStep<BootstrapDataType>('bootstrap'),
    api_call: (tag: string) => {
      switch (tag) {
        case 'getConfig':
          return this.selectAction<ErrorBoundaryDataType>('get_config');
        case 'getExperiment':
          return this.selectAction<ErrorBoundaryDataType>('get_experiment');
        case 'checkGate':
          return this.selectAction<ErrorBoundaryDataType>('check_gate');
        case 'getLayer':
          return this.selectAction<ErrorBoundaryDataType>('get_layer');
      }
      return null;
    },
  };

  markers: DiagnosticsMarkers;

  disabled: boolean;
  context: ContextType = 'initialize';
  defaultMaxMarkers = 30;
  maxMarkers: DiagnosticsMaxMarkers = {
    initialize: this.defaultMaxMarkers,
    config_sync: this.defaultMaxMarkers,
    event_logging: this.defaultMaxMarkers,
    api_call: this.defaultMaxMarkers,
  };

  constructor(args: {
    options: StatsigSDKOptions;
    markers?: DiagnosticsMarkers;
  }) {
    this.markers = args.markers ?? {
      initialize: [],
      config_sync: [],
      event_logging: [],
      api_call: [],
    };
    this.disabled = args.options?.getDisableDiagnosticsLogging() ?? false;
  }

  setContext(context: ContextType) {
    this.context = context;
  }

  selectAction<ActionType extends RequiredStepTags>(
    key: KeyType,
    step?: StepType,
  ) {
    type StartType = ActionType['start'];
    type EndType = ActionType['end'];

    return {
      start: (data: StartType, context?: ContextType): boolean => {
        return this.addMarker(
          {
            key,
            step,
            action: 'start',
            timestamp: now({ withPrecision: true }),
            ...(data ?? {}),
          },
          context,
        );
      },
      end: (data: EndType, context?: ContextType): boolean => {
        return this.addMarker(
          {
            key,
            step,
            action: 'end',
            timestamp: now({ withPrecision: true }),
            ...(data ?? {}),
          },
          context,
        );
      },
    };
  }

  selectStep<StepType extends RequiredMarkerTags>(key: KeyType) {
    type ProcessStepType = StepType['process'];
    type NetworkRequestStepType = StepType['networkRequest'];

    return {
      process: this.selectAction<ProcessStepType>(key, 'process'),
      networkRequest: this.selectAction<NetworkRequestStepType>(
        key,
        'network_request',
      ),
    };
  }

  addMarker(marker: Marker, overrideContext?: ContextType) {
    if (this.disabled) {
      return false;
    }
    const context = overrideContext ?? this.context;
    if (
      this.maxMarkers[context] !== undefined &&
      this.markers[context].length >=
      (this.maxMarkers[context] ?? this.defaultMaxMarkers)
    ) {
      return false;
    }
    this.markers[context].push(marker);
    return true;
  }

  getMarkers(context: ContextType) {
    return this.markers[context];
  }

  setMaxMarkers(context: ContextType, max: number) {
    this.maxMarkers[context] = max;
  }
  getMarkerCount(context: ContextType) {
    return this.markers[context].length;
  }

  clearContext(context: ContextType) {
    this.markers[context] = [];
  }
}

export default abstract class Diagnostics {
  private static instance: DiagnosticsImpl;

  public static mark: DiagnosticsImpl['mark'];
  public static disabled: DiagnosticsImpl['disabled'];
  public static getMarkers: DiagnosticsImpl['getMarkers'];
  public static getMarkerCount: DiagnosticsImpl['getMarkerCount'];
  public static setMaxMarkers: DiagnosticsImpl['setMaxMarkers'];
  public static setContext: DiagnosticsImpl['setContext'];
  public static clearContext: DiagnosticsImpl['clearContext'];

  static initialize(args: {
    options: StatsigSDKOptions;
    markers?: DiagnosticsMarkers;
  }) {
    this.instance = new DiagnosticsImpl(args);
    this.mark = this.instance.mark;
    this.disabled = this.instance.disabled;
    this.getMarkers = this.instance.getMarkers.bind(this.instance);
    this.getMarkerCount = this.instance.getMarkerCount.bind(this.instance);
    this.setMaxMarkers = this.instance.setMaxMarkers.bind(this.instance);
    this.setContext = this.instance.setContext.bind(this.instance);
    this.clearContext = this.instance.clearContext.bind(this.instance);
  }

  static formatNetworkError(e: unknown): Record<string, unknown> | undefined {
    if (!(e && typeof e === 'object')) {
      return;
    }
    return {
      code: this.safeGetField(e, 'code'),
      name: this.safeGetField(e, 'name'),
      message: this.safeGetField(e, 'message'),
    };
  }  
  private static safeGetField(data: object, field: string): unknown | undefined {
    if (field in data) {
      return (data as Record<string, unknown>)[field];
    }
    return undefined;
  }
}

type RequiredActionTags = {
  [K in keyof Marker]?: Marker[K];
};

interface RequiredStepTags {
  start: RequiredActionTags;
  end: RequiredActionTags;
}

interface RequiredMarkerTags {
  process: RequiredStepTags;
  networkRequest: RequiredStepTags;
}

interface OverrallDataType extends RequiredStepTags {
  overall: {
    start: Record<string, never>;
    end: {
      success: boolean;
      evaluationDetails?: EvaluationDetails;
    };
  };
}

interface InitializeDataType extends RequiredMarkerTags {
  process: {
    start: Record<string, never>;
    end: {
      success: boolean;
    };
  };
  networkRequest: {
    start: {
      attempt: number;
    };
    end: {
      success: boolean;
      attempt: number;
      isDelta?: boolean;
      sdkRegion?: string | null;
      statusCode?: number;
    };
  };
}

interface BootstrapDataType extends RequiredMarkerTags {
  process: {
    start: Record<string, never>;
    end: {
      success: boolean;
    };
  };
}

interface ErrorBoundaryDataType extends RequiredStepTags {
  errorBoundary: {
    start: {
      markerID: string;
    };
    end: {
      markerID: string;
      success: boolean;
      configName: string;
    };
  };
}

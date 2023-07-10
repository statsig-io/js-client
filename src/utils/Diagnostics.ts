import StatsigLogger from '../StatsigLogger';
import StatsigSDKOptions, { StatsigOptions } from '../StatsigSDKOptions';
import { StatsigUser } from '../StatsigUser';

export type ContextType =
  | 'initialize'
  | 'config_sync'
  | 'event_logging'
  | 'error_boundary';

export type KeyType =
  | 'initialize'
  | 'bootstrap'
  | 'overall'
  // Error boundary keys
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
  reason?: 'timeout';
  sdkRegion?: string | null;
  id?: string;
}

type DiagnosticsMarkers = {
  initialize: Marker[];
  config_sync: Marker[];
  event_logging: Marker[];
  error_boundary: Marker[];
};

type DiagnosticsMaxMarkers = {
  [K in ContextType]: number;
};

export class DiagnosticsImpl {
  readonly mark = {
    overall: this.selectAction<OverrallDataType>('overall'),
    intialize: this.selectStep<InitializeDataType>('initialize'),
    bootstrap: this.selectStep<BootstrapDataType>('bootstrap'),
    check_gate: this.selectAction<ErrorBoundaryDataType>('check_gate'),
    get_config: this.selectAction<ErrorBoundaryDataType>('get_config'),
    get_experiment: this.selectAction<ErrorBoundaryDataType>('get_experiment'),
    get_layer: this.selectAction<ErrorBoundaryDataType>('get_layer'),
  };

  markers: DiagnosticsMarkers;

  disabled: boolean;
  logger: StatsigLogger;
  context: ContextType = 'initialize';
  defaultMaxMarkers = 30;
  maxMarkers: DiagnosticsMaxMarkers = {
    initialize: this.defaultMaxMarkers,
    config_sync: this.defaultMaxMarkers,
    event_logging: this.defaultMaxMarkers,
    error_boundary: this.defaultMaxMarkers,
  };

  constructor(args: {
    logger: StatsigLogger;
    options: StatsigSDKOptions;
    markers?: DiagnosticsMarkers;
  }) {
    this.markers = args.markers ?? {
      initialize: [],
      config_sync: [],
      event_logging: [],
      error_boundary: [],
    };
    this.logger = args.logger;
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
            timestamp: Date.now(),
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
            timestamp: Date.now(),
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

  logDiagnostics(user: StatsigUser | null, context: ContextType) {
    if (this.disabled) {
      return;
    }

    this.logger.logDiagnostics(user, {
      context,
      markers: this.markers[context],
    });
    this.markers[context] = [];
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
  // public static logDiagnostics: DiagnosticsImpl['logDiagnostics'];
  // public static getMarkers: DiagnosticsImpl['getMarkers'];
  // public static getMarkerCount: DiagnosticsImpl['getMarkerCount'];
  // public static setMaxMarkers: DiagnosticsImpl['setMaxMarkers'];
  // public static setContext: DiagnosticsImpl['setContext'];
  // public static clearContext: DiagnosticsImpl['clearContext'];

  static initialize(args: {
    logger: StatsigLogger;
    options: StatsigSDKOptions;
    markers?: DiagnosticsMarkers;
  }) {
    this.instance = new DiagnosticsImpl(args);
    this.mark = this.instance.mark;
  }

  static logDiagnostics(user: StatsigUser | null, context: ContextType) {
    this.instance.logDiagnostics(user, context);
  }

  static getMarkers(context: ContextType) {
    return this.instance.getMarkers(context);
  }

  static getMarkerCount(context: ContextType) {
    return this.instance.getMarkerCount(context);
  }

  static setMaxMarkers(context: ContextType, max: number) {
    this.instance.setMaxMarkers(context, max);
  }

  static setContext(context: ContextType) {
    this.instance.setContext(context);
  }

  static clearContext(context: ContextType) {
    this.instance.clearContext(context);
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
      reason?: 'timeout';
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
    start: Record<string, never>;
    end: {
      success: boolean;
      isDelta: boolean;
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
      id: string;
    };
    end: {
      id: string;
      success: boolean;
    };
  };
}

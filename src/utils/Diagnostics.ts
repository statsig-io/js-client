import { now } from './Timing';

export enum DiagnosticsEvent {
  START = 'start',
  END = 'end',
}

export enum DiagnosticsKey {
  OVERALL = 'overall',
  INITIALIZE = 'initialize',
  INITIALIZE_WITH_DELTA = 'initialize_with_delta',
  CHECK_GATE = 'check_gate',
  GET_CONFIG = 'get_config',
  GET_EXPERIMENT = 'get_experiment',
  GET_LAYER = 'get_layer',
}

export type Primitive = string | number | boolean | null | undefined;
export type PrimitiveRecords = Record<string, Primitive>;

export type DiagnosticsMarkers = {
  context: string;
  markers: PrimitiveRecords[];
  metadata: PrimitiveRecords;
};

export default class Diagnostics {
  private markers: PrimitiveRecords[] = [];
  private metadata: PrimitiveRecords = {};

  public constructor(private context: string, private capacity?: number) {}

  public reset() {
    this.markers = [];
    this.metadata = {};
  }

  public getCount() {
    return this.markers.length;
  }

  public getMarkers(): DiagnosticsMarkers {
    return {
      context: this.context,
      markers: this.markers,
      metadata: this.metadata,
    };
  }

  public addMetadata(key: string, value: Primitive) {
    this.metadata[key] = value;
  }

  public mark(
    key: DiagnosticsKey,
    action: DiagnosticsEvent,
    step: string | null = null,
    value: Primitive = null,
  ): boolean {
    if (this.capacity && this.markers.length >= this.capacity) {
      return false;
    }

    this.markers.push({
      key,
      step,
      action,
      value,
      timestamp: now(),
    });

    return true;
  }
}

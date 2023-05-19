import { now } from './Timing';

export enum DiagnosticsEvent {
  START = 'start',
  END = 'end',
}

export enum DiagnosticsKey {
  OVERALL = 'overall',
  INITIALIZE = 'initialize',
  INITIALIZE_WITH_DELTA = 'initialize_with_delta',
}

export type Primitive = string | number | boolean | null | undefined;
export type PrimitiveRecords = Record<string, Primitive>;

export type DiagnosticsMarkers = {
  context: string;
  markers: PrimitiveRecords[];
  metadata: PrimitiveRecords;
};

export default class Diagnostics {
  private markers: PrimitiveRecords[];
  private context: string;
  private metadata: PrimitiveRecords;

  public constructor(context: string) {
    this.context = context;
    this.markers = [];
    this.metadata = {};
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
  ): void {
    this.markers.push({
      key,
      step,
      action,
      value,
      timestamp: now(),
    });
  }
}

import { now } from './Timing';

export enum DiagnosticsEvent {
  START = 'start',
  END = 'end',
}

export enum DiagnosticsKey {
  OVERALL = 'overall',
  INITIALIZE = 'initialize',
  PROCESS = 'process',
}

export type DiagnosticsMarker = Record<
  string,
  string | number | null | undefined
>;

export type DiagnosticsMarkers = {
  context: string;
  markers: DiagnosticsMarker[];
};

export default class Diagnostics {
  private markers: DiagnosticsMarker[];
  private context: string;

  public constructor(context: string) {
    this.context = context;
    this.markers = [];
  }

  public getMarkers(): DiagnosticsMarkers {
    return {
      context: this.context,
      markers: this.markers,
    };
  }

  public mark(
    key: DiagnosticsKey,
    action: DiagnosticsEvent,
    step: string | null = null,
    value: string | number | null = null,
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

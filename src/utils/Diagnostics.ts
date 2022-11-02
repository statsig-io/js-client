import { now } from './Timing';

export enum DiagnosticsEvent {
  START = 'start',
  END = 'end',
  STATUS = 'status-code',
  SUCCESS = 'success',
  COMPLETE = 'complete',
}

export default class Diagnostics {
  private markers: Record<string, string | number>;
  private context: string;

  public constructor(context: string) {
    this.context = context;
    this.markers = {};
  }

  public getMarkers(): Record<string, string | number> {
    return this.markers;
  }

  public mark(
    markerName: DiagnosticsEvent,
    value: string | number = now(),
  ): void {
    this.markers[this.getKey(markerName)] = value;
  }

  public difference(
    markerName1: DiagnosticsEvent,
    markerName2: DiagnosticsEvent,
  ): number {
    const first = this.markers[this.getKey(markerName1)];
    const second = this.markers[this.getKey(markerName2)];
    if (
      first == null ||
      second == null ||
      typeof first !== 'number' ||
      typeof second !== 'number'
    ) {
      return 0;
    }
    return second - first;
  }

  private getKey(evt: DiagnosticsEvent) {
    return this.context + '-' + evt;
  }
}

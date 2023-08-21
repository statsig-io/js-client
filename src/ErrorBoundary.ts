import {
  StatsigUninitializedError,
  StatsigInvalidArgumentError,
} from './Errors';
import Diagnostics from './utils/Diagnostics';
import parseError from './utils/parseError';
export const ExceptionEndpoint = 'https://statsigapi.net/v1/sdk_exception';

type ExtraDataExtractor = () => Promise<Record<string, unknown>>;

type CaptureOptions = Partial<{
  getExtraData: ExtraDataExtractor;
  configName: string;
}>;

const MAX_DIAGNOSTICS_MARKERS = 30;
const SAMPLING_RATE = 10_000;

export default class ErrorBoundary {
  private statsigMetadata?: Record<string, string | number>;
  private seen = new Set<string>();

  constructor(private sdkKey: string) {
    const sampling = Math.floor(Math.random() * SAMPLING_RATE);
    this.setupDiagnostics(sampling === 0 ? MAX_DIAGNOSTICS_MARKERS : 0);
  }

  setStatsigMetadata(statsigMetadata: Record<string, string | number>) {
    this.statsigMetadata = statsigMetadata;
  }

  swallow<T>(tag: string, task: () => T, options: CaptureOptions = {}) {
    this.capture(
      tag,
      task,
      () => {
        return undefined;
      },
      options,
    );
  }

  capture<T>(
    tag: string,
    task: () => T,
    recover: () => T,
    { getExtraData, configName }: CaptureOptions = {},
  ): T {
    let markerID: string | null = null;
    try {
      markerID = this.beginMarker(tag);

      const result = task();
      let wasSuccessful = true;
      if (result instanceof Promise) {
        return result
          .catch((e: unknown) => {
            wasSuccessful = false;
            return this.onCaught(tag, e, recover, getExtraData);
          })
          .then((possiblyRecoveredResult) => {
            this.endMarker(tag, wasSuccessful, markerID);
            return possiblyRecoveredResult;
          }) as unknown as T;
      }

      this.endMarker(tag, true, markerID, configName);
      return result;
    } catch (error) {
      this.endMarker(tag, false, markerID, configName);
      return this.onCaught(tag, error, recover, getExtraData);
    }
  }

  public logError(
    tag: string,
    error: unknown,
    getExtraData?: ExtraDataExtractor,
  ): void {
    (async () => {
      try {
        const extra =
          typeof getExtraData === 'function' ? await getExtraData() : null;
        const { name, trace: info } = parseError(error);

        if (this.seen.has(name)) return;
        this.seen.add(name);

        const metadata = this.statsigMetadata ?? {};
        const body = JSON.stringify({
          tag,
          exception: name,
          info,
          statsigMetadata: metadata,
          extra: extra ?? {},
        });
        return fetch(ExceptionEndpoint, {
          method: 'POST',
          headers: {
            'STATSIG-API-KEY': this.sdkKey,
            'STATSIG-SDK-TYPE': String(metadata['sdkType']),
            'STATSIG-SDK-VERSION': String(metadata['sdkVersion']),
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body,
        });
      } catch (_error) {
        /* noop */
      }
    })().catch(() => {
      /*noop*/
    });
  }

  private setupDiagnostics(maxMarkers: number) {
    Diagnostics.setMaxMarkers('api_call', maxMarkers);
  }

  private beginMarker(tag: string): string | null {
    const diagnostics = Diagnostics.mark.api_call(tag);
    if (!diagnostics) {
      return null;
    }
    const count = Diagnostics.getMarkerCount('api_call');
    const markerID = `${tag}_${count}`;
    const wasAdded = diagnostics.start(
      {
        markerID,
      },
      'api_call',
    );
    return wasAdded ? markerID : null;
  }

  private endMarker(
    tag: string,
    wasSuccessful: boolean,
    markerID: string | null,
    configName?: string,
  ): void {
    const diagnostics = Diagnostics.mark.api_call(tag);
    if (!markerID || !diagnostics) {
      return;
    }
    diagnostics.end(
      {
        markerID,
        success: wasSuccessful,
        configName,
      },
      'api_call',
    );
  }

  private onCaught<T>(
    tag: string,
    error: unknown,
    recover: () => T,
    getExtraData?: ExtraDataExtractor,
  ): T {
    if (
      error instanceof StatsigUninitializedError ||
      error instanceof StatsigInvalidArgumentError
    ) {
      throw error; // Don't catch these
    }

    console.error('[Statsig] An unexpected exception occurred.', error);

    this.logError(tag, error, getExtraData);

    return recover();
  }
}

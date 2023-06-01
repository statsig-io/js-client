import {
  StatsigUninitializedError,
  StatsigInvalidArgumentError,
} from './Errors';
import Diagnostics, { DiagnosticsEvent } from './utils/Diagnostics';
import { DiagnosticsKey } from './utils/Diagnostics';
export const ExceptionEndpoint = 'https://statsigapi.net/v1/sdk_exception';

type ExtraDataExtractor = () => Promise<Record<string, unknown>>;

type CaptureOptions = {
  getExtraData?: ExtraDataExtractor;
  diagnosticsKey?: DiagnosticsKey;
};

export default class ErrorBoundary {
  private statsigMetadata?: Record<string, string | number>;
  private seen = new Set<string>();
  private diagnostics?: Diagnostics;

  constructor(private sdkKey: string, disableDiagnostics = false) {
    if (disableDiagnostics) {
      return;
    }

    const sampling = Math.floor(Math.random() * 10_000);
    if (sampling !== 0) {
      return;
    }

    this.diagnostics = new Diagnostics('error_boundary', 30);
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
    { getExtraData, diagnosticsKey }: CaptureOptions = {},
  ): T {
    let markerID = -1;
    try {
      markerID = this.beginMarker(diagnosticsKey);

      const result = task();
      let wasSuccessful = true;
      if (result instanceof Promise) {
        return result
          .catch((e: unknown) => {
            wasSuccessful = false;
            return this.onCaught(tag, e, recover, getExtraData);
          })
          .then((possiblyRecoveredResult) => {
            this.endMarker(diagnosticsKey, wasSuccessful, markerID);
            return possiblyRecoveredResult;
          }) as unknown as T;
      }

      this.endMarker(diagnosticsKey, true, markerID);
      return result;
    } catch (error) {
      this.endMarker(diagnosticsKey, false, markerID);
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
        const unwrapped = (error ??
          Error('[Statsig] Error was empty')) as unknown;
        const isError = unwrapped instanceof Error;
        const name = isError ? unwrapped.name : 'No Name';

        if (this.seen.has(name)) return;
        this.seen.add(name);

        const info = isError ? unwrapped.stack : this.getDescription(unwrapped);
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
            'Content-Type': 'application/json',
            'Content-Length': `${body.length}`,
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

  public getDiagnostics(): Diagnostics | null {
    return this.diagnostics ?? null;
  }

  private beginMarker(key: DiagnosticsKey | null = null): number {
    if (!key || !this.diagnostics) {
      return -1;
    }
    const id = this.diagnostics.getCount();
    const wasAdded = this.diagnostics.mark(
      key,
      DiagnosticsEvent.START,
      `${key}_${id}`,
    );
    return wasAdded ? id : -1;
  }

  private endMarker(
    key: DiagnosticsKey | null = null,
    wasSuccessful: boolean,
    markerID: number,
  ): void {
    if (!key || !this.diagnostics || markerID === -1) {
      return;
    }

    this.diagnostics.mark(
      key,
      DiagnosticsEvent.END,
      `${key}_${markerID}`,
      wasSuccessful,
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

  private getDescription(obj: unknown): string {
    try {
      return JSON.stringify(obj);
    } catch {
      return '[Statsig] Failed to get string for error.';
    }
  }
}

import { v4 as uuidv4 } from 'uuid';

import {
  StatsigInitializationTimeoutError,
  StatsigInvalidArgumentError,
  StatsigUninitializedError,
} from './Errors';
import StatsigSDKOptions from './StatsigSDKOptions';
import Diagnostics from './utils/Diagnostics';
import OutputLogger from './utils/OutputLogger';
import parseError from './utils/parseError';
export const ExceptionEndpoint = 'https://prodregistryv2.org/v1/rgstr_e';

type ExtraDataExtractor = () => Record<string, unknown>;

type CaptureOptions = Partial<{
  getExtraData: ExtraDataExtractor;
  configName: string;
}>;

const MAX_DIAGNOSTICS_MARKERS = 30;
const SAMPLING_RATE = 10_000;

export default class ErrorBoundary {
  private statsigMetadata?: Record<string, string | number>;
  private seen = new Set<string>();

  constructor(
    private sdkKey: string,
    private sdkOptions: StatsigSDKOptions,
  ) {
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
    captureOptions: CaptureOptions = {},
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
            return this.onCaught(tag, e, recover, captureOptions);
          })
          .then((possiblyRecoveredResult) => {
            this.endMarker(tag, wasSuccessful, markerID);
            return possiblyRecoveredResult;
          }) as unknown as T;
      }

      this.endMarker(tag, true, markerID, captureOptions.configName);
      return result;
    } catch (error) {
      this.endMarker(tag, false, markerID, captureOptions.configName);
      return this.onCaught(tag, error, recover, captureOptions);
    }
  }

  public logError(
    tag: string,
    error: unknown,
    { getExtraData, configName }: CaptureOptions = {},
  ): void {
    if (this.sdkOptions.isAllLoggingDisabled()) {
      return;
    }
    (async () => {
      try {
        const extra = typeof getExtraData === 'function' ? getExtraData() : {};
        const { name, trace: info } = parseError(error);
        extra['configName'] = configName;
        if (this.seen.has(name)) return;
        this.seen.add(name);

        const metadata = this.statsigMetadata ?? {};
        if (metadata.sessionID == null) {
          metadata.sessionID = uuidv4();
        }
        const body = JSON.stringify({
          tag,
          exception: name,
          info,
          statsigMetadata: metadata,
          statsigOptions: this.sdkOptions.getLoggingCopy(),
          extra: extra,
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
    captureOptions: CaptureOptions = {},
  ): T {
    if (
      error instanceof StatsigUninitializedError ||
      error instanceof StatsigInvalidArgumentError
    ) {
      throw error; // Don't catch these
    }

    if (error instanceof StatsigInitializationTimeoutError) {
      OutputLogger.error('Timeout occured.', error);
      return recover();
    }

    OutputLogger.error('An unexpected exception occurred.', error);
    this.logError(tag, error, captureOptions);

    return recover();
  }
}

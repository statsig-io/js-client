import {
  StatsigUninitializedError,
  StatsigInvalidArgumentError,
} from './Errors';
import Diagnostics from './utils/Diagnostics';
export const ExceptionEndpoint = 'https://statsigapi.net/v1/sdk_exception';

type ExtraDataExtractor = () => Promise<Record<string, unknown>>;

type CaptureOptions = {
  getExtraData?: ExtraDataExtractor;
};

type errorBoundaryTagsType =
  | 'getSDKKey'
  | 'getCurrentUser'
  | 'getCurrentUserCacheKey'
  | 'getStatsigMetadata'
  | 'getSDKType'
  | 'getSDKVersion'
  | 'setInitializeValues'
  | 'initializeAsync'
  | 'prefetchUsers'
  | 'getEvaluationDetails'
  | 'checkGate'
  | 'checkGateWithExposureLoggingDisabled'
  | 'getConfig'
  | 'getConfig'
  | 'getExperiment'
  | 'getExperimentWithExposureLoggingDisabled'
  | 'getLayer'
  | 'getLayerWithExposureLoggingDisabled'
  | 'updateUserWithValues'
  | 'updateUser'
  | 'getOverrides'
  | 'getAllOverrides'
  | 'getStableID'
  | 'delayedSetup'
  | 'logGateExposure'
  | 'logConfigExposure'
  | 'logExperimentExposure'
  | 'logLayerParameterExposure'
  | 'logEvent'
  | 'shutdown'
  | 'overrideGate'
  | 'overrideConfig'
  | 'overrideLayer'
  | 'removeGateOverride'
  | 'removeConfigOverride'
  | 'removeLayerOverride'
  | 'removeOverride'
  | 'fetchAndSaveValues'
  | 'postWithTimeout';

export default class ErrorBoundary {
  private statsigMetadata?: Record<string, string | number>;
  private seen = new Set<string>();

  constructor(private sdkKey: string) {
    const sampling = Math.floor(Math.random() * 10_000);
    if (sampling === 0) {
      Diagnostics.setMaxMarkers('error_boundary', 30);
    } else {
      Diagnostics.setMaxMarkers('error_boundary', 0);
    }
  }

  setStatsigMetadata(statsigMetadata: Record<string, string | number>) {
    this.statsigMetadata = statsigMetadata;
  }

  swallow<T>(
    tag: errorBoundaryTagsType,
    task: () => T,
    options: CaptureOptions = {},
  ) {
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
    tag: errorBoundaryTagsType,
    task: () => T,
    recover: () => T,
    { getExtraData }: CaptureOptions = {},
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

      this.endMarker(tag, true, markerID);
      return result;
    } catch (error) {
      this.endMarker(tag, false, markerID);
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

  private beginMarker(tag: errorBoundaryTagsType): string | null {
    const diagnostics = this.getDiagnosticsFromTag(tag);
    if (!diagnostics) {
      return null;
    }
    const count = Diagnostics.getMarkerCount('error_boundary');
    const id = `${tag}_${count}`;
    const wasAdded = diagnostics.start(
      {
        id,
      },
      'error_boundary',
    );
    return wasAdded ? id : null;
  }

  private endMarker(
    tag: errorBoundaryTagsType,
    wasSuccessful: boolean,
    markerID: string | null,
  ): void {
    const diagnostics = this.getDiagnosticsFromTag(tag);
    if (!markerID || !diagnostics) {
      return;
    }
    diagnostics.end(
      {
        id: markerID,
        success: wasSuccessful,
      },
      'error_boundary',
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

  private getDiagnosticsFromTag(
    tag: errorBoundaryTagsType,
  ):
    | typeof Diagnostics.mark.get_config
    | typeof Diagnostics.mark.get_experiment
    | typeof Diagnostics.mark.check_gate
    | typeof Diagnostics.mark.get_layer
    | null {
    switch (tag) {
      case 'getConfig':
        return Diagnostics.mark.get_config;
      case 'getExperiment':
        return Diagnostics.mark.get_experiment;
      case 'checkGate':
        return Diagnostics.mark.check_gate;
      case 'getLayer':
        return Diagnostics.mark.get_layer;
    }
    return null;
  }
}
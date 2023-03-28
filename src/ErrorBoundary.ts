import {
  StatsigUninitializedError,
  StatsigInvalidArgumentError,
} from './Errors';
export const ExceptionEndpoint = 'https://statsigapi.net/v1/sdk_exception';

type ExtraDataExtractor = () => Promise<Record<string, unknown>>;

export default class ErrorBoundary {
  private sdkKey: string;
  private statsigMetadata?: Record<string, string | number>;
  private seen = new Set<string>();

  constructor(sdkKey: string) {
    this.sdkKey = sdkKey;
  }

  setStatsigMetadata(statsigMetadata: Record<string, string | number>) {
    this.statsigMetadata = statsigMetadata;
  }

  swallow<T>(tag: string, task: () => T) {
    this.capture(tag, task, () => {
      return undefined;
    });
  }

  capture<T>(
    tag: string,
    task: () => T,
    recover: () => T,
    getExtraData?: ExtraDataExtractor,
  ): T {
    try {
      const result = task();
      console.log('result:',result);
      if (result instanceof Promise) {
        return (result as any).catch((e: unknown) => {
          console.log('caught promise');
          return this.onCaught(tag, e, recover, getExtraData);
        });
      }
      return result;
    } catch (error) {
      console.log('caught', error)
      return this.onCaught(tag, error, recover, getExtraData);
    }
  }

  public async logError(
    tag: string,
    error: unknown,
    getExtraData?: ExtraDataExtractor,
  ): Promise<void> {
    try {
      const extra =
        typeof getExtraData === 'function' ? await getExtraData() : null;
      const unwrapped = (error ?? Error('[Statsig] Error was empty')) as any;
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
      fetch(ExceptionEndpoint, {
        method: 'POST',
        headers: {
          'STATSIG-API-KEY': this.sdkKey,
          'STATSIG-SDK-TYPE': String(metadata['sdkType']),
          'STATSIG-SDK-VERSION': String(metadata['sdkVersion']),
          'Content-Type': 'application/json',
          'Content-Length': `${body.length}`,
        },
        body,
      }).catch(() => {});
    } catch (_error) {
      /* noop */
    }
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

  private getDescription(obj: any): string {
    try {
      return JSON.stringify(obj);
    } catch {
      return '[Statsig] Failed to get string for error.';
    }
  }
}

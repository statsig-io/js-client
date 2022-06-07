import {
  StatsigUninitializedError,
  StatsigInvalidArgumentError,
} from './Errors';
export const ExceptionEndpoint = 'https://statsigapi.net/v1/sdk_exception';

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

  swallow<T>(task: () => T) {
    this.capture(task, () => {
      return undefined;
    });
  }

  capture<T>(task: () => T, recover: () => T): T {
    try {
      const result = task();
      if (result instanceof Promise) {
        return (result as any).catch((e: unknown) => {
          return this.onCaught(e, recover);
        });
      }
      return result;
    } catch (error) {
      return this.onCaught(error, recover);
    }
  }

  private onCaught<T>(error: unknown, recover: () => T): T {
    if (
      error instanceof StatsigUninitializedError ||
      error instanceof StatsigInvalidArgumentError
    ) {
      throw error; // Don't catch these
    }

    console.error('[Statsig] An unexpected exception occurred.', error);

    this.logError(error);

    return recover();
  }

  private logError(error: unknown) {
    try {
      const unwrapped = (error ?? Error('[Statsig] Error was empty')) as any;
      const isError = unwrapped instanceof Error;
      const name = isError ? unwrapped.name : 'No Name';

      if (this.seen.has(name)) return;
      this.seen.add(name);

      const info = isError ? unwrapped.stack : this.getDescription(unwrapped);
      const body = JSON.stringify({
        exception: name,
        info,
        statsigMetadata: this.statsigMetadata ?? {},
      });
      fetch(ExceptionEndpoint, {
        method: 'POST',
        headers: {
          'STATSIG-API-KEY': this.sdkKey,
          'Content-Type': 'application/json',
          'Content-Length': `${body.length}`,
        },
        body,
      });
    } catch (_error) {
      /* noop */
    }
  }

  private getDescription(obj: any): string {
    try {
      return JSON.stringify(obj);
    } catch {
      return '[Statsig] Failed to get string for error.';
    }
  }
}

import { IHasStatsigInternal } from './StatsigClient';
import StatsigRuntime from './StatsigRuntime';
import { StatsigUser } from './StatsigUser';
import Diagnostics from './utils/Diagnostics';

export enum StatsigEndpoint {
  Initialize = 'initialize',
  Rgstr = 'rgstr',
  LogEventBeacon = 'log_event_beacon',
}

type NetworkResponse = Response & {
  data?: Record<string, unknown>;
};

const NO_CONTENT = 204;

/**
 * An extension of the promise type, it adds a
 * function `eventually`. In the event that the provided timeout
 * is reached, the function will still be called regardless.
 *
 * This function WILL NOT BE CALLED if the promise resolves normally.
 */
type PromiseWithTimeout<T> = Promise<T> & {
  eventually: (fn: (t: T) => void) => PromiseWithTimeout<T>;
};

export default class StatsigNetwork {
  private sdkInternal: IHasStatsigInternal;

  private readonly retryCodes: Record<number, boolean> = {
    408: true,
    500: true,
    502: true,
    503: true,
    504: true,
    522: true,
    524: true,
    599: true,
  };

  private leakyBucket: Record<string, number>;

  private canUseKeepalive = false;

  public constructor(sdkInternal: IHasStatsigInternal) {
    this.sdkInternal = sdkInternal;
    this.leakyBucket = {};
    this.init();
  }

  private init(): void {
    if (!this.sdkInternal.getOptions().getDisableNetworkKeepalive()) {
      try {
        this.canUseKeepalive = 'keepalive' in new Request('');
      } catch (_e) {
        this.canUseKeepalive = false;
      }
    }
  }

  public fetchValues(
    user: StatsigUser | null,
    sinceTime: number | null,
    timeout: number,
    prefetchUsers?: Record<string, StatsigUser>,
  ): PromiseWithTimeout<Record<string, unknown>> {
    const input = {
      user,
      prefetchUsers,
      statsigMetadata: this.sdkInternal.getStatsigMetadata(),
      sinceTime: sinceTime ?? undefined,
      acceptsDeltas: true,
      hash: 'djb2',
    };

    return this.postWithTimeout(StatsigEndpoint.Initialize, input, {
      timeout,
      retries: 3,
      diagnostics: Diagnostics.mark.intialize.networkRequest,
    });
  }

  private postWithTimeout<T>(
    endpointName: StatsigEndpoint,
    body: object,
    options?: {
      timeout?: number;
      retries?: number;
      backoff?: number;
      diagnostics?: typeof Diagnostics.mark.intialize.networkRequest | null;
    },
  ): PromiseWithTimeout<T> {
    const {
      timeout = 0,
      retries = 0,
      backoff = 1000,
      diagnostics = null,
    } = options ?? {};

    let hasTimedOut = false;
    let timer = null;
    let cachedReturnValue: T | null = null;
    let eventuals: ((t: T) => void)[] = [];

    const eventually =
      (boundScope: PromiseWithTimeout<T>) => (fn: (t: T) => void) => {
        if (hasTimedOut && cachedReturnValue) {
          fn(cachedReturnValue);
        } else {
          eventuals.push(fn);
        }

        return boundScope;
      };

    if (timeout != 0) {
      timer = new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          hasTimedOut = true;
          reject(
            new Error(
              `The initialization timeout of ${timeout}ms has been hit before the network request has completed.`,
            ),
          );
        }, timeout);
      });
    }
    let res: NetworkResponse;
    const fetchPromise = this.postToEndpoint(endpointName, body, {
      retryOptions: {
        retryLimit: retries,
        backoff,
      },
      diagnostics,
    })
      .then((localRes) => {
        res = localRes;
        if (!res.ok) {
          return Promise.reject(
            new Error(
              `Request to ${endpointName} failed with status ${res.status}`,
            ),
          );
        }

        if (typeof res.data !== 'object') {
          const error = new Error(
            `Request to ${endpointName} received invalid response type. Expected 'object' but got '${typeof res.data}'`,
          );
          this.sdkInternal
            .getErrorBoundary()
            .logError('postWithTimeoutInvalidRes', error, async () => {
              return this.getErrorData(
                endpointName,
                body,
                retries,
                backoff,
                res,
              );
            });
          return Promise.reject(error);
        }

        const json = res.data;
        return this.sdkInternal.getErrorBoundary().capture(
          'postWithTimeout',
          async () => {
            cachedReturnValue = json as T;
            if (hasTimedOut) {
              eventuals.forEach((fn) => fn(json as T));
              eventuals = [];
            }
            return Promise.resolve(json);
          },
          () => {
            return Promise.resolve({});
          },
          {
            getExtraData: async () => {
              return this.getErrorData(
                endpointName,
                body,
                retries,
                backoff,
                res,
              );
            },
          },
        );
      })
      .catch((e) => {
        return Promise.reject(e);
      });

    const racingPromise = (
      timer ? Promise.race([fetchPromise, timer]) : fetchPromise
    ) as PromiseWithTimeout<T>;
    racingPromise.eventually = eventually(racingPromise);

    return racingPromise;
  }

  public sendLogBeacon(payload: Record<string, unknown>): boolean {
    if (this.sdkInternal.getOptions().getLocalModeEnabled()) {
      return true;
    }
    const url = new URL(
      this.sdkInternal.getOptions().getEventLoggingApi() +
        StatsigEndpoint.LogEventBeacon,
    );
    url.searchParams.append('k', this.sdkInternal.getSDKKey());
    payload.clientTime = Date.now() + '';
    let stringPayload = null;
    try {
      stringPayload = JSON.stringify(payload);
    } catch (_e) {
      return false;
    }
    return navigator.sendBeacon(url.toString(), stringPayload);
  }

  public async postToEndpoint(
    endpointName: StatsigEndpoint,
    body: object,
    options?: {
      retryOptions?: {
        retryLimit?: number;
        attempt?: number;
        backoff?: number;
      };
      useKeepalive?: boolean;
      diagnostics?: typeof Diagnostics.mark.intialize.networkRequest | null;
    },
  ): Promise<NetworkResponse> {
    const { useKeepalive = false, diagnostics = null } = options ?? {};
    const {
      retryLimit = 0,
      attempt = 1,
      backoff = 1000,
    } = options?.retryOptions ?? {};

    if (this.sdkInternal.getOptions().getLocalModeEnabled()) {
      return Promise.reject('no network requests in localMode');
    }
    if (typeof fetch !== 'function') {
      // fetch is not defined in this environment, short circuit
      return Promise.reject('fetch is not defined');
    }

    if (
      typeof window === 'undefined' &&
      !this.sdkInternal.getOptions().getIgnoreWindowUndefined()
    ) {
      // by default, dont issue requests from the server
      return Promise.reject('window is not defined');
    }

    const api = [StatsigEndpoint.Initialize].includes(endpointName)
      ? this.sdkInternal.getOptions().getApi()
      : this.sdkInternal.getOptions().getEventLoggingApi();
    const fullUrl = new URL(api + endpointName);
    const url = fullUrl.toString();
    const counter = this.leakyBucket[url];
    if (counter != null && counter >= 30) {
      return Promise.reject(
        new Error(
          'Request failed because you are making the same request too frequently.',
        ),
      );
    }

    if (counter == null) {
      this.leakyBucket[url] = 1;
    } else {
      this.leakyBucket[url] = counter + 1;
    }

    fullUrl.searchParams.append('k', this.sdkInternal.getSDKKey());
    fullUrl.searchParams.append('t', Date.now() + '');
    fullUrl.searchParams.append('st', this.sdkInternal.getSDKType());
    fullUrl.searchParams.append('sv', this.sdkInternal.getSDKVersion());

    let shouldEncode =
      endpointName === StatsigEndpoint.Initialize &&
      StatsigRuntime.encodeInitializeCall &&
      typeof window !== 'undefined' &&
      typeof window?.btoa === 'function';

    let postBody = JSON.stringify(body);
    if (shouldEncode) {
      try {
        const encoded = window.btoa(postBody).split('').reverse().join('');
        postBody = encoded;
        fullUrl.searchParams.append('se', '1');
      } catch (_e) {
        shouldEncode = false;
      }
    }

    const params: RequestInit = {
      method: 'POST',
      body: postBody,
      headers: {
        'Content-Type': 'text/plain',
      },
    };

    if (this.canUseKeepalive && useKeepalive) {
      params.keepalive = true;
    }

    diagnostics?.start({ attempt: attempt });
    let res: Response;
    let isRetryCode = true;
    return fetch(fullUrl.toString(), params)
      .then(async (localRes) => {
        res = localRes;
        if (res.ok) {
          const networkResponse = res as NetworkResponse;
          if (res.status === NO_CONTENT) {
            networkResponse.data = { has_updates: false, is_no_content: true };
          } else {
            const text = await res.text();
            networkResponse.data = JSON.parse(text);
          }
          diagnostics?.end(this.getDiagnosticsData(res, attempt));
          return Promise.resolve(networkResponse);
        }
        if (!this.retryCodes[res.status]) {
          isRetryCode = false;
        }
        const errorText = await res.text();
        return Promise.reject(new Error(`${res.status}: ${errorText}`));
      })
      .catch((e) => {
        diagnostics?.end(this.getDiagnosticsData(res, attempt));
        if (attempt < retryLimit && isRetryCode) {
          return new Promise<NetworkResponse>((resolve, reject) => {
            setTimeout(() => {
              this.leakyBucket[url] = Math.max(this.leakyBucket[url] - 1, 0);
              this.postToEndpoint(endpointName, body, {
                retryOptions: {
                  retryLimit,
                  attempt: attempt + 1,
                  backoff: backoff * 2,
                },
                useKeepalive,
                diagnostics,
              })
                .then(resolve)
                .catch(reject);
            }, backoff);
          });
        }
        return Promise.reject(e);
      })
      .finally(() => {
        this.leakyBucket[url] = Math.max(this.leakyBucket[url] - 1, 0);
      });
  }

  public supportsKeepalive(): boolean {
    return this.canUseKeepalive;
  }

  private getDiagnosticsData(
    res: NetworkResponse,
    attempt: number,
  ): {
    success: boolean;
    isDelta?: boolean;
    sdkRegion?: string | null;
    statusCode?: number;
    attempt: number;
  } {
    return {
      success: res?.ok === true,
      statusCode: res?.status,
      sdkRegion: res?.headers?.get('x-statsig-region'),
      isDelta: res?.data?.is_delta === true,
      attempt,
    };
  }

  private async getErrorData(
    endpointName: StatsigEndpoint,
    body: object,
    retries: number,
    backoff: number,
    res: NetworkResponse,
  ): Promise<Record<string, unknown>> {
    try {
      const headers: Record<string, string> = {};
      (res.headers ?? []).forEach((value, key) => {
        headers[key] = value;
      });
      return {
        responseInfo: {
          headers,
          status: res.status,
          statusText: res.statusText,
          type: res.type,
          url: res.url,
          redirected: res.redirected,
          bodySnippet: res.data ? JSON.stringify(res.data).slice(0, 500) : null,
        },
        requestInfo: {
          endpointName: endpointName,
          bodySnippet: JSON.stringify(body).slice(0, 500),
          retries: retries,
          backoff: backoff,
        },
      };
    } catch (_e) {
      return {
        statusText: 'statsig::failed to extract extra data',
      };
    }
  }
}

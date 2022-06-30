import { IHasStatsigInternal } from './StatsigClient';
import { StatsigUser } from './StatsigUser';

export enum StatsigEndpoint {
  Initialize = 'initialize',
  Rgstr = 'rgstr',
  LogEventBeacon = 'log_event_beacon',
}

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

  private canUseKeepalive: boolean = false;

  public constructor(sdkInternal: IHasStatsigInternal) {
    this.sdkInternal = sdkInternal;
    this.leakyBucket = {};
    this.init();
  }

  private init(): void {
    if (!this.sdkInternal.getOptions().getDisableNetworkKeepalive()) {
      try {
        this.canUseKeepalive = 'keepalive' in new Request('');
      } catch (_e) {}
    }
  }

  public fetchValues(
    user: StatsigUser | null,
    timeout: number,
    resolveCallback: (json: Record<string, any>) => void,
    rejectCallback: (e: Error) => void,
  ): Promise<void> {
    return this.postWithTimeout(
      StatsigEndpoint.Initialize,
      {
        user: user,
        statsigMetadata: this.sdkInternal.getStatsigMetadata(),
      },
      resolveCallback,
      rejectCallback,
      timeout, // timeout for early returns
      10, // retries
    );
  }

  private postWithTimeout(
    endpointName: StatsigEndpoint,
    body: object,
    resolveCallback: (json: Record<string, any>) => void,
    rejectCallback: (e: Error) => void,
    timeout: number = 0,
    retries: number = 0,
    backoff: number = 1000,
  ): Promise<void> {
    const fetchPromise = this.postToEndpoint(
      endpointName,
      body,
      retries,
      backoff,
    )
      .then((res) => {
        if (res.ok) {
          return this.sdkInternal.getErrorBoundary().capture(
            () =>
              res.json().then((json: Record<string, any>) => {
                resolveCallback(json);
                return Promise.resolve(json);
              }),
            () => Promise.resolve({}),
          );
        }

        return Promise.reject(
          new Error(
            'Request to ' + endpointName + ' failed with status ' + res.status,
          ),
        );
      })
      .catch((e) => {
        if (typeof rejectCallback === 'function') {
          rejectCallback(e);
        }
        return Promise.reject(e);
      });

    if (timeout != 0) {
      const timer = new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          resolve();
        }, timeout);
      });
      return Promise.race([fetchPromise, timer]);
    }
    return fetchPromise;
  }

  public sendLogBeacon(payload: Record<string, any>): boolean {
    if (this.sdkInternal.getOptions().getLocalModeEnabled()) {
      return true;
    }
    const url = new URL(
      this.sdkInternal.getOptions().getApi() + StatsigEndpoint.LogEventBeacon,
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

  public postToEndpoint(
    endpointName: StatsigEndpoint,
    body: object,
    retries: number = 0,
    backoff: number = 1000,
    useKeepalive: boolean = false,
  ): Promise<any> {
    if (this.sdkInternal.getOptions().getLocalModeEnabled()) {
      return Promise.reject('no network requests in localMode');
    }
    if (typeof fetch !== 'function') {
      // fetch is not defined in this environment, short circuit
      return Promise.reject('fetch is not defined');
    }

    if (typeof window === 'undefined') {
      // dont issue requests from the server
      return Promise.reject('window is not defined');
    }
    const url = this.sdkInternal.getOptions().getApi() + endpointName;
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

    const params: RequestInit = {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
        'STATSIG-API-KEY': this.sdkInternal.getSDKKey(),
        'STATSIG-CLIENT-TIME': Date.now() + '',
      },
    };

    if (this.canUseKeepalive && useKeepalive) {
      params.keepalive = true;
    }

    return fetch(url, params)
      .then((res) => {
        if (res.ok) {
          return Promise.resolve(res);
        }
        if (!this.retryCodes[res.status]) {
          retries = 0;
        }
        return res.text().then((errorText) => {
          return Promise.reject(new Error(`${res.status}: ${errorText}`));
        });
      })
      .catch((e) => {
        if (retries > 0) {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              this.leakyBucket[url] = Math.max(this.leakyBucket[url] - 1, 0);
              this.postToEndpoint(endpointName, body, retries - 1, backoff * 2)
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
}

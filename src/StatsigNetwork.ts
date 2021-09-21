import { IHasStatsigInternal } from './StatsigClient';
import { StatsigUser } from './StatsigUser';

export default class StatsigNetwork {
  private sdkInternal: IHasStatsigInternal;

  private readonly retryCodes = [408, 500, 502, 503, 504, 522, 524, 599];

  private leakyBucket: Record<string, number>;

  public constructor(sdkInternal: IHasStatsigInternal) {
    this.sdkInternal = sdkInternal;
    this.leakyBucket = {};
  }

  public fetchValues(
    user: StatsigUser | null,
    resolveCallback: (json: Record<string, any>) => void,
    rejectCallback: (e: Error) => void,
  ): Promise<void> {
    return this.postWithTimeout(
      'initialize',
      {
        user: user,
        statsigMetadata: this.sdkInternal.getStatsigMetadata(),
      },
      resolveCallback,
      rejectCallback,
      3000, // timeout for early returns
      10, // retries
    );
  }

  private postWithTimeout(
    path: string,
    body: object,
    resolveCallback: (json: Record<string, any>) => void,
    rejectCallback: (e: Error) => void,
    timeout: number = 0,
    retries: number = 0,
    backoff: number = 1000,
  ): Promise<void> {
    const fetchPromise = this.post(path, body, retries, backoff)
      .then((res) => {
        if (res.ok) {
          return res.json().then((json: Record<string, any>) => {
            resolveCallback(json);
            return Promise.resolve(json);
          });
        }

        return Promise.reject(
          new Error('Request to ' + path + ' failed with status ' + res.status),
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

  public post(
    path: string,
    body: object,
    retries: number = 0,
    backoff: number = 1000,
  ): Promise<any> {
    const url = this.sdkInternal.getOptions().getApi() + path;
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

    const params = {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
        'STATSIG-API-KEY': this.sdkInternal.getSDKKey(),
        'STATSIG-CLIENT-TIME': Date.now() + '',
      },
      keepalive: true,
    };

    return fetch(url, params)
      .then((res) => {
        if (res.ok) {
          return Promise.resolve(res);
        }
        if (!this.retryCodes.includes(res.status)) {
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
              this.post(url, body, retries - 1, backoff * 2)
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
}

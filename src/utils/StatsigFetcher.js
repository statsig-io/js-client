const retryCodes = [408, 500, 502, 503, 504, 522, 524, 599];

const fetcher = {
  init: function () {
    if (fetcher.leakyBucket == null) {
      fetcher.leakyBucket = {};
    }
  },

  /**
   * Helper function to help make a post request with a timeout to resolve early.
   * Optional resolve and reject callbacks can be provided to be executed when the
   * post request finishes, whether before or after the timeout. Also optional params
   * can be provided to add retries for the post request with a backoff timer.
   */
  postWithTimeout: function (
    url,
    sdkKey,
    body,
    resolveCallback,
    rejectCallback,
    timeout,
    retries = 0,
    backout = 1000,
  ) {
    if (typeof url !== 'string' || url.length === 0) {
      return Promise.reject(new Error('url is invalid.'));
    }
    const fetchPromise = this.post(url, sdkKey, body, retries, backout)
      .then((res) => {
        if (res.ok) {
          return res.json().then((json) => {
            if (typeof resolveCallback === 'function') {
              resolveCallback(json);
            }
            return Promise.resolve(json);
          });
        }
        return Promise.reject(
          'Request to ' + url + ' failed with status ' + res.status,
        );
      })
      .catch((e) => {
        if (typeof rejectCallback === 'function') {
          rejectCallback(e);
        }
        return Promise.reject(e);
      });

    if (timeout != null && typeof timeout === 'number') {
      const timer = new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve();
        }, timeout);
      });
      return Promise.race([fetchPromise, timer]);
    }
    return fetchPromise;
  },

  post: function (url, sdkKey, body, retries = 0, backoff = 1000) {
    this.init();
    const counter = fetcher.leakyBucket[url];
    if (counter != null && counter >= 30) {
      return Promise.reject(
        new Error(
          'Request failed because you are making the same request too frequently.',
        ),
      );
    }
    if (counter == null) {
      fetcher.leakyBucket[url] = 1;
    } else {
      fetcher.leakyBucket[url] = counter + 1;
    }
    const params = {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
        'STATSIG-API-KEY': sdkKey,
        'STATSIG-CLIENT-TIME': Date.now(),
      },
      keepalive: true,
    };
    // @ts-ignore
    return fetch(url, params)
      .then((res) => {
        if (res.ok) {
          return Promise.resolve(res);
        }
        if (!retryCodes.includes(res.status)) {
          retries = 0;
        }
        return Promise.reject(
          'Request to ' + url + ' failed with status ' + res.status,
        );
      })
      .catch((e) => {
        if (retries > 0) {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              fetcher.leakyBucket[url] = Math.max(
                fetcher.leakyBucket[url] - 1,
                0,
              );
              this.post(url, sdkKey, body, retries - 1, backoff * 2)
                .then(resolve)
                .catch(reject);
            }, backoff);
          });
        }
        return Promise.reject(e);
      })
      .finally(() => {
        fetcher.leakyBucket[url] = Math.max(fetcher.leakyBucket[url] - 1, 0);
      });
  },
};

export default fetcher;

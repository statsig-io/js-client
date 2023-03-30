/**
 * @jest-environment jsdom
 */

import Statsig from '..';
import { getHashValue } from '../utils/Hashing';

const initialValues = {
  feature_gates: {
    [getHashValue('bootstrapped_gate')]: {
      value: true,
    },
  },
  dynamic_configs: {},
  layer_configs: {},
  sdkParams: {},
  has_updates: true,
  time: 1647984444418,
};

describe('StatsigOptions.PreferCache', () => {
  let requests: {
    url: string;
    body: Record<string, unknown>;
  }[] = [];

  beforeEach(async () => {
    Statsig.encodeIntializeCall = false;

    // @ts-ignore
    global.fetch = jest.fn((url, params) => {
      if (!url.toString().includes('/v1/initialize')) {
        return;
      }

      const body = JSON.parse(params?.body as string) as Record<
        string,
        unknown
      >;
      requests.push({
        url: url.toString(),
        body,
      });

      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              ...initialValues,
              feature_gates: {
                [getHashValue('fetched_gate')]: {
                  value: true,
                },
              },
              prefetched_user_values: !body['prefetchUsers']
                ? undefined
                : {
                    '1240249408' /*prefetchd_user*/: {
                      feature_gates: {
                        [getHashValue('prefetched_gate')]: {
                          value: true,
                        },
                      },
                      dynamic_configs: {},
                      layer_configs: {},
                      has_updates: true,
                    },
                  },
            }),
          ),
      });
    });

    localStorage.clear();

    // @ts-ignore
    Statsig.instance = null;
  });

  afterEach(() => {
    Statsig.shutdown();
  });

  describe('Standard Initialization', () => {
    beforeEach(async () => {
      await Statsig.initialize(
        'client-key',
        { userID: 'initial_user' },
        { fetchMode: 'cache-or-network' },
      );

      requests = [];
    });

    it('does not make requests when switching to a cached user', async () => {
      await Statsig.updateUser({ userID: 'initial_user' });
      expect(requests.length).toBe(0);
    });

    it('makes a request when switching to an outdated cache value', async () => {
      (Statsig as any).instance.startTime = Date.now() + 1000 * 60;
      await Statsig.updateUser({ userID: 'initial_user' });
      expect(requests.length).toBe(1);
    });

    it('makes a request when switching to a non-cached user', async () => {
      await Statsig.updateUser({ userID: 'new_user' });
      expect(requests.length).toBe(1);
    });

    it('does not make requests with repeated calls', async () => {
      await Statsig.updateUser({ userID: 'new_user' });
      requests = [];

      await Statsig.updateUser({ userID: 'new_user' });
      expect(requests.length).toBe(0);
    });
  });

  describe('Prefetch Initialization', () => {
    beforeEach(async () => {
      await Statsig.initialize(
        'client-key',
        { userID: 'initial_user' },
        {
          fetchMode: 'cache-or-network',
          prefetchUsers: [{ userID: 'prefetched_user' }],
        },
      );

      requests = [];
    });

    it('does not make requests when switching to a prefetched user', async () => {
      await Statsig.updateUser({ userID: 'prefetched_user' });
      expect(requests.length).toBe(0);
    });

    it('cache time does not interfer with updating to prefetched users', async () => {
      (Statsig as any).instance.startTime = Date.now() + 1000 * 60;
      await Statsig.updateUser({ userID: 'prefetched_user' });
      expect(requests.length).toBe(0);
    });

    it('makes a request when switching to a non-prefetched user', async () => {
      await Statsig.updateUser({ userID: 'network_user' });
      expect(requests.length).toBe(1);
    });

    it('does not make requests switching between cached and prefetched', async () => {
      await Statsig.updateUser({ userID: 'prefetched_user' });
      await Statsig.updateUser({ userID: 'initial_user' });
      expect(requests.length).toBe(0);
    });
  });

  describe('Bootstrap Initialization', () => {
    beforeEach(async () => {
      await Statsig.initialize(
        'client-key',
        { userID: 'bootstrapped_user' },
        {
          fetchMode: 'cache-or-network',
          prefetchUsers: [{ userID: 'prefetched_user' }],
          initializeValues: initialValues,
        },
      );

      requests = [];
    });

    it('does not make requests when switching to a bootstrapped user', async () => {
      await Statsig.updateUser({ userID: 'bootstrapped_user' });
      expect(requests.length).toBe(0);
    });

    it('makes a request when switching to an outdated cache value', async () => {
      (Statsig as any).instance.startTime = Date.now() + 1000 * 60;
      await Statsig.updateUser({ userID: 'bootstrapped_user' });
      expect(requests.length).toBe(1);
    });

    it('makes a request when switching to a non-bootstrapped user', async () => {
      await Statsig.updateUser({ userID: 'network_user' });
      expect(requests.length).toBe(1);
    });

    it('does not make requests switching between cached, bootstrapped and prefetched', async () => {
      await Statsig.updateUser({ userID: 'network_user' });
      requests = [];

      await Statsig.updateUser({ userID: 'bootstrapped_user' });
      await Statsig.updateUser({ userID: 'network_user' });
      await Statsig.updateUser({ userID: 'prefetched_user' });
      expect(requests.length).toBe(0);
    });
  });
});

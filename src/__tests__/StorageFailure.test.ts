/**
 * @jest-environment jsdom
 */

import StatsigClient from '../StatsigClient';
import { INTERNAL_STORE_KEY } from '../utils/Constants';
import LocalStorageMock from './LocalStorageMock';
import LocalStorageThrowingMock from './LocalStorageThrowingMock';

describe('Verify behavior of StatsigClient', () => {
  const sdkKey = 'client-clienttestkey';

  // @ts-ignore
  global.fetch = jest.fn(() => {
    return new Promise((resolve) => {
      // @ts-ignore
      return resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              feature_gates: {
                'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=': {
                  value: true,
                  rule_id: 'network',
                },
              },
              dynamic_configs: {
                'RMv0YJlLOBe7cY7HgZ3Jox34R0Wrk7jLv3DZyBETA7I=': {
                  value: {
                    param: 'network',
                  },
                  rule_id: 'network',
                },
              },
              has_updates: true,
            }),
          ),
      });
    });
  });

  const localStorage = new LocalStorageThrowingMock();
  // @ts-ignore
  Object.defineProperty(window, 'localStorage', {
    value: localStorage,
  });

  beforeEach(() => {
    localStorage.clear();
  });

  test('storage is cleared when exception thrown when writing', async () => {
    const statsig = new StatsigClient(sdkKey, { userID: '123' });
    await statsig.initializeAsync();

    // test_gate is true from network
    expect(statsig.checkGate('test_gate')).toBe(true);
    expect(
      statsig.getConfig('test_config').get<string>('param', 'default'),
    ).toEqual('network');

    // Constructing a new client, which reads from storage, should have the
    // updated values from the cache
    // but the cache was cleared on an exception writing to storage
    const newerStatsig = new StatsigClient(sdkKey, { userID: '123' }, {localMode: true});
    newerStatsig.initializeAsync();
    expect(newerStatsig.checkGate('test_gate')).toBe(false);
  });
});

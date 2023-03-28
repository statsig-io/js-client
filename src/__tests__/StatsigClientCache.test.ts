/**
 * @jest-environment jsdom
 */

import StatsigClient from '../StatsigClient';

describe('Verify behavior of StatsigClient', () => {
  const sdkKey = 'client-clienttestkey';
  jest.useFakeTimers();

  const values = {
    feature_gates: {
      'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=': {
        value: true,
        rule_id: 'cache',
      },
    },
    dynamic_configs: {
      'RMv0YJlLOBe7cY7HgZ3Jox34R0Wrk7jLv3DZyBETA7I=': {
        value: {
          param: 'cache',
        },
        rule_id: 'cache',
      },
    },
  };

  let requestTimeoutTime = 1000;

  // @ts-ignore
  global.fetch = jest.fn(() => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // @ts-ignore
        resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                feature_gates: {
                  'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=': {
                    value: false,
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
      }, requestTimeoutTime);
    });
  });

  beforeEach(() => {
    requestTimeoutTime = 1000
  });

  test('cache used before initialize resolves, then network result used', async () => {
    expect.assertions(7);
    const statsig = new StatsigClient(sdkKey, { userID: '123' });
    await statsig.getStore().save({ userID: '123' }, values);
    expect(statsig.initializeCalled()).toBe(false)
    const init = statsig.initializeAsync();

    expect(statsig.initializeCalled()).toBe(true);

    // test_gate is true from the cache
    expect(statsig.checkGate('test_gate')).toBe(true);
    expect(
      statsig.getConfig('test_config').get<string>('param', 'default'),
    ).toEqual('cache');
    jest.advanceTimersByTime(2000);
    await init;
    expect(statsig.initializeCalled()).toBe(true)
    jest.advanceTimersByTime(2000);
    expect(statsig.checkGate('test_gate')).toBe(false);
    expect(
      statsig.getConfig('test_config').get<string>('param', 'default'),
    ).toEqual('network');
  });

  test('storage is updated but cache is not when the request time exceeds the timeout', async () => {
    requestTimeoutTime = 10000;
    const statsig = new StatsigClient(sdkKey, { userID: '123' });
    await statsig.getStore().save({ userID: '123' }, values);
    const init = statsig.initializeAsync();

    expect(statsig.initializeCalled()).toBe(true);

    // test_gate is true from the cache
    expect(statsig.checkGate('test_gate')).toBe(true);
    expect(
      statsig.getConfig('test_config').get<string>('param', 'default'),
    ).toEqual('cache');
    jest.advanceTimersByTime(10000);
    await init;


    // Test gate should still return the same value, because the request timed out
    expect(statsig.checkGate('test_gate')).toBe(true);
    expect(
      statsig.getConfig('test_config').get<string>('param', 'default'),
    ).toEqual('cache');

    // Constructing a new client, which reads from storage, should have the
    // updated values from the cache
    const newerStatsig = new StatsigClient(sdkKey, { userID: '123' });
    expect(newerStatsig.checkGate('test_gate')).toBe(false);
  });
});

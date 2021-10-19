/**
 * @jest-environment jsdom
 */

import StatsigClient from '../StatsigClient';
import StatsigAsyncStorage from '../utils/StatsigAsyncLocalStorage';
import StatsigStore from '../StatsigStore';
describe('Verify behavior of StatsigClient', () => {
  const sdkKey = 'client-clienttestkey';
  jest.useFakeTimers();

  class LocalStorageMock {
    private store: Record<string, string>;
    constructor() {
      this.store = {
        STATSIG_LOCAL_STORAGE_INTERNAL_STORE_V3: JSON.stringify({
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
        }),
      };
    }

    clear() {
      this.store = {};
    }

    getItem(key: string) {
      return this.store[key] || null;
    }

    setItem(key: string, value: string) {
      this.store[key] = String(value);
    }

    removeItem(key: string) {
      delete this.store[key];
    }
  }
  const localStorage = new LocalStorageMock();
  // @ts-ignore
  Object.defineProperty(window, 'localStorage', {
    value: localStorage,
  });

  // @ts-ignore
  global.fetch = jest.fn(() => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // @ts-ignore
        resolve({
          ok: true,
          json: () =>
            Promise.resolve({
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
            }),
        });
      }, 1000);
    });
  });

  test('Test constructor', () => {
    expect.assertions(4);
    const client = new StatsigClient();
    expect(() => {
      client.checkGate('gate');
    }).toThrowError('Call and wait for initialize() to finish first.');
    expect(() => {
      client.getConfig('config');
    }).toThrowError('Call and wait for initialize() to finish first.');
    expect(() => {
      client.getExperiment('experiment');
    }).toThrowError('Call and wait for initialize() to finish first.');
    expect(() => {
      client.logEvent('event');
    }).toThrowError('Must initialize() before logging events.');
  });

  test('cache used before initialize resolves, then network result used', async () => {
    expect.assertions(4);
    const statsig = new StatsigClient();
    const init = statsig.initializeAsync(sdkKey, { userID: '123' });

    // test_gate is true from the cache
    expect(statsig.checkGate('test_gate')).toBe(true);
    expect(
      statsig.getConfig('test_config').get<string>('param', 'default'),
    ).toEqual('cache');

    jest.advanceTimersByTime(2000);
    await init;

    expect(statsig.checkGate('test_gate')).toBe(false);
    expect(
      statsig.getConfig('test_config').get<string>('param', 'default'),
    ).toEqual('network');
  });
});

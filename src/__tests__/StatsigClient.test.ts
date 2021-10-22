/**
 * @jest-environment jsdom
 */

import StatsigClient from '../StatsigClient';
import StatsigAsyncStorage from '../utils/StatsigAsyncLocalStorage';

describe('Verify behavior of StatsigClient', () => {
  const sdkKey = 'client-clienttestkey';

  // @ts-ignore
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          feature_gates: {
            'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=': {
              value: true,
              rule_id: 'ruleID123',
            },
          },
        }),
    }),
  );

  test('Test constructor will populate from cache on create', () => {
    expect.assertions(4);
    const client = new StatsigClient(sdkKey);
    expect(() => {
      client.checkGate('gate');
    }).not.toThrow();
    expect(() => {
      client.getConfig('config');
    }).not.toThrow();
    expect(() => {
      client.getExperiment('experiment');
    }).not.toThrow();
    expect(() => {
      client.logEvent('event');
    }).not.toThrow();
  });

  test('that override APIs work', async () => {
    expect.assertions(10);
    const statsig = new StatsigClient(sdkKey, { userID: '123' });
    await statsig.initializeAsync();
    expect(statsig.getOptions().getLoggingBufferMaxSize()).toEqual(10);
    expect(statsig.getOptions().getLoggingIntervalMillis()).toEqual(5000);

    // test_gate is true without override
    expect(statsig.checkGate('test_gate')).toBe(true);

    // becomes false with override
    statsig.overrideGate('test_gate', false);
    expect(statsig.checkGate('test_gate')).toBe(false);
    expect(statsig.getOverrides()).toEqual({ test_gate: false });

    // overriding non-existent gate does not do anything
    statsig.overrideGate('fake_gate', true);
    expect(statsig.getOverrides()).toEqual({ test_gate: false });

    // remove all overrides
    statsig.removeOverride();
    expect(statsig.getOverrides()).toEqual({});

    // remove a named override
    statsig.overrideGate('test_gate', false);
    expect(statsig.checkGate('test_gate')).toBe(false);
    expect(statsig.getOverrides()).toEqual({ test_gate: false });
    statsig.removeOverride('test_gate');
    expect(statsig.getOverrides()).toEqual({});
  });

  test('that async storage works', async () => {
    expect.assertions(4);
    const statsig = new StatsigClient(
      sdkKey,
      { userID: '123' },
      {
        loggingBufferMaxSize: 600,
        loggingIntervalMillis: 100,
      },
    );
    const store: Record<string, string> = {};
    StatsigClient.setAsyncStorage({
      getItem(key: string): Promise<string | null> {
        return Promise.resolve(store[key] ?? null);
      },
      setItem(key: string, value: string): Promise<void> {
        store[key] = value;
        return Promise.resolve();
      },
      removeItem(key: string): Promise<void> {
        delete store[key];
        return Promise.resolve();
      },
    });

    const spyOnSet = jest.spyOn(StatsigAsyncStorage, 'setItemAsync');
    const spyOnGet = jest.spyOn(StatsigAsyncStorage, 'getItemAsync');

    await statsig.initializeAsync();

    expect(statsig.getOptions().getLoggingBufferMaxSize()).toEqual(500);
    expect(statsig.getOptions().getLoggingIntervalMillis()).toEqual(1000);

    // Set the stable id, save the configs
    expect(spyOnSet).toHaveBeenCalledTimes(2);
    // Get the stable id, 3 saved configs, and saved logs
    expect(spyOnGet).toHaveBeenCalledTimes(5);
  });
});

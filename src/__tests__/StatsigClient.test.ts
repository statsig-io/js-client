/**
 * @jest-environment jsdom
 */

import { parse } from 'uuid';

import StatsigClient from '../StatsigClient';
import StatsigSDKOptions from '../StatsigSDKOptions';
import StatsigAsyncStorage from '../utils/StatsigAsyncLocalStorage';

describe('Verify behavior of StatsigClient', () => {
  const sdkKey = 'client-clienttestkey';
  var parsedRequestBody;
  // @ts-ignore
  global.fetch = jest.fn((url, params) => {
    parsedRequestBody = JSON.parse(params.body as string);
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          feature_gates: {
            'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=': {
              value: true,
              rule_id: 'ruleID123',
            },
          },
          dynamic_configs: {
            'RMv0YJlLOBe7cY7HgZ3Jox34R0Wrk7jLv3DZyBETA7I=': {
              value: {
                num: 4,
              },
            },
          },
        }),
    });
  });

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    StatsigAsyncStorage.asyncStorage = null;
  });

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

  test('that you can ignore an override to get the underlying value', async () => {
    expect.assertions(9);
    const statsig = new StatsigClient(sdkKey, { userID: '123' });
    await statsig.initializeAsync();

    expect(statsig.checkGate('test_gate')).toBe(true);
    statsig.overrideGate('test_gate', false);
    expect(statsig.checkGate('test_gate', false)).toBe(false);
    expect(statsig.checkGate('test_gate', true)).toBe(true);

    expect(statsig.getConfig('test_config').getValue()).toEqual({ num: 4 });
    statsig.overrideConfig('test_config', { str: 'test', num: 7 });
    expect(statsig.getConfig('test_config', false).getValue()).toEqual({
      str: 'test',
      num: 7,
    });
    expect(statsig.getConfig('test_config', true).getValue()).toEqual({
      num: 4,
    });

    expect(
      statsig.getExperiment('test_config', false, true).getValue(),
    ).toEqual({
      num: 4,
    });
    statsig.overrideConfig('test_config', { str: 'exp', num: 12 });
    expect(
      statsig.getExperiment('test_config', false, false).getValue(),
    ).toEqual({
      str: 'exp',
      num: 12,
    });
    expect(
      statsig.getExperiment('test_config', false, true).getValue(),
    ).toEqual({
      num: 4,
    });
  });

  test('that async storage works', async () => {
    expect.assertions(4);
    setFakeAsyncStorage();
    const spyOnSet = jest.spyOn(StatsigAsyncStorage, 'setItemAsync');
    const spyOnGet = jest.spyOn(StatsigAsyncStorage, 'getItemAsync');
    const statsig = new StatsigClient(
      sdkKey,
      { userID: '123' },
      {
        loggingBufferMaxSize: 600,
        loggingIntervalMillis: 100,
      },
    );

    await statsig.initializeAsync();

    expect(statsig.getOptions().getLoggingBufferMaxSize()).toEqual(500);
    expect(statsig.getOptions().getLoggingIntervalMillis()).toEqual(1000);

    // Set the stable id, save the configs
    expect(spyOnSet).toHaveBeenCalledTimes(2);
    // Get the stable id, 3 saved configs, and saved logs
    expect(spyOnGet).toHaveBeenCalledTimes(5);
  });

  test('that overrideStableID works for local storage and gets set correctly in request', async () => {
    expect.assertions(7);
    StatsigAsyncStorage.asyncStorage = null;

    const statsig = new StatsigClient(sdkKey);
    await statsig.initializeAsync();
    let stableID = parsedRequestBody['statsigMetadata']['stableID'];
    expect(stableID).toBeTruthy();
    expect(statsig.getStableID()).toEqual(stableID);

    const statsig2 = new StatsigClient(sdkKey, null, {
      overrideStableID: '123',
    });
    await statsig2.initializeAsync();
    expect(parsedRequestBody['statsigMetadata']['stableID']).not.toEqual(
      stableID,
    );
    expect(parsedRequestBody['statsigMetadata']['stableID']).toEqual('123');
    expect(statsig2.getStableID()).toEqual('123');

    const statsig3 = new StatsigClient(sdkKey, null, {
      overrideStableID: '456',
    });
    await statsig3.initializeAsync();
    expect(parsedRequestBody['statsigMetadata']['stableID']).toEqual('456');

    const statsig4 = new StatsigClient(sdkKey, null);
    await statsig4.initializeAsync();
    expect(parsedRequestBody['statsigMetadata']['stableID']).toEqual('456');
  });

  test('that overrideStableID works for async storage and gets set correctly in request', async () => {
    expect.assertions(7);
    setFakeAsyncStorage();

    const statsig = new StatsigClient(sdkKey);
    await statsig.initializeAsync();
    let stableID = parsedRequestBody['statsigMetadata']['stableID'];
    expect(stableID).toBeTruthy();
    expect(statsig.getStableID()).toEqual(stableID);

    const statsig2 = new StatsigClient(sdkKey, null, {
      overrideStableID: '123',
    });
    await statsig2.initializeAsync();
    expect(parsedRequestBody['statsigMetadata']['stableID']).not.toEqual(
      stableID,
    );
    expect(parsedRequestBody['statsigMetadata']['stableID']).toEqual('123');
    expect(statsig2.getStableID()).toEqual('123');

    const statsig3 = new StatsigClient(sdkKey, null, {
      overrideStableID: '456',
    });
    await statsig3.initializeAsync();
    expect(parsedRequestBody['statsigMetadata']['stableID']).toEqual('456');

    const statsig4 = new StatsigClient(sdkKey, null);
    await statsig4.initializeAsync();
    expect(parsedRequestBody['statsigMetadata']['stableID']).toEqual('456');
  });
});

function setFakeAsyncStorage() {
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
}

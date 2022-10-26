/**
 * @jest-environment jsdom
 */

import StatsigClient from '../StatsigClient';
import { EvaluationReason } from '../StatsigStore';
import StatsigAsyncStorage from '../utils/StatsigAsyncStorage';
import * as TestData from './initialize_response.json';
import LocalStorageMock from './LocalStorageMock';
import Statsig from '..';

describe('Verify behavior of StatsigClient', () => {
  const sdkKey = 'client-clienttestkey';
  var parsedRequestBody;
  // @ts-ignore
  global.fetch = jest.fn((url, params) => {
    if (
      url &&
      typeof url === 'string' &&
      url.includes('initialize') &&
      url !== 'https://featuregates.org/v1/initialize'
    ) {
      return Promise.reject(new Error('invalid initialize endpoint'));
    }
    parsedRequestBody = JSON.parse(params?.body as string);
    return Promise.resolve({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
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
            has_updates: true,
          }),
        ),
    });
  });

  const localStorage = new LocalStorageMock();
  // @ts-ignore
  Object.defineProperty(window, 'localStorage', {
    value: localStorage,
  });

  beforeEach(() => {
    jest.resetModules();
    parsedRequestBody = null;

    Statsig.encodeIntializeCall = false;
    window.localStorage.clear();
  });

  afterEach(() => {
    // @ts-ignore
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
    expect(statsig.getOptions().getLoggingBufferMaxSize()).toEqual(100);
    expect(statsig.getOptions().getLoggingIntervalMillis()).toEqual(10000);

    // test_gate is true without override
    expect(statsig.checkGate('test_gate')).toBe(true);

    // becomes false with override
    statsig.overrideGate('test_gate', false);
    expect(statsig.checkGate('test_gate')).toBe(false);
    expect(statsig.getOverrides()).toEqual({ test_gate: false });

    // overriding non-existent gate
    statsig.overrideGate('fake_gate', true);
    expect(statsig.getOverrides()).toEqual({
      test_gate: false,
      fake_gate: true,
    });

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

  test('that environment does not modify the passed in user', async () => {
    expect.assertions(3);
    const user = { userID: '123' };
    const statsig = new StatsigClient(sdkKey, user, {
      environment: {
        tier: 'development',
      },
    });
    await statsig.initializeAsync();
    expect(statsig.getOptions().getEnvironment()).toEqual({
      tier: 'development',
    });
    expect(user).toEqual({ userID: '123' });

    const newUser = { userID: 'abc' };
    await statsig.updateUser(newUser);

    expect(newUser).toEqual({ userID: 'abc' });
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
    expect.assertions(6);
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

    expect(statsig.getOptions().getApi()).toEqual(
      'https://featuregates.org/v1/',
    );
    expect(statsig.getOptions().getLoggingBufferMaxSize()).toEqual(500);
    expect(statsig.getOptions().getLoggingIntervalMillis()).toEqual(1000);
    expect(statsig.getOptions().getEventLoggingApi()).toEqual(
      'https://events.statsigapi.net/v1/',
    );

    // Set the stable id, save the configs
    expect(spyOnSet).toHaveBeenCalledTimes(2);
    // Get the stable id, 2 saved configs, and saved logs
    expect(spyOnGet).toHaveBeenCalledTimes(4);
  });

  test('that overriding api overrides both api and logevent api', async () => {
    expect.assertions(4);
    const statsig = new StatsigClient(
      sdkKey,
      { userID: '123' },
      {
        api: 'https://statsig.jkw.com/v1',
      },
    );

    await statsig.initializeAsync();

    expect(statsig.getOptions().getApi()).toEqual(
      'https://statsig.jkw.com/v1/',
    );
    expect(statsig.getOptions().getEventLoggingApi()).toEqual(
      'https://statsig.jkw.com/v1/',
    );

    statsig.setSDKPackageInfo({
      sdkType: 'test-type',
      sdkVersion: '1.0.0',
    });

    expect(statsig.getSDKType()).toEqual('test-type');
    expect(statsig.getSDKVersion()).toEqual('1.0.0');
  });

  test('that separate event and initialize endpoints work', async () => {
    expect.assertions(2);
    const statsig = new StatsigClient(
      sdkKey,
      { userID: '123' },
      {
        eventLoggingApi: 'https://logging.jkw.com/v1',
      },
    );

    await statsig.initializeAsync();

    expect(statsig.getOptions().getApi()).toEqual(
      'https://featuregates.org/v1/',
    );
    expect(statsig.getOptions().getEventLoggingApi()).toEqual(
      'https://logging.jkw.com/v1/',
    );
  });

  test('that overrideStableID works for local storage and gets set correctly in request', async () => {
    expect.assertions(7);

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

  test('that localMode supports a dummy statsig complete with overrides', async () => {
    expect.assertions(8);
    parsedRequestBody = null;
    const statsig = new StatsigClient(
      sdkKey,
      {},
      {
        localMode: true,
      },
    );
    await statsig.initializeAsync();
    expect(parsedRequestBody).toBeNull(); // never issued the request

    expect(statsig.checkGate('test_gate')).toEqual(false);
    expect(statsig.getConfig('test_config').getValue()).toEqual({});

    statsig.overrideGate('test_gate', true);
    expect(statsig.checkGate('test_gate')).toEqual(true);
    const configOverride = { hello: 456 };
    statsig.overrideConfig('test_config', configOverride);
    expect(statsig.getConfig('test_config').getValue()).toEqual(configOverride);

    statsig.removeConfigOverride('test_config');
    statsig.removeGateOverride('test_gate');

    expect(statsig.checkGate('test_gate')).toEqual(false);
    expect(statsig.getConfig('test_config').getValue()).toEqual({});

    expect(statsig.updateUser({ userID: '123456' })).resolves.not.toThrow();
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

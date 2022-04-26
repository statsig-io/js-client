/**
 * @jest-environment jsdom
 */

import DynamicConfig from '../DynamicConfig';
import StatsigClient from '../StatsigClient';

function generateTestConfigs(value, inExperiment, active) {
  return {
    feature_gates: {},
    dynamic_configs: {
      '3XqUbegKv0F5cDYzW+YL8gfzJixkKfSZMAXZHxdOzwc=': {
        value: { key: value },
        rule_id: 'default',
        secondary_exposures: [],
        is_device_based: false,
        is_user_in_experiment: inExperiment,
        is_experiment_active: active,
      },
      // device experiment
      'vqQndBwrJ/a5gabQIvVPSGUkBBqeS7P1yd1N8t6wgyo=': {
        value: { key: value },
        rule_id: 'default',
        secondary_exposures: [],
        is_device_based: true,
        is_user_in_experiment: inExperiment,
        is_experiment_active: active,
      },
      'N6IGtkiVKCPr/boHFfHvQtf+XD4hvozdzOpGJ4XSWAs=': {
        value: { key: value },
        rule_id: 'default',
        secondary_exposures: [],
        is_device_based: false,
        is_user_in_experiment: inExperiment,
        is_experiment_active: active,
      },
    },
  };
}

describe('Verify behavior of InternalStore', () => {
  const sdkKey = 'client-internalstorekey';
  const feature_gates = {
    'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=': {
      value: true,
      rule_id: 'ruleID12',
      secondary_exposures: [
        {
          gate: 'dependent_gate_1',
          gateValue: 'true',
          ruleID: 'rule_1',
        },
      ],
    },
  };
  const configs = {
    'RMv0YJlLOBe7cY7HgZ3Jox34R0Wrk7jLv3DZyBETA7I=': {
      value: { bool: true },
      rule_id: 'default',
      secondary_exposures: [
        {
          gate: 'dependent_gate_1',
          gateValue: 'true',
          ruleID: 'rule_1',
        },
      ],
    },
  };

  const config_obj = new DynamicConfig(
    'test_config',
    { bool: true },
    'default',
    [
      {
        gate: 'dependent_gate_1',
        gateValue: 'true',
        ruleID: 'rule_1',
      },
    ],
  );

  class LocalStorageMock {
    private store: Record<string, string>;
    constructor() {
      this.store = {};
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

  // @ts-ignore
  window.localStorage = new LocalStorageMock();

  // @ts-ignore
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          gates: {},
          feature_gates: {
            'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=': {
              value: true,
              rule_id: 'ruleID123',
            },
          },
          dynamic_configs: configs,
          configs: {},
        }),
    }),
  );
  const localStorage = new LocalStorageMock();
  // @ts-ignore
  Object.defineProperty(window, 'localStorage', {
    value: localStorage,
  });

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    localStorage.clear();
  });

  test('Verify top level function initializes instance variables.', () => {
    expect.assertions(2);
    const client = new StatsigClient(sdkKey, null);
    expect(client.getStore()).not.toBeNull();
    return client.initializeAsync().then(() => {
      // @ts-ignore
      const store = client.getStore();
      expect(store).not.toBeNull();
    });
  });

  test('Verify save correctly saves into cache.', () => {
    expect.assertions(4);
    const spyOnSet = jest.spyOn(window.localStorage.__proto__, 'setItem');
    const spyOnGet = jest.spyOn(window.localStorage.__proto__, 'getItem');
    const client = new StatsigClient(sdkKey);
    const store = client.getStore();

    store.save({
      feature_gates: feature_gates,
      dynamic_configs: configs,
    });
    expect(spyOnSet).toHaveBeenCalledTimes(2);
    expect(spyOnGet).toHaveBeenCalledTimes(4); // load 2 cache values, overrides, and stableid
    expect(store.getConfig('test_config', false)).toEqual(config_obj);
    expect(store.checkGate('test_gate', false)).toEqual(true);
  });

  test('Verify cache before init and save correctly saves into cache.', () => {
    expect.assertions(5);
    const spyOnSet = jest.spyOn(window.localStorage.__proto__, 'setItem');
    const spyOnGet = jest.spyOn(window.localStorage.__proto__, 'getItem');
    const client = new StatsigClient(sdkKey);
    expect(spyOnSet).toHaveBeenCalledTimes(1);
    const store = client.getStore();

    store.save({
      feature_gates: feature_gates,
      dynamic_configs: configs,
    });
    expect(spyOnSet).toHaveBeenCalledTimes(2);
    expect(spyOnGet).toHaveBeenCalledTimes(4); // load 2 cache values and 1 overrides and 1 stableid
    expect(store.getConfig('test_config', false)).toEqual(config_obj);
    expect(store.checkGate('test_gate', false)).toEqual(true);
  });

  test('Verify checkGate returns false when gateName does not exist.', () => {
    expect.assertions(2);
    const client = new StatsigClient(sdkKey, { userID: 'user_key' });
    return client.initializeAsync().then(() => {
      const store = client.getStore();
      const spy = jest.spyOn(client.getLogger(), 'log');
      expect(store.checkGate('fake_gate', false)).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  test('Verify checkGate returns the correct value.', () => {
    expect.assertions(3);
    const client = new StatsigClient(sdkKey, { userID: 'user_key' });
    return client.initializeAsync().then(() => {
      const spy = jest.spyOn(client.getLogger(), 'log');
      expect(client.getStore().checkGate('test_gate', false)).toBe(true);
      expect(
        client
          .getStore()
          .checkGate('AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=', false),
      ).toBe(false);
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  test('Verify getConfig returns a dummy config and logs exposure when configName does not exist.', () => {
    expect.assertions(2);
    const client = new StatsigClient(sdkKey, { userID: 'user_key' });
    return client.initializeAsync().then(() => {
      const store = client.getStore();
      const spy = jest.spyOn(client.getLogger(), 'log');
      expect(store.getConfig('fake_config', false)).toEqual(
        new DynamicConfig('fake_config'),
      );
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  test('Verify getConfig returns the correct value.', () => {
    expect.assertions(2);
    const client = new StatsigClient(sdkKey, { userID: 'user_key' });
    return client.initializeAsync().then(() => {
      const store = client.getStore();
      const spy = jest.spyOn(client.getLogger(), 'log');
      expect(store.getConfig('test_config', false).getValue()).toMatchObject({
        bool: true,
      });
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  test('that deprecated override gate APIs work', async () => {
    expect.assertions(8);
    const statsig = new StatsigClient(sdkKey, { userID: '123' });
    await statsig.initializeAsync();
    // test_gate is true without override
    expect(statsig.getStore().checkGate('test_gate', false)).toBe(true);

    // becomes false with override
    statsig.getStore().overrideGate('test_gate', false);
    expect(statsig.getStore().checkGate('test_gate', false)).toBe(false);
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
    statsig.getStore().overrideGate('test_gate', false);
    expect(statsig.getStore().checkGate('test_gate', false)).toBe(false);
    expect(statsig.getOverrides()).toEqual({ test_gate: false });
    statsig.removeOverride('test_gate');
    expect(statsig.getOverrides()).toEqual({});
  });

  test('that override gate/config APIs work', async () => {
    expect.assertions(14);
    const statsig = new StatsigClient(sdkKey, { userID: '123' });
    await statsig.initializeAsync();
    // test_config matches without override
    expect(statsig.getStore().getConfig('test_config', false)).toEqual(
      config_obj,
    );

    const overrideConfig = {
      override: true,
      value: 'Override',
      count: 1,
    };
    statsig.getStore().overrideConfig('test_config', overrideConfig);
    expect(
      statsig.getStore().getConfig('test_config', false).getValue(),
    ).toEqual(overrideConfig);
    expect(statsig.getAllOverrides().configs).toEqual({
      test_config: overrideConfig,
    });
    expect(statsig.getAllOverrides().gates).toEqual({});

    // overriding non-existent config does not do anything
    statsig.overrideConfig('nonexistent_config', { abc: 123 });
    expect(statsig.getAllOverrides().configs).toEqual({
      test_config: overrideConfig,
      nonexistent_config: { abc: 123 },
    });

    // remove config override, add gate override
    statsig.removeConfigOverride();
    expect(statsig.getStore().checkGate('test_gate', false)).toBe(true);
    statsig.getStore().overrideGate('test_gate', false);
    expect(statsig.getStore().checkGate('test_gate', false)).toBe(false);
    expect(statsig.getAllOverrides()).toEqual({
      gates: { test_gate: false },
      configs: {},
    });

    // overriding non-existent gate
    statsig.overrideGate('nonexistent_gate', true);
    expect(statsig.getAllOverrides().gates).toEqual({
      test_gate: false,
      nonexistent_gate: true,
    });

    // remove a named override
    statsig.overrideConfig('test_config', overrideConfig);
    expect(statsig.getConfig('test_config').getValue()).toEqual(overrideConfig);
    expect(statsig.getAllOverrides().configs).toEqual({
      test_config: overrideConfig,
    });
    statsig.removeConfigOverride('test_config');
    expect(statsig.getAllOverrides().gates).toEqual({
      test_gate: false,
      nonexistent_gate: true,
    });
    expect(statsig.getAllOverrides().configs).toEqual({});
    statsig.removeGateOverride('test_gate');
    expect(statsig.getAllOverrides().gates).toEqual({ nonexistent_gate: true });
  });

  test('test experiment sticky bucketing behavior', async () => {
    expect.assertions(15);
    const statsig = new StatsigClient(sdkKey, { userID: '123' });
    await statsig.initializeAsync();
    const store = statsig.getStore();

    // getting values with flag set to false, should get latest values
    store.save(generateTestConfigs('v0', true, true));
    expect(store.getExperiment('exp', false).get('key', '')).toEqual('v0');
    expect(store.getExperiment('device_exp', false).get('key', '')).toEqual(
      'v0',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v0',
    );

    // update values, and then get with flag set to true. All values should update
    store.save(generateTestConfigs('v1', true, true));
    expect(store.getExperiment('exp', true).get('key', '')).toEqual('v1');
    expect(store.getExperiment('device_exp', true).get('key', '')).toEqual(
      'v1',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v1',
    );

    // update values again. Now some values should be sticky except the non-sticky ones
    store.save(generateTestConfigs('v2', true, true));
    expect(store.getExperiment('exp', true).get('key', '')).toEqual('v1');
    expect(store.getExperiment('device_exp', true).get('key', '')).toEqual(
      'v1',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v2',
    );

    // update the experiments so that the user is no longer in experiments, should still be sticky for the right ones
    store.save(generateTestConfigs('v3', false, true));
    expect(store.getExperiment('exp', true).get('key', '')).toEqual('v1');
    expect(store.getExperiment('device_exp', true).get('key', '')).toEqual(
      'v1',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v3',
    );

    // update the experiments to no longer be active, values should update NOW
    store.save(generateTestConfigs('v4', false, false));
    expect(store.getExperiment('exp', true).get('key', '')).toEqual('v4');
    expect(store.getExperiment('device_exp', true).get('key', '')).toEqual(
      'v4',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v4',
    );
  });

  test('test experiment sticky bucketing behavior when user changes', async () => {
    expect.assertions(12);
    const statsig = new StatsigClient(sdkKey, { userID: '456' });
    await statsig.initializeAsync();
    const store = statsig.getStore();

    // getting values with flag set to false, should get latest values
    store.save(generateTestConfigs('v0', true, true));
    expect(store.getExperiment('exp', false).get('key', '')).toEqual('v0');
    expect(store.getExperiment('device_exp', false).get('key', '')).toEqual(
      'v0',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v0',
    );

    // update values, and then get with flag set to true. All values should update
    store.save(generateTestConfigs('v1', true, true));
    expect(store.getExperiment('exp', true).get('key', '')).toEqual('v1');
    expect(store.getExperiment('device_exp', true).get('key', '')).toEqual(
      'v1',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v1',
    );

    // update user. Only device value should stick
    await statsig.updateUser({ userID: 'tore' });
    store.save(generateTestConfigs('v2', true, true));
    expect(store.getExperiment('exp', true).get('key', '')).toEqual('v2');
    expect(store.getExperiment('device_exp', true).get('key', '')).toEqual(
      'v1',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v2',
    );

    // update user back (don't await for the response), should get all the same values last time 456 got
    statsig.updateUser({ userID: '456' });
    expect(store.getExperiment('exp', true).get('key', '')).toEqual('v1');
    expect(store.getExperiment('device_exp', true).get('key', '')).toEqual(
      'v1',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v1',
    );
  });

  test('test experiment sticky bucketing behavior across sessions', async () => {
    expect.assertions(9);
    const statsig = new StatsigClient(sdkKey, { userID: '789' });
    await statsig.initializeAsync();
    const store = statsig.getStore();

    store.save(generateTestConfigs('v0', true, true));
    expect(store.getExperiment('exp', true).get('key', '')).toEqual('v0');
    expect(store.getExperiment('device_exp', true).get('key', '')).toEqual(
      'v0',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v0',
    );

    // re-create with a different user id. Only device experiments should stick
    const statsig2 = new StatsigClient(sdkKey, { userID: 'tore' });
    const store2 = statsig2.getStore();

    store2.save(generateTestConfigs('v1', true, true));
    expect(store2.getExperiment('exp', true).get('key', '')).toEqual('v1');
    expect(store2.getExperiment('device_exp', true).get('key', '')).toEqual(
      'v0',
    );
    expect(store2.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v1',
    );

    // update user back (don't await for the response), should get all the same values last time 789 got
    statsig.updateUser({ userID: '789' });
    expect(store.getExperiment('exp', true).get('key', '')).toEqual('v0');
    expect(store.getExperiment('device_exp', true).get('key', '')).toEqual(
      'v0',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v0',
    );
  });

  test('test user cache key when there are customIDs', async () => {
    expect.assertions(9);
    const statsig = new StatsigClient(sdkKey, {
      customIDs: { deviceId: '' },
    });
    await statsig.initializeAsync();
    const store = statsig.getStore();

    store.save(generateTestConfigs('v0', true, true));
    expect(store.getExperiment('exp', true).get('key', '')).toEqual('v0');
    expect(store.getExperiment('device_exp', true).get('key', '')).toEqual(
      'v0',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v0',
    );

    // updateUser with the same userID but different customID, non-device experiments should be updated
    await statsig.updateUser({
      customIDs: { deviceId: 'device_id_abc' },
    });

    store.save(generateTestConfigs('v1', true, true));
    expect(store.getExperiment('exp', true).get('key', '')).toEqual('v1');
    expect(store.getExperiment('device_exp', true).get('key', '')).toEqual(
      'v0',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v1',
    );

    // update user back, should get same value with empty deviceId
    statsig.updateUser({
      customIDs: { deviceId: '' },
    });
    expect(store.getExperiment('exp', true).get('key', '')).toEqual('v0');
    expect(store.getExperiment('device_exp', true).get('key', '')).toEqual(
      'v0',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v0',
    );
  });

  test('test that we purge the oldest cache when we have more than 10', async () => {
    expect.assertions(2);
    const statsig = new StatsigClient(sdkKey, { userID: '1' });
    await statsig.initializeAsync();
    const store = statsig.getStore();

    await statsig.updateUser({ userID: '2' });
    store.save(generateTestConfigs('v0', true, true));
    await statsig.updateUser({ userID: '3' });
    store.save(generateTestConfigs('v0', true, true));
    await statsig.updateUser({ userID: '4' });
    store.save(generateTestConfigs('v0', true, true));
    await statsig.updateUser({ userID: '5' });
    store.save(generateTestConfigs('v0', true, true));
    await statsig.updateUser({ userID: '6' });
    store.save(generateTestConfigs('v0', true, true));
    await statsig.updateUser({ userID: '7' });
    store.save(generateTestConfigs('v0', true, true));
    await statsig.updateUser({ userID: '8' });
    store.save(generateTestConfigs('v0', true, true));
    await statsig.updateUser({ userID: '9' });
    store.save(generateTestConfigs('v0', true, true));
    await statsig.updateUser({ userID: '10' });
    store.save(generateTestConfigs('v0', true, true));
    let cache = JSON.parse(
      window.localStorage.getItem('STATSIG_LOCAL_STORAGE_INTERNAL_STORE_V4'),
    );
    expect(Object.keys(cache).length).toEqual(10);

    await statsig.updateUser({ userID: '11' });
    store.save(generateTestConfigs('v0', true, true));

    expect(Object.keys(cache).length).toEqual(10);
  });
});

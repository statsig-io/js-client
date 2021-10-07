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
    const client = new StatsigClient();
    expect(client.getStore()).not.toBeNull();
    return client.initializeAsync(sdkKey, null).then(() => {
      // @ts-ignore
      const store = client.getStore();
      expect(store).not.toBeNull();
    });
  });

  test('Verify save correctly saves into cache.', () => {
    expect.assertions(5);
    const spyOnSet = jest.spyOn(window.localStorage.__proto__, 'setItem');
    const spyOnGet = jest.spyOn(window.localStorage.__proto__, 'getItem');
    const client = new StatsigClient();
    const store = client.getStore();

    store.save({ feature_gates: feature_gates, dynamic_configs: configs });
    expect(spyOnSet).toHaveBeenCalledTimes(1);
    expect(store.getConfig('test_config')).toEqual(config_obj);

    store.loadFromLocalStorage();
    expect(spyOnGet).toHaveBeenCalledTimes(4); // load 3 cache values and 1 overrides
    expect(store.getConfig('test_config')).toEqual(config_obj); // loading from storage should return right results
    expect(store.checkGate('test_gate')).toEqual(true);
  });

  test('Verify checkGate returns false when gateName does not exist.', () => {
    expect.assertions(2);
    const client = new StatsigClient();
    return client.initializeAsync(sdkKey, { userID: 'user_key' }).then(() => {
      const store = client.getStore();
      const spy = jest.spyOn(client.getLogger(), 'log');
      expect(store.checkGate('fake_gate')).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  test('Verify checkGate returns the correct value.', () => {
    expect.assertions(3);
    const client = new StatsigClient();
    return client.initializeAsync(sdkKey, { userID: 'user_key' }).then(() => {
      const spy = jest.spyOn(client.getLogger(), 'log');
      expect(client.getStore().checkGate('test_gate')).toBe(true);
      expect(
        client
          .getStore()
          .checkGate('AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY='),
      ).toBe(false);
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  test('Verify getConfig returns a dummy config and logs exposure when configName does not exist.', () => {
    expect.assertions(2);
    const client = new StatsigClient();
    return client.initializeAsync(sdkKey, { userID: 'user_key' }).then(() => {
      const store = client.getStore();
      const spy = jest.spyOn(client.getLogger(), 'log');
      expect(store.getConfig('fake_config')).toEqual(
        new DynamicConfig('fake_config'),
      );
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  test('Verify getConfig returns the correct value.', () => {
    expect.assertions(2);
    const client = new StatsigClient();
    return client.initializeAsync(sdkKey, { userID: 'user_key' }).then(() => {
      const store = client.getStore();
      const spy = jest.spyOn(client.getLogger(), 'log');
      expect(store.getConfig('test_config').getValue()).toMatchObject({
        bool: true,
      });
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  test('that deprecated override gate APIs work', async () => {
    expect.assertions(8);
    const statsig = new StatsigClient();
    await statsig.initializeAsync(sdkKey, { userID: '123' });
    // test_gate is true without override
    expect(statsig.getStore().checkGate('test_gate')).toBe(true);

    // becomes false with override
    statsig.getStore().overrideGate('test_gate', false);
    expect(statsig.getStore().checkGate('test_gate')).toBe(false);
    expect(statsig.getOverrides()).toEqual({ test_gate: false });

    // overriding non-existent gate does not do anything
    statsig.overrideGate('fake_gate', true);
    expect(statsig.getOverrides()).toEqual({ test_gate: false });

    // remove all overrides
    statsig.removeOverride();
    expect(statsig.getOverrides()).toEqual({});

    // remove a named override
    statsig.getStore().overrideGate('test_gate', false);
    expect(statsig.getStore().checkGate('test_gate')).toBe(false);
    expect(statsig.getOverrides()).toEqual({ test_gate: false });
    statsig.removeOverride('test_gate');
    expect(statsig.getOverrides()).toEqual({});
  });

  test('that override gate/config APIs work', async () => {
    expect.assertions(14);
    const statsig = new StatsigClient();
    await statsig.initializeAsync(sdkKey, { userID: '123' });
    // test_config matches without override
    expect(statsig.getStore().getConfig('test_config')).toEqual(config_obj);

    const overrideConfig = {
      override: true,
      value: 'Override',
      count: 1,
    };
    statsig.getStore().overrideConfig('test_config', overrideConfig);
    expect(statsig.getStore().getConfig('test_config').getValue()).toEqual(
      overrideConfig,
    );
    expect(statsig.getAllOverrides().configs).toEqual({
      test_config: overrideConfig,
    });
    expect(statsig.getAllOverrides().gates).toEqual({});

    // overriding non-existent config does not do anything
    statsig.overrideConfig('nonexistent_config', { abc: 123 });
    expect(statsig.getAllOverrides().configs).toEqual({
      test_config: overrideConfig,
    });

    // remove config override, add gate override
    statsig.removeConfigOverride();
    expect(statsig.getStore().checkGate('test_gate')).toBe(true);
    statsig.getStore().overrideGate('test_gate', false);
    expect(statsig.getStore().checkGate('test_gate')).toBe(false);
    expect(statsig.getAllOverrides()).toEqual({
      gates: { test_gate: false },
      configs: {},
    });

    // overriding non-existent gate does not do anything
    statsig.overrideGate('nonexistent_gate', true);
    expect(statsig.getAllOverrides().gates).toEqual({ test_gate: false });

    // remove a named override
    statsig.overrideConfig('test_config', overrideConfig);
    expect(statsig.getConfig('test_config').getValue()).toEqual(overrideConfig);
    expect(statsig.getAllOverrides().configs).toEqual({
      test_config: overrideConfig,
    });
    statsig.removeConfigOverride('test_config');
    expect(statsig.getAllOverrides().gates).toEqual({ test_gate: false });
    expect(statsig.getAllOverrides().configs).toEqual({});
    statsig.removeGateOverride('test_gate');
    expect(statsig.getAllOverrides().gates).toEqual({});
  });

  test('test experiment sticky bucketing behavior', async () => {
    expect.assertions(15);
    const statsig = new StatsigClient();
    await statsig.initializeAsync(sdkKey, { userID: '123' });
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
    expect.assertions(9);
    const statsig = new StatsigClient();
    await statsig.initializeAsync(sdkKey, { userID: '123' });
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
    store.updateUser('tore');
    store.save(generateTestConfigs('v2', true, true));
    expect(store.getExperiment('exp', true).get('key', '')).toEqual('v2');
    expect(store.getExperiment('device_exp', true).get('key', '')).toEqual(
      'v1',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v2',
    );
  });

  test('test experiment sticky bucketing behavior across sessions', async () => {
    expect.assertions(6);
    const statsig = new StatsigClient();
    await statsig.initializeAsync(sdkKey, { userID: '123' });
    const store = statsig.getStore();

    store.save(generateTestConfigs('v0', true, true));
    expect(store.getExperiment('exp', true).get('key', '')).toEqual('v0');
    expect(store.getExperiment('device_exp', true).get('key', '')).toEqual(
      'v0',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v0',
    );

    // re-initialize with a different user id. Only device experiments should stick
    const statsig2 = new StatsigClient();
    await statsig2.initializeAsync(sdkKey, { userID: 'tore' });
    const store2 = statsig2.getStore();

    store2.save(generateTestConfigs('v1', true, true));
    expect(store2.getExperiment('exp', true).get('key', '')).toEqual('v1');
    expect(store2.getExperiment('device_exp', true).get('key', '')).toEqual(
      'v0',
    );
    expect(store2.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v1',
    );
  });
});

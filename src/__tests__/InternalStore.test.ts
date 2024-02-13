/**
 * @jest-environment jsdom
 */

import DynamicConfig from '../DynamicConfig';
import StatsigClient from '../StatsigClient';
import { StatsigUser } from '../StatsigUser';
import { EvaluationReason } from '../utils/EvaluationReason';
import LocalStorageMock from './LocalStorageMock';
import UserPersistentStorageExample from './UserPersistentStorageExample';
import './jest.setup';

type InitializeResponse = {
  feature_gates: Record<string, Record<string, any>>;
  dynamic_configs: Record<string, Record<string, any>>;
};

function onConfigDefaultValueFallback() {}

function generateTestConfigs(
  value: any,
  inExperiment: boolean,
  active: boolean,
): InitializeResponse {
  return {
    feature_gates: {},
    dynamic_configs: {
      '3XqUbegKv0F5cDYzW+YL8gfzJixkKfSZMAXZHxdOzwc=': {
        value: { key: value },
        rule_id: 'default',
        group_name: 'default',
        id_type: 'userID',
        secondary_exposures: [],
        is_device_based: false,
        is_user_in_experiment: inExperiment,
        is_experiment_active: active,
      },
      // device experiment
      'vqQndBwrJ/a5gabQIvVPSGUkBBqeS7P1yd1N8t6wgyo=': {
        value: { key: value },
        rule_id: 'default',
        group_name: 'default',
        id_type: 'userID',
        secondary_exposures: [],
        is_device_based: true,
        is_user_in_experiment: inExperiment,
        is_experiment_active: active,
      },
      'N6IGtkiVKCPr/boHFfHvQtf+XD4hvozdzOpGJ4XSWAs=': {
        value: { key: value },
        rule_id: 'default',
        group_name: 'default',
        id_type: 'userID',
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
  const now = Date.now();
  const feature_gates = {
    'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=': {
      value: true,
      rule_id: 'ruleID12',
      group_name: 'Rule 12',
      id_type: 'userID',
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
      group_name: 'default',
      id_type: 'userID',
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
    { reason: EvaluationReason.Network, time: now },
    [
      {
        gate: 'dependent_gate_1',
        gateValue: 'true',
        ruleID: 'rule_1',
      },
    ],
    '',
    onConfigDefaultValueFallback,
    'default',
    'userID',
  );

  const localStorage = new LocalStorageMock();
  // @ts-ignore
  Object.defineProperty(window, 'localStorage', {
    value: localStorage,
  });

  // @ts-ignore
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            gates: {},
            feature_gates: {
              'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=': {
                value: true,
                rule_id: 'ruleID123',
              },
            },
            dynamic_configs: configs,
            configs: {},
            has_updates: true,
          }),
        ),
    }),
  );

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    localStorage.clear();

    // ensure Date.now() returns the same value in each test
    jest.spyOn(global.Date, 'now').mockImplementation(() => now);
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
    expect.assertions(7);
    const spyOnSet = jest.spyOn(window.localStorage.__proto__, 'setItem');
    const spyOnGet = jest.spyOn(window.localStorage.__proto__, 'getItem');
    const client = new StatsigClient(sdkKey);
    const store = client.getStore();

    expect(store.getGlobalEvaluationDetails()).toEqual({
      reason: EvaluationReason.Uninitialized,
      time: expect.any(Number),
    });
    store.save(
      null,
      {
        feature_gates: feature_gates,
        dynamic_configs: configs,
      },
      client.getStableID() ?? '',
    );
    expect(store.getGlobalEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
    expect(spyOnSet).toHaveBeenCalledTimes(1); // stableid not saved by default
    expect(spyOnGet).toHaveBeenCalledTimes(4); // load 2 cache values, 1 overrides and 1 stableid
    const config = store.getConfig('test_config', false);
    expect(config).toMatchConfig(config_obj);
    expect(config.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
    expect(store.checkGate('test_gate', false).gate.value).toEqual(true);
  });

  test('Verify cache before init and save correctly saves into cache.', () => {
    expect.assertions(7);
    const spyOnSet = jest.spyOn(window.localStorage.__proto__, 'setItem');
    const spyOnGet = jest.spyOn(window.localStorage.__proto__, 'getItem');
    const client = new StatsigClient(sdkKey);
    expect(spyOnSet).toHaveBeenCalledTimes(0);
    const store = client.getStore();
    expect(
      store.getConfig('test_config', false).getEvaluationDetails().reason,
    ).toEqual(EvaluationReason.Uninitialized);

    store.save(
      null,
      {
        feature_gates: feature_gates,
        dynamic_configs: configs,
      },
      client.getStableID() ?? '',
    );
    expect(spyOnSet).toHaveBeenCalledTimes(1);
    expect(spyOnGet).toHaveBeenCalledTimes(4); // load 2 cache values and 1 overrides and 1 stableid
    const config = store.getConfig('test_config', false);
    expect(config).toMatchConfig(config_obj);
    expect(config.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
    expect(store.checkGate('test_gate', false).gate.value).toEqual(true);
  });

  test('Verify local storage usage with override id', () => {
    expect.assertions(8);
    const spyOnSet = jest.spyOn(window.localStorage.__proto__, 'setItem');
    const spyOnGet = jest.spyOn(window.localStorage.__proto__, 'getItem');
    const client = new StatsigClient(sdkKey, {}, { overrideStableID: '999' });
    expect(spyOnSet).toHaveBeenCalledTimes(0);
    const store = client.getStore();
    expect(
      store.getConfig('test_config', false).getEvaluationDetails().reason,
    ).toEqual(EvaluationReason.Uninitialized);

    store.save(
      null,
      {
        feature_gates: feature_gates,
        dynamic_configs: configs,
      },
      client.getStableID() ?? '',
    );
    expect(spyOnSet).toHaveBeenCalledTimes(1);
    expect(spyOnGet).toHaveBeenCalledTimes(3); // load 2 cache values and 1 overrides

    // @ts-ignore
    client.delayedSetup();
    expect(spyOnSet).toHaveBeenCalledTimes(2); // only now do we save the stableid
    const config = store.getConfig('test_config', false);
    expect(config).toMatchConfig(config_obj);
    expect(config.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
    expect(store.checkGate('test_gate', false).gate.value).toEqual(true);
  });

  test('Verify checkGate returns false when gateName does not exist.', () => {
    expect.assertions(1);
    const client = new StatsigClient(sdkKey, { userID: 'user_key' });
    return client.initializeAsync().then(() => {
      const store = client.getStore();
      const result = store.checkGate('fake_gate', false).gate.value;
      expect(result).toBe(false);
    });
  });

  test('Verify checkGate returns the correct value.', () => {
    expect.assertions(2);
    const client = new StatsigClient(sdkKey, { userID: 'user_key' });
    return client.initializeAsync().then(() => {
      expect(client.getStore().checkGate('test_gate', false).gate.value).toBe(
        true,
      );
      expect(
        client
          .getStore()
          .checkGate('AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=', false).gate
          .value,
      ).toBe(false);
    });
  });

  test('Verify getConfig returns a dummy config and logs exposure when configName does not exist.', () => {
    expect.assertions(4);
    const client = new StatsigClient(sdkKey, { userID: 'user_key' });
    return client.initializeAsync().then(() => {
      const store = client.getStore();
      const config = store.getConfig('fake_config', false);
      expect(config.getName()).toEqual('fake_config');
      expect(config.getValue()).toEqual({});
      expect(config.getRuleID()).toEqual('');
      expect(config.getEvaluationDetails()).toEqual({
        reason: EvaluationReason.Unrecognized,
        time: now,
      });
    });
  });

  test('Verify getConfig returns the correct value.', () => {
    expect.assertions(1);
    const client = new StatsigClient(sdkKey, { userID: 'user_key' });
    return client.initializeAsync().then(() => {
      const store = client.getStore();
      expect(store.getConfig('test_config', false).getValue()).toMatchObject({
        bool: true,
      });
    });
  });

  test('that deprecated override gate APIs work', async () => {
    expect.assertions(8);
    const statsig = new StatsigClient(sdkKey, { userID: '123' });
    await statsig.initializeAsync();
    // test_gate is true without override
    expect(statsig.getStore().checkGate('test_gate', false).gate.value).toBe(
      true,
    );

    // becomes false with override
    statsig.getStore().overrideGate('test_gate', false);
    expect(statsig.getStore().checkGate('test_gate', false).gate.value).toBe(
      false,
    );
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
    expect(statsig.getStore().checkGate('test_gate', false).gate.value).toBe(
      false,
    );
    expect(statsig.getOverrides()).toEqual({ test_gate: false });
    statsig.removeOverride('test_gate');
    expect(statsig.getOverrides()).toEqual({});
  });

  test('that override gate/config APIs work', async () => {
    expect.assertions(15);
    const statsig = new StatsigClient(sdkKey, { userID: '123' });
    await statsig.initializeAsync();
    // test_config matches without override
    expect(statsig.getStore().getConfig('test_config', false)).toMatchConfig(
      config_obj,
    );

    const overrideConfig = {
      override: true,
      value: 'Override',
      count: 1,
    };
    statsig.getStore().overrideConfig('test_config', overrideConfig);
    const config = statsig.getStore().getConfig('test_config', false);
    expect(config.getValue()).toEqual(overrideConfig);
    expect(config.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.LocalOverride,
      time: now,
    });
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
    expect(statsig.getStore().checkGate('test_gate', false).gate.value).toBe(
      true,
    );
    statsig.getStore().overrideGate('test_gate', false);
    expect(statsig.getStore().checkGate('test_gate', false).gate.value).toBe(
      false,
    );
    expect(statsig.getAllOverrides()).toEqual({
      gates: { test_gate: false },
      configs: {},
      layers: {},
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

  test('experiment sticky bucketing behavior', async () => {
    expect.assertions(30);
    const statsig = new StatsigClient(sdkKey, { userID: '123' });
    await statsig.initializeAsync();
    const store = statsig.getStore();

    // getting values with flag set to false, should get latest values
    store.save(
      { userID: '123' },
      generateTestConfigs('v0', true, true),
      statsig.getStableID() ?? '',
    );
    let exp = store.getExperiment('exp', false);
    let deviceExp = store.getExperiment('device_exp', false);
    let expNonSticky = store.getExperiment('exp_non_stick', false);
    expect(exp.get('key', '')).toEqual('v0');
    expect(exp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
    expect(deviceExp.get('key', '')).toEqual('v0');
    expect(deviceExp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
    expect(expNonSticky.get('key', '')).toEqual('v0');
    expect(expNonSticky.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });

    // update values, and then get with flag set to true. All values should update
    store.save(
      { userID: '123' },
      generateTestConfigs('v1', true, true),
      statsig.getStableID() ?? '',
    );
    exp = store.getExperiment('exp', true);
    deviceExp = store.getExperiment('device_exp', true);
    expNonSticky = store.getExperiment('exp_non_stick', false);
    expect(exp.get('key', '')).toEqual('v1');
    expect(exp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
    expect(deviceExp.get('key', '')).toEqual('v1');
    expect(deviceExp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
    expect(expNonSticky.get('key', '')).toEqual('v1');
    expect(expNonSticky.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });

    // update values again. Now some values should be sticky except the non-sticky ones
    store.save(
      { userID: '123' },
      generateTestConfigs('v2', true, true),
      statsig.getStableID() ?? '',
    );
    exp = store.getExperiment('exp', true);
    deviceExp = store.getExperiment('device_exp', true);
    expNonSticky = store.getExperiment('exp_non_stick', false);
    expect(exp.get('key', '')).toEqual('v1');
    expect(exp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Sticky,
      time: now,
    });
    expect(deviceExp.get('key', '')).toEqual('v1');
    expect(deviceExp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Sticky,
      time: now,
    });
    expect(expNonSticky.get('key', '')).toEqual('v2');
    expect(expNonSticky.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });

    // update the experiments so that the user is no longer in experiments, should still be sticky for the right ones
    store.save(
      { userID: '123' },
      generateTestConfigs('v3', false, true),
      statsig.getStableID() ?? '',
    );
    exp = store.getExperiment('exp', true);
    deviceExp = store.getExperiment('device_exp', true);
    expNonSticky = store.getExperiment('exp_non_stick', false);
    expect(exp.get('key', '')).toEqual('v1');
    expect(exp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Sticky,
      time: now,
    });
    expect(deviceExp.get('key', '')).toEqual('v1');
    expect(deviceExp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Sticky,
      time: now,
    });
    expect(expNonSticky.get('key', '')).toEqual('v3');
    expect(expNonSticky.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });

    // update the experiments to no longer be active, values should update NOW
    store.save(
      { userID: '123' },
      generateTestConfigs('v4', false, false),
      statsig.getStableID() ?? '',
    );
    exp = store.getExperiment('exp', true);
    deviceExp = store.getExperiment('device_exp', true);
    expNonSticky = store.getExperiment('exp_non_stick', false);
    expect(exp.get('key', '')).toEqual('v4');
    expect(exp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
    expect(deviceExp.get('key', '')).toEqual('v4');
    expect(deviceExp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
    expect(expNonSticky.get('key', '')).toEqual('v4');
    expect(expNonSticky.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
  });

  test('experiment sticky bucketing behavior with custom storage', async () => {
    const user: StatsigUser = { customIDs: { testID: '123' } };
    const stickyStore = new UserPersistentStorageExample('testID');
    const statsig = new StatsigClient(sdkKey, user, {
      userPersistentStorage: stickyStore,
    });
    await statsig.initializeAsync();
    const store = statsig.getStore();

    // getting values with flag set to false, should get latest values
    store.save(
      user,
      generateTestConfigs('v0', true, true),
      statsig.getStableID() ?? '',
    );
    let exp = store.getExperiment('exp', false);
    let deviceExp = store.getExperiment('device_exp', false);
    let expNonSticky = store.getExperiment('exp_non_stick', false);
    expect(Object.keys(stickyStore.store).length).toEqual(0);
    expect(exp.get('key', '')).toEqual('v0');
    expect(exp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
    expect(deviceExp.get('key', '')).toEqual('v0');
    expect(deviceExp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
    expect(expNonSticky.get('key', '')).toEqual('v0');
    expect(expNonSticky.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });

    // update values, and then get with flag set to true. All values should update
    store.save(
      user,
      generateTestConfigs('v1', true, true),
      statsig.getStableID() ?? '',
    );
    exp = store.getExperiment('exp', true);
    deviceExp = store.getExperiment('device_exp', true);
    expNonSticky = store.getExperiment('exp_non_stick', false);
    // device based sticky doesn't work with user persistent storage
    expect(Object.keys(stickyStore.store).length).toEqual(1);
    expect(exp.get('key', '')).toEqual('v1');
    expect(exp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
    expect(deviceExp.get('key', '')).toEqual('v1');
    expect(deviceExp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
    expect(expNonSticky.get('key', '')).toEqual('v1');
    expect(expNonSticky.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });

    // update values again. Now some values should be sticky except the non-sticky ones
    store.save(
      user,
      generateTestConfigs('v2', true, true),
      statsig.getStableID() ?? '',
    );
    exp = store.getExperiment('exp', true);
    deviceExp = store.getExperiment('device_exp', true);
    expNonSticky = store.getExperiment('exp_non_stick', false);
    expect(Object.keys(stickyStore.store).length).toEqual(1);
    expect(exp.get('key', '')).toEqual('v1');
    expect(exp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Sticky,
      time: now,
    });
    expect(deviceExp.get('key', '')).toEqual('v1');
    expect(deviceExp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Sticky,
      time: now,
    });
    expect(expNonSticky.get('key', '')).toEqual('v2');
    expect(expNonSticky.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });

    // update the experiments so that the user is no longer in experiments, should still be sticky for the right ones
    store.save(
      user,
      generateTestConfigs('v3', false, true),
      statsig.getStableID() ?? '',
    );
    exp = store.getExperiment('exp', true);
    deviceExp = store.getExperiment('device_exp', true);
    expNonSticky = store.getExperiment('exp_non_stick', false);
    expect(Object.keys(stickyStore.store).length).toEqual(1);
    expect(exp.get('key', '')).toEqual('v1');
    expect(exp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Sticky,
      time: now,
    });
    expect(deviceExp.get('key', '')).toEqual('v1');
    expect(deviceExp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Sticky,
      time: now,
    });
    expect(expNonSticky.get('key', '')).toEqual('v3');
    expect(expNonSticky.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });

    // update the experiments to no longer be active, values should update NOW
    store.save(
      user,
      generateTestConfigs('v4', false, false),
      statsig.getStableID() ?? '',
    );
    exp = store.getExperiment('exp', true);
    deviceExp = store.getExperiment('device_exp', true);
    expNonSticky = store.getExperiment('exp_non_stick', false);
    expect(Object.keys(stickyStore.store).length).toEqual(0);
    expect(exp.get('key', '')).toEqual('v4');
    expect(exp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
    expect(deviceExp.get('key', '')).toEqual('v4');
    expect(deviceExp.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
    expect(expNonSticky.get('key', '')).toEqual('v4');
    expect(expNonSticky.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Network,
      time: now,
    });
  });

  test('experiment sticky bucketing behavior when user changes', async () => {
    expect.assertions(12);
    const statsig = new StatsigClient(sdkKey, { userID: '456' });
    await statsig.initializeAsync();
    const store = statsig.getStore();

    // getting values with flag set to false, should get latest values
    store.save(
      { userID: '456' },
      generateTestConfigs('v0', true, true),
      statsig.getStableID() ?? '',
    );
    expect(store.getExperiment('exp', false).get('key', '')).toEqual('v0');
    expect(store.getExperiment('device_exp', false).get('key', '')).toEqual(
      'v0',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v0',
    );

    // update values, and then get with flag set to true. All values should update
    store.save(
      { userID: '456' },
      generateTestConfigs('v1', true, true),
      statsig.getStableID() ?? '',
    );
    expect(store.getExperiment('exp', true).get('key', '')).toEqual('v1');
    expect(store.getExperiment('device_exp', true).get('key', '')).toEqual(
      'v1',
    );
    expect(store.getExperiment('exp_non_stick', false).get('key', '')).toEqual(
      'v1',
    );

    // update user. Only device value should stick
    await statsig.updateUser({ userID: 'tore' });
    store.save(
      { userID: 'tore' },
      generateTestConfigs('v2', true, true),
      statsig.getStableID() ?? '',
    );
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

  test('experiment sticky bucketing behavior across sessions', async () => {
    expect.assertions(9);
    const statsig = new StatsigClient(sdkKey, { userID: '789' });
    await statsig.initializeAsync();
    const store = statsig.getStore();

    store.save(
      { userID: '789' },
      generateTestConfigs('v0', true, true),
      statsig.getStableID() ?? '',
    );
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

    store2.save(
      { userID: 'tore' },
      generateTestConfigs('v1', true, true),
      statsig.getStableID() ?? '',
    );
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

  test('user cache key when there are customIDs', async () => {
    expect.assertions(9);
    const statsig = new StatsigClient(sdkKey, {
      customIDs: { deviceId: '' },
    });
    await statsig.initializeAsync();
    const store = statsig.getStore();

    store.save(
      {
        customIDs: { deviceId: '' },
      },
      generateTestConfigs('v0', true, true),
      statsig.getStableID() ?? '',
    );
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

    store.save(
      {
        customIDs: { deviceId: 'device_id_abc' },
      },
      generateTestConfigs('v1', true, true),
      statsig.getStableID() ?? '',
    );
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

  test('that we purge the oldest cache when we have more than 10', async () => {
    expect.assertions(2);
    const statsig = new StatsigClient(sdkKey, { userID: '1' });
    await statsig.initializeAsync();
    const store = statsig.getStore();

    await statsig.updateUser({ userID: '2' });
    store.save(
      { userID: '2' },
      generateTestConfigs('v0', true, true),
      statsig.getStableID() ?? '',
    );
    await statsig.updateUser({ userID: '3' });
    store.save(
      { userID: '3' },
      generateTestConfigs('v0', true, true),
      statsig.getStableID() ?? '',
    );
    await statsig.updateUser({ userID: '4' });
    store.save(
      { userID: '4' },
      generateTestConfigs('v0', true, true),
      statsig.getStableID() ?? '',
    );
    await statsig.updateUser({ userID: '5' });
    store.save(
      { userID: '5' },
      generateTestConfigs('v0', true, true),
      statsig.getStableID() ?? '',
    );
    await statsig.updateUser({ userID: '6' });
    store.save(
      { userID: '6' },
      generateTestConfigs('v0', true, true),
      statsig.getStableID() ?? '',
    );
    await statsig.updateUser({ userID: '7' });
    store.save(
      { userID: '7' },
      generateTestConfigs('v0', true, true),
      statsig.getStableID() ?? '',
    );
    await statsig.updateUser({ userID: '8' });
    store.save(
      { userID: '8' },
      generateTestConfigs('v0', true, true),
      statsig.getStableID() ?? '',
    );
    await statsig.updateUser({ userID: '9' });
    store.save(
      { userID: '9' },
      generateTestConfigs('v0', true, true),
      statsig.getStableID() ?? '',
    );
    await statsig.updateUser({ userID: '10' });
    store.save(
      { userID: '10' },
      generateTestConfigs('v0', true, true),
      statsig.getStableID() ?? '',
    );
    const cache = JSON.parse(
      window.localStorage.getItem('STATSIG_LOCAL_STORAGE_INTERNAL_STORE_V4') ??
        '{}',
    );
    expect(Object.keys(cache).length).toEqual(10);

    await statsig.updateUser({ userID: '11' });
    store.save(
      { userID: '11' },
      generateTestConfigs('v0', true, true),
      statsig.getStableID() ?? '',
    );

    expect(Object.keys(cache).length).toEqual(10);
  });
});

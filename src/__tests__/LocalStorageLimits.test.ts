/**
 * @jest-environment jsdom
 */

import DynamicConfig from '../DynamicConfig';
import StatsigClient from '../StatsigClient';
import { INTERNAL_STORE_KEY } from '../utils/Constants';

describe('Verify local storage limits are enforced', () => {
  const sdkKey = 'client-internalstorekey';
  const gates = {
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

  class LocalStorageMock {
    public store: Record<string, string>;
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

  const localStorage = new LocalStorageMock();
  // @ts-ignore
  Object.defineProperty(window, 'localStorage', {
    value: localStorage,
  });

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
          dynamic_configs: configs,
        }),
    }),
  );

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    localStorage.clear();
    localStorage.store = {
      STATSIG_LOCAL_STORAGE_INTERNAL_STORE_V4: JSON.stringify({
        first: {
          feature_gates: gates,
          dynamic_configs: configs,
          time: 1646026677415,
        },
        second: {
          feature_gates: gates,
          dynamic_configs: configs,
          time: 1646026677418,
        },
        third: {
          feature_gates: gates,
          dynamic_configs: configs,
          time: 1646026677410,
        },
        fourth: {
          feature_gates: gates,
          dynamic_configs: configs,
          time: 1646026677419,
        },
        fifth: {
          feature_gates: gates,
          dynamic_configs: configs,
          time: 1646026677422,
        },
        sixth: {
          feature_gates: gates,
          dynamic_configs: configs,
          time: 1646026677423,
        },
        seventh: {
          feature_gates: gates,
          dynamic_configs: configs,
          time: 1646026677411,
        },
        eighth: {
          feature_gates: gates,
          dynamic_configs: configs,
          time: 1646026677413,
        },
        nineth: {
          feature_gates: gates,
          dynamic_configs: configs,
          time: 1646026677420,
        },
        tenth: {
          feature_gates: gates,
          dynamic_configs: configs,
          time: 1646026677420,
        },
        overflow1: {
          feature_gates: gates,
          dynamic_configs: configs,
          time: 1646026677425,
        },
        overflow2: {
          feature_gates: gates,
          dynamic_configs: configs,
          time: 1646026677425,
        },
        overflow3: {
          feature_gates: gates,
          dynamic_configs: configs,
          time: 1646026677426,
        },
        '': {
          feature_gates: gates,
          dynamic_configs: configs,
          time: 1646026677409,
        },
      }),
    };
  });

  test('Verify loading a large list gets truncated', async () => {
    expect.assertions(14);
    const client = new StatsigClient(sdkKey, null);
    expect(client.getStore()).not.toBeNull();
    await client.initializeAsync();
    const store = client.getStore();
    expect(store).not.toBeNull();
    const storeObject = JSON.parse(localStorage.getItem(INTERNAL_STORE_KEY));

    // When we save the new user we initialized with, the limit will get applied
    expect(Object.keys(storeObject).length).toEqual(10);

    // empty string is correctly removed on save
    expect('' in storeObject).toBeFalsy();
    expect('third' in storeObject).toBeFalsy();
    expect('first' in storeObject).toBeFalsy();
    expect('second' in storeObject).toBeTruthy();
    expect('seventh' in storeObject).toBeFalsy();
    expect('eighth' in storeObject).toBeFalsy();
    expect('overflow3' in storeObject).toBeTruthy();

    await client.updateUser({ userID: 'newUser' });
    store.save({
      feature_gates: gates,
      dynamic_configs: configs,
    });

    expect(
      Object.keys(JSON.parse(localStorage.getItem(INTERNAL_STORE_KEY))).length,
    ).toEqual(10);

    await client.updateUser({ userID: 'newUser2' });
    store.save({
      feature_gates: gates,
      dynamic_configs: configs,
    });

    expect(
      Object.keys(JSON.parse(localStorage.getItem(INTERNAL_STORE_KEY))).length,
    ).toEqual(10);

    // Try adding back an empty string, verify something else is evicted
    await client.updateUser({ userID: '' });
    store.save({
      feature_gates: gates,
      dynamic_configs: configs,
    });

    expect(
      Object.keys(JSON.parse(localStorage.getItem(INTERNAL_STORE_KEY))).length,
    ).toEqual(10);

    expect(
      client.getCurrentUserCacheKey() in
        JSON.parse(localStorage.getItem(INTERNAL_STORE_KEY)),
    ).toBeTruthy();
  });
});

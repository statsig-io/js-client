/**
 * @jest-environment jsdom
 */

import StatsigClient from '../StatsigClient';
import StatsigStore from '../StatsigStore';
import LocalStorageMock from './LocalStorageMock';
import TestData from './basic_initialize_response.json';

describe('Cache Eviction', () => {
  let keys: string[];
  let values: any;

  beforeAll(async () => {
    const localStorage = new LocalStorageMock();
    Object.defineProperty(window, 'localStorage', { value: localStorage });

    const client = new StatsigClient('', {}, { localMode: true });
    const store = new StatsigStore(client, null);
    for (let i = 0; i < 20; i++) {
      Date.now = jest.fn(() => i * 1000);
      await store.save(
        { userID: `a_long_user_${i}` },
        {
          ...TestData,
          feature_gates: {
            a_gate: {
              value: true,
              rule_id: `user_${i}_rule`,
              name: 'a_gate',
              secondary_exposures: [],
            },
          },
          time: 123,
        },
      );
    }

    const json = JSON.parse(
      localStorage.getItem('STATSIG_LOCAL_STORAGE_INTERNAL_STORE_V4')!,
    );

    keys = Object.keys(json);
    values = Object.values(json);
  });

  it('saves 10 users', () => {
    expect(keys.length).toBe(10);
  });

  it('has at least one negative cache key, ensuring cache is unordered', () => {
    expect(keys.find((x) => parseInt(x) < 0)).toBeDefined();
  });

  it('evicts the first 10, not the last 10', async () => {
    // ['user_10_rule', 'user_11_rule', ..., 'user_19_rule']
    const expectedRules = [...Array(10)].map((_, x) => `user_${10 + x}_rule`);
    expect(
      values.map((x: any) => x.feature_gates.a_gate.rule_id).sort(),
    ).toEqual(expectedRules.sort());
  });
});

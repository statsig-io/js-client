import StatsigClient from '../StatsigClient';
import {
  APIInitializeDataWithPrefetchedUsers,
  UserCacheValues,
} from '../StatsigStore';

describe('On merge deltas', () => {
  test('V2 values merge correctly', async () => {
    const statsig = new StatsigClient(
      'client-key',
      {},
      {
        overrideStableID: '123',
      },
    );
    const data: APIInitializeDataWithPrefetchedUsers = {
      feature_gates: {
        a_gate: {
          value: true,
          rule_id: '123',
          name: 'a_gate',
          secondary_exposures: [],
        },
      },
      dynamic_configs: {},
      layer_configs: {},
      time: 2,
    };
    const mergedValues: Record<string, UserCacheValues> = {
      v2_key: {
        feature_gates: {
          a_gate: {
            value: false,
            rule_id: 'default',
            name: 'a_gate',
            secondary_exposures: [],
          },
          b_gate: {
            value: true,
            rule_id: 'default',
            name: 'b_gate',
            secondary_exposures: [],
          },
        },
        dynamic_configs: {},
        layer_configs: {},
        time: 0,
        sticky_experiments: {},
      },
    };
    statsig
      .getStore()
      .mergeInitializeResponseIntoUserMap(
        data,
        mergedValues,
        { v1: 'v1_key', v2: 'v2_key', v3: 'v3_key' },
        {},
        statsig.getStore().getDeltasMergeFunction(mergedValues),
        statsig.getStableID(),
      );
    expect(mergedValues.v3_key.feature_gates).toEqual({
      a_gate: {
        value: true,
        rule_id: '123',
        name: 'a_gate',
        secondary_exposures: [],
      },
      b_gate: {
        value: true,
        rule_id: 'default',
        name: 'b_gate',
        secondary_exposures: [],
      },
    });
    expect(mergedValues.v3_key.time).toEqual(2);
  });
});

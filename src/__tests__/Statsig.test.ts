/**
 * @jest-environment jsdom
 */
import Statsig from '../index';
import { getHashValue } from '../utils/Hashing';

describe('Statsig', () => {
  let initCalledTimes = 0;
  const response = {
    feature_gates: {},
    dynamic_configs: {},
    layer_configs: {},
    sdkParams: {},
    has_updates: true,
    time: 1647984444418,
  };

  beforeAll(async () => {
    initCalledTimes = 0;

    // @ts-ignore
    global.fetch = jest.fn((url, params) => {
      if (url.toString().includes('/initialize')) {
        initCalledTimes++;
      }

      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(response)),
      });
    });
  });

  test('sticky bucketing', async () => {
    const expHash = getHashValue('exp');
    const layerHash = getHashValue('layer');

    // 1. Saves sticky value and returns latest

    response.dynamic_configs[expHash] = {
      value: { key: 'exp_v1' },
      is_user_in_experiment: true,
      is_experiment_active: true,
    };

    response.layer_configs[layerHash] = {
      value: { key: 'layer_v1' },
      is_user_in_experiment: true,
      is_experiment_active: true,
      allocated_experiment_name: expHash,
    };

    await Statsig.initialize(
      'client-key',
      { userID: 'dloomb' },
      { allowStickyExperimentValues: true },
    );

    expect(Statsig.getExperiment('exp', true).get('key', '')).toEqual('exp_v1');
    expect(Statsig.getLayer('layer', true).get('key', '')).toEqual('layer_v1');

    // 2. Drops user from experiment, returns the original sticky value

    response.dynamic_configs[expHash] = {
      value: { key: 'exp_v2' },
      is_user_in_experiment: false,
      is_experiment_active: true,
    };

    response.layer_configs[layerHash] = {
      value: { key: 'layer_v2' },
      is_user_in_experiment: false,
      is_experiment_active: true,
      allocated_experiment_name: expHash,
    };
    await Statsig.updateUser({ userID: 'dloomb' });

    expect(Statsig.getExperiment('exp', true).get('key', '')).toEqual('exp_v1');
    expect(Statsig.getLayer('layer', true).get('key', '')).toEqual('layer_v1');

    // 3. Deactivates experiment, returns the latest value

    response.dynamic_configs[expHash] = {
      value: { key: 'exp_v3' },
      is_user_in_experiment: false,
      is_experiment_active: false,
    };

    const newExpHash = getHashValue('new_exp');
    response.dynamic_configs[newExpHash] = {
      value: { key: 'new_exp_v3' },
      is_user_in_experiment: true,
      is_experiment_active: true,
    };

    response.layer_configs[layerHash] = {
      value: { key: 'layer_v3' },
      is_user_in_experiment: true,
      is_experiment_active: true,
      allocated_experiment_name: newExpHash,
    };
    await Statsig.updateUser({ userID: 'dloomb' });

    expect(Statsig.getExperiment('exp', true).get('key', '')).toEqual('exp_v3');
    expect(Statsig.getLayer('layer', true).get('key', '')).toEqual('layer_v3');

    // 4. Drops user from the experiments, returns second sticky value

    response.dynamic_configs[expHash] = {
      value: { key: 'exp_v4' },
      is_user_in_experiment: false,
      is_experiment_active: true,
    };

    response.dynamic_configs[newExpHash] = {
      value: { key: 'new_exp_v4' },
      is_user_in_experiment: false,
      is_experiment_active: true,
    };

    response.layer_configs[layerHash] = {
      value: { key: 'layer_v4' },
      is_user_in_experiment: false,
      is_experiment_active: true,
      allocated_experiment_name: newExpHash,
    };
    await Statsig.updateUser({ userID: 'dloomb' });

    expect(Statsig.getExperiment('exp', true).get('key', '')).toEqual('exp_v4');
    expect(Statsig.getLayer('layer', true).get('key', '')).toEqual('layer_v3');

    // 5. Drops all stickyness when user doesn't request it
    response.dynamic_configs[expHash] = {
      value: { key: 'exp_v5' },
      is_user_in_experiment: true,
      is_experiment_active: false,
    };

    response.layer_configs[layerHash] = {
      value: { key: 'layer_v5' },
      is_user_in_experiment: true,
      is_experiment_active: false,
      allocated_experiment_name: expHash,
    };
    await Statsig.updateUser({ userID: 'dloomb' });

    expect(Statsig.getExperiment('exp', false).get('key', '')).toEqual(
      'exp_v5',
    );
    expect(Statsig.getLayer('layer', false).get('key', '')).toEqual('layer_v5');

    // 6. Only sets sticky values when experiment is active
    expect(Statsig.getExperiment('exp', true).get('key', '')).toEqual('exp_v5');
    expect(Statsig.getLayer('layer', true).get('key', '')).toEqual('layer_v5');

    response.dynamic_configs[expHash] = {
      value: { key: 'exp_v6' },
      is_user_in_experiment: true,
      is_experiment_active: true,
    };

    response.layer_configs[layerHash] = {
      value: { key: 'layer_v6' },
      is_user_in_experiment: true,
      is_experiment_active: true,
      allocated_experiment_name: expHash,
    };
    await Statsig.updateUser({ userID: 'dloomb' });

    expect(Statsig.getExperiment('exp', true).get('key', '')).toEqual('exp_v6');
    expect(Statsig.getLayer('layer', true).get('key', '')).toEqual('layer_v6');

    expect(initCalledTimes).toBe(6);
  });
});

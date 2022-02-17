/**
 * @jest-environment jsdom
 */
import { sha256 } from 'js-sha256';
import StatsigClient from '../StatsigClient';
import { Base64 } from '../utils/Base64';
import StatsigAsyncStorage from '../utils/StatsigAsyncStorage';

function getHashValue(value: string) {
  let buffer = sha256.create().update(value).arrayBuffer();
  return Base64.encodeArrayBuffer(buffer);
}

const configKey = 'a_config';
const hashedConfigKey = getHashValue(configKey);

const anotherConfigKey = 'another_config';
const hashedAnotherConfigKey = getHashValue(anotherConfigKey);

const dynamicConfigs = {
  [hashedConfigKey]: {
    name: hashedConfigKey,
    rule_id: 'default',
    value: { a_key: 'a_config_value' },
    is_user_in_experiment: true,
    is_experiment_active: true,
  },
  [hashedAnotherConfigKey]: {
    name: hashedAnotherConfigKey,
    rule_id: 'default',
    value: { a_key: 'another_config_value' },
    is_user_in_experiment: true,
    is_experiment_active: true,
  },
};

const layerConfigWithExperimentKey = 'layer_with_exp';
const hashedLayerConfigWithExperimentKey = getHashValue(
  layerConfigWithExperimentKey,
);

const layerConfigWithoutExperimentKey = 'layer_without_exp';
const hashedLayerConfigWithoutExperimentKey = getHashValue(
  layerConfigWithoutExperimentKey,
);

const layerConfigs = {
  [hashedLayerConfigWithExperimentKey]: {
    default_values: {
      a_key: 'a_layer_default_value',
    },
    allocated_experiment_name: hashedConfigKey,
  },
  [hashedLayerConfigWithoutExperimentKey]: {
    default_values: {
      a_key: 'another_layer_default_value',
    },
    allocated_experiment_name: null,
  },
};

const initialResponse = {
  feature_gates: {},
  dynamic_configs: dynamicConfigs,
  layer_configs: layerConfigs,
};

describe('Statsig Layers', () => {
  var client: StatsigClient;

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

  const localStorage = new LocalStorageMock();
  // @ts-ignore
  Object.defineProperty(window, 'localStorage', {
    value: localStorage,
  });

  // @ts-ignore
  global.fetch = jest.fn((_url, _params) => {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(initialResponse),
    });
  });

  beforeEach(async () => {
    jest.resetModules();
    window.localStorage.clear();
    client = new StatsigClient('client-key', { userID: 'dloomb' });
    await client.initializeAsync();
  });

  afterEach(() => {
    StatsigAsyncStorage.asyncStorage = null;
  });

  it('returns experiment values when allocated', () => {
    let config = client.getLayer(layerConfigWithExperimentKey);
    expect(config.get('a_key', 'ERR')).toBe('a_config_value');
  });

  it('returns default values when no experiment is allocated', () => {
    let config = client.getLayer(layerConfigWithoutExperimentKey);
    expect(config.get('a_key', 'ERR')).toBe('another_layer_default_value');
    expect(config.getRuleID()).toBe('layer_defaults');
  });

  it('switches experiments when allocation changes', async () => {
    const data = JSON.parse(JSON.stringify(initialResponse));
    data['layer_configs'][hashedLayerConfigWithExperimentKey][
      'allocated_experiment_name'
    ] = hashedAnotherConfigKey;

    await client.getStore().save(client.getCurrentUserCacheKey(), data);

    let config = client.getLayer(layerConfigWithExperimentKey);
    expect(config.get('a_key', 'ERR')).toBe('another_config_value');
  });

  it('switches experiments when allocation changes and the first check was sticky', async () => {
    let config = client.getLayer(layerConfigWithExperimentKey, true);
    expect(config.get('a_key', 'ERR')).toBe('a_config_value');

    const data = JSON.parse(JSON.stringify(initialResponse));
    data['layer_configs'][hashedLayerConfigWithExperimentKey][
      'allocated_experiment_name'
    ] = hashedAnotherConfigKey;

    await client.getStore().save(client.getCurrentUserCacheKey(), data);

    let anotherConfig = client.getLayer(layerConfigWithExperimentKey);
    expect(anotherConfig.get('a_key', 'ERR')).toBe('another_config_value');
  });

  it('returns first sticky experiment if allocation changes', async () => {
    const config = client.getLayer(layerConfigWithExperimentKey, true);
    expect(config.get('a_key', 'ERR')).toBe('a_config_value');

    const data = JSON.parse(JSON.stringify(initialResponse));
    data['layer_configs'][hashedLayerConfigWithExperimentKey][
      'allocated_experiment_name'
    ] = hashedAnotherConfigKey;

    await client.getStore().save(client.getCurrentUserCacheKey(), data);

    const anotherConfig = client.getLayer(layerConfigWithExperimentKey, true);
    expect(anotherConfig.get('a_key', 'ERR')).toBe('a_config_value');
  });

  it('clears the first sticky experiment if allocation changes and the first is no longer active', async () => {
    const config = client.getLayer(layerConfigWithExperimentKey, true);
    expect(config.get('a_key', 'ERR')).toBe('a_config_value');

    const data = JSON.parse(JSON.stringify(initialResponse));
    data['layer_configs'][hashedLayerConfigWithExperimentKey][
      'allocated_experiment_name'
    ] = hashedAnotherConfigKey;
    data['dynamic_configs'][hashedConfigKey]['is_experiment_active'] = false;

    await client.getStore().save(client.getCurrentUserCacheKey(), data);

    const anotherConfig = client.getLayer(layerConfigWithExperimentKey, true);
    expect(anotherConfig.get('a_key', 'ERR')).toBe('another_config_value');
  });

  it('logs the correct exposure', () => {
    const logger = client.getLogger();
    const spyOnLog = jest.spyOn(logger, 'log');
    client.getLayer(layerConfigWithExperimentKey);

    expect(spyOnLog).toHaveBeenCalled();
    const event = spyOnLog.mock.calls[0][0];
    expect(event['eventName']).toEqual('statsig::config_exposure');
    expect(event['metadata']).toEqual({
      config: 'layer_with_exp',
      ruleID: 'default',
      allocatedExperiment: hashedConfigKey,
    });
  });
});

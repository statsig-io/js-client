import DynamicConfig from '../DynamicConfig';

export function fallbackConfig(configName) {
  return new DynamicConfig(
    configName ?? 'invalid_config_name',
    {},
    'statsig::invalid_config',
  );
}

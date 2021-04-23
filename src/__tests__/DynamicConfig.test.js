const { default: DynamicConfig } = require('../DynamicConfig');

describe('Verify behavior of DynamicConfig', () => {
  const testConfig = new DynamicConfig(
    'test_config',
    {
      bool: true,
      number: 2,
      string: 'string',
      object: {
        key: 'value',
        key2: 123,
      },
      boolStr1: 'true',
      boolStr2: 'FALSE',
      numberStr1: '3',
      numberStr2: '3.3',
      arr: [1, 2, 'three'],
    },
    'default',
  );

  beforeEach(() => {
    expect.hasAssertions();
  });

  test('Test constructor', () => {
    // @ts-ignore
    let config = new DynamicConfig();
    expect(config.getValue()).toStrictEqual({});
    expect(config.get()).toStrictEqual({});
    expect(config.get('test', 'test')).toStrictEqual('test');

    config = new DynamicConfig('name', { test: 123 }, 'default');
    expect(config.getValue()).toStrictEqual({ test: 123 });

    // @ts-ignore
    config = new DynamicConfig('name', 123, 'default');
    expect(config.getValue()).toStrictEqual({});
  });

  test('Test nonexistent keys', () => {
    expect(testConfig.getValue('key_not_found', false)).toStrictEqual(false);
    expect(testConfig.getValue('key_not_found', true)).toStrictEqual(true);
    expect(testConfig.getValue('key_not_found', 456.2)).toStrictEqual(456.2);
    expect(testConfig.getValue('key_not_found', 'lorem ipsum')).toStrictEqual(
      'lorem ipsum',
    );
    expect(testConfig.getValue('key_not_found', {})).toStrictEqual({});
    expect(testConfig.getValue('key_not_found', ['test', 1])).toStrictEqual([
      'test',
      1,
    ]);
    expect(testConfig.getValue('key_not_found')).toStrictEqual(null);
    expect(testConfig.get('test', 'test')).toStrictEqual('test');
    expect(testConfig.get('test')).toStrictEqual(null);
  });

  test('Test strings', () => {
    expect(testConfig.getValue('boolStr1', '123')).toStrictEqual('true');
    expect(testConfig.getValue('number', '123')).toStrictEqual(2);
    expect(testConfig.getValue('boolStr1')).toStrictEqual('true');
    expect(testConfig.getValue('boolStr2')).toStrictEqual('FALSE');

    expect(testConfig.get('boolStr1', false)).toStrictEqual(false);
    expect(testConfig.get('boolStr2', true)).toStrictEqual(true);
    expect(testConfig.get('boolStr2')).toStrictEqual('FALSE');
  });

  test('Test numbers', () => {
    expect(testConfig.getValue('number')).toStrictEqual(2);
    expect(testConfig.getValue('numberStr1')).toStrictEqual('3');
    expect(testConfig.getValue('numberStr2')).toStrictEqual('3.3');
    expect(testConfig.get('numberStr2', 7)).toStrictEqual(7);
  });

  test('Test booleans', () => {
    expect(testConfig.getValue('bool')).toStrictEqual(true);
    expect(testConfig.get('bool', 'test')).toStrictEqual('test');
  });

  test('Test arrays', () => {
    expect(testConfig.getValue('arr')).toStrictEqual([1, 2, 'three']);
    expect(testConfig.get('bool', [])).toStrictEqual([]);
  });

  test('Test objects', () => {
    expect(testConfig.getValue('object')).toStrictEqual({
      key: 'value',
      key2: 123,
    });
    expect(testConfig.get('object', 3)).toStrictEqual(3);
    expect(testConfig.get('object', null)).toStrictEqual({
      key: 'value',
      key2: 123,
    });
  });
});

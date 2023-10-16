import DynamicConfig from '../DynamicConfig';
import { EvaluationReason } from '../utils/EvaluationReason';

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
      nullKey: null,
    },
    'default',
    {
      reason: EvaluationReason.Network,
      time: Date.now(),
    },
    [],
    '',
    null,
    'default',
    'userID',
  );

  beforeEach(() => {
    expect.hasAssertions();
  });

  test('constructor', () => {
    expect(testConfig.getRuleID()).toStrictEqual('default');
    expect(testConfig.getGroupName()).toStrictEqual('default');
    expect(testConfig.getIDType()).toStrictEqual('userID');
  });

  test('nonexistent keys', () => {
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
    expect(testConfig.get<string>('test', 'test')).toStrictEqual('test');
    expect(testConfig.get<string>('test', '')).toStrictEqual('');
  });

  test('strings', () => {
    expect(testConfig.getValue('boolStr1', '123')).toStrictEqual('true');
    expect(testConfig.getValue('number', '123')).toStrictEqual(2);
    expect(testConfig.getValue('boolStr1')).toStrictEqual('true');
    expect(testConfig.getValue('boolStr2')).toStrictEqual('FALSE');

    expect(testConfig.get('boolStr1', false)).toStrictEqual(false);
    expect(testConfig.get('boolStr2', true)).toStrictEqual(true);
    expect(testConfig.get('boolStr2', '')).toStrictEqual('FALSE');
  });

  test('numbers', () => {
    expect(testConfig.getValue('number')).toStrictEqual(2);
    expect(testConfig.getValue('numberStr1')).toStrictEqual('3');
    expect(testConfig.getValue('numberStr2')).toStrictEqual('3.3');
    expect(testConfig.get('numberStr2', 7)).toStrictEqual(7);
  });

  test('booleans', () => {
    expect(testConfig.getValue('bool')).toStrictEqual(true);
    expect(testConfig.get<boolean>('bool', false)).toStrictEqual(true);
  });

  test('arrays', () => {
    expect(testConfig.getValue('arr')).toStrictEqual([1, 2, 'three']);
    expect(testConfig.get<string[]>('bool', [])).toStrictEqual([]);
  });

  test('objects', () => {
    expect(testConfig.getValue('object')).toStrictEqual({
      key: 'value',
      key2: 123,
    });
    expect(testConfig.get<number>('object', 3)).toStrictEqual(3);
    expect(testConfig.get('object', null)).toStrictEqual({
      key: 'value',
      key2: 123,
    });
  });

  test('null', () => {
    expect(testConfig.getValue('bool', null)).toStrictEqual(true);
    expect(testConfig.getValue('bool', undefined)).toStrictEqual(true);

    expect(testConfig.getValue('nullKey')).toStrictEqual(null);
    expect(testConfig.getValue('nullKey', 'val')).toStrictEqual('val');
    expect(testConfig.getValue('nullKey', undefined)).toStrictEqual(null);
    expect(testConfig.getValue('nullKey', null)).toStrictEqual(null);

    expect(testConfig.get('nullKey', null)).toStrictEqual(null);
    expect(testConfig.get('nullKey', 'val')).toStrictEqual('val');
    expect(testConfig.get('nullKey', undefined)).toStrictEqual(undefined);

    expect(testConfig.get('no_key', undefined)).toStrictEqual(undefined);
    expect(testConfig.get('no_key', null)).toStrictEqual(null);
  });

  test('Behavior of dummy configs', () => {
    const dummyConfig = new DynamicConfig('configName', {}, '', {
      reason: EvaluationReason.Uninitialized,
      time: Date.now(),
    });
    expect(dummyConfig.get('', {})).toEqual({});
    expect(dummyConfig.get('test_field', null)).toEqual(null);
    expect(dummyConfig.get('str', 'default_value')).toEqual('default_value');
    expect(dummyConfig.get('bool', true)).toEqual(true);
    expect(dummyConfig.get('number', 1.234)).toEqual(1.234);
    expect(dummyConfig.get('arr', [1, 2, 3])).toEqual([1, 2, 3]);
    expect(dummyConfig.get('obj', { key: 'value' })).toEqual({ key: 'value' });

    expect(dummyConfig.getValue()).toEqual({});
    expect(dummyConfig.getValue('test_field')).toEqual(null);
    expect(dummyConfig.getValue('str', 'default_value')).toEqual(
      'default_value',
    );
    expect(dummyConfig.getValue('bool', true)).toEqual(true);
    expect(dummyConfig.getValue('number', 1.234)).toEqual(1.234);
    expect(dummyConfig.getValue('arr', [1, 2, 3])).toEqual([1, 2, 3]);
    expect(dummyConfig.getValue('obj', { key: 'value' })).toEqual({
      key: 'value',
    });
  });
});

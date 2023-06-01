import Layer from '../Layer';
import { EvaluationReason } from '../StatsigStore';

describe('Verify behavior of Layer', () => {
  const testLayer = Layer._create(
    'test_layer',
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
      reason: EvaluationReason.Uninitialized,
      time: Date.now(),
    },
  );

  beforeEach(() => {
    expect.hasAssertions();
  });

  test('constructor', () => {
    const layer = Layer._create('name', { test: 123 }, 'default', {
      reason: EvaluationReason.Network,
      time: Date.now(),
    });
    expect(layer.getRuleID()).toStrictEqual('default');
  });

  test('nonexistent keys', () => {
    expect(testLayer.getValue('key_not_found', false)).toStrictEqual(false);
    expect(testLayer.getValue('key_not_found', true)).toStrictEqual(true);
    expect(testLayer.getValue('key_not_found', 456.2)).toStrictEqual(456.2);
    expect(testLayer.getValue('key_not_found', 'lorem ipsum')).toStrictEqual(
      'lorem ipsum',
    );
    expect(testLayer.getValue('key_not_found', {})).toStrictEqual({});
    expect(testLayer.getValue('key_not_found', ['test', 1])).toStrictEqual([
      'test',
      1,
    ]);
    expect(testLayer.getValue('key_not_found')).toStrictEqual(null);
    expect(testLayer.get<string>('test', 'test')).toStrictEqual('test');
    expect(testLayer.get<string>('test', '')).toStrictEqual('');
  });

  test('strings', () => {
    expect(testLayer.getValue('boolStr1', '123')).toStrictEqual('true');
    expect(testLayer.getValue('number', '123')).toStrictEqual(2);
    expect(testLayer.getValue('boolStr1')).toStrictEqual('true');
    expect(testLayer.getValue('boolStr2')).toStrictEqual('FALSE');

    expect(testLayer.get('boolStr1', false)).toStrictEqual(false);
    expect(testLayer.get('boolStr2', true)).toStrictEqual(true);
    expect(testLayer.get('boolStr2', '')).toStrictEqual('FALSE');
  });

  test('numbers', () => {
    expect(testLayer.getValue('number')).toStrictEqual(2);
    expect(testLayer.getValue('numberStr1')).toStrictEqual('3');
    expect(testLayer.getValue('numberStr2')).toStrictEqual('3.3');
    expect(testLayer.get('numberStr2', 7)).toStrictEqual(7);
  });

  test('booleans', () => {
    expect(testLayer.getValue('bool')).toStrictEqual(true);
    expect(testLayer.get<boolean>('bool', false)).toStrictEqual(true);
  });

  test('arrays', () => {
    expect(testLayer.getValue('arr')).toStrictEqual([1, 2, 'three']);
    expect(testLayer.get<string[]>('bool', [])).toStrictEqual([]);
  });

  test('objects', () => {
    expect(testLayer.getValue('object')).toStrictEqual({
      key: 'value',
      key2: 123,
    });
    expect(testLayer.get<number>('object', 3)).toStrictEqual(3);
    expect(testLayer.get('object', null)).toStrictEqual({
      key: 'value',
      key2: 123,
    });
  });

  test('null', () => {
    expect(testLayer.getValue('bool', null)).toStrictEqual(true);
    expect(testLayer.getValue('bool', undefined)).toStrictEqual(true);

    expect(testLayer.getValue('nullKey')).toStrictEqual(null);
    expect(testLayer.getValue('nullKey', 'val')).toStrictEqual('val');
    expect(testLayer.getValue('nullKey', undefined)).toStrictEqual(null);
    expect(testLayer.getValue('nullKey', null)).toStrictEqual(null);

    expect(testLayer.get('nullKey', null)).toStrictEqual(null);
    expect(testLayer.get('nullKey', 'val')).toStrictEqual('val');
    expect(testLayer.get('nullKey', undefined)).toStrictEqual(undefined);

    expect(testLayer.get('no_key', undefined)).toStrictEqual(undefined);
    expect(testLayer.get('no_key', null)).toStrictEqual(null);
  });

  test('Behavior of dummy layers', () => {
    const dummyLayer = Layer._create('layerName', {}, '', {
      reason: EvaluationReason.Uninitialized,
      time: Date.now(),
    });
    expect(dummyLayer.get('', {})).toEqual({});
    expect(dummyLayer.get('test_field', null)).toEqual(null);
    expect(dummyLayer.get('str', 'default_value')).toEqual('default_value');
    expect(dummyLayer.get('bool', true)).toEqual(true);
    expect(dummyLayer.get('number', 1.234)).toEqual(1.234);
    expect(dummyLayer.get('arr', [1, 2, 3])).toEqual([1, 2, 3]);
    expect(dummyLayer.get('obj', { key: 'value' })).toEqual({ key: 'value' });

    expect(dummyLayer.getValue('test_field')).toEqual(null);
    expect(dummyLayer.getValue('str', 'default_value')).toEqual(
      'default_value',
    );
    expect(dummyLayer.getValue('bool', true)).toEqual(true);
    expect(dummyLayer.getValue('number', 1.234)).toEqual(1.234);
    expect(dummyLayer.getValue('arr', [1, 2, 3])).toEqual([1, 2, 3]);
    expect(dummyLayer.getValue('obj', { key: 'value' })).toEqual({
      key: 'value',
    });
  });
});

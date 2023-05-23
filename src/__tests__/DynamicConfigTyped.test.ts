import DynamicConfig from '../DynamicConfig';
import { EvaluationReason } from '../StatsigStore';

describe('Verify behavior of DynamicConfig', () => {
  let fallback: {
    config: DynamicConfig;
    parameter: string;
    defaultValueType: string;
    valueType: string;
  } | null = null;

  const onFallback = (
    config: DynamicConfig,
    parameter: string,
    defaultValueType: string,
    valueType: string,
  ) => {
    fallback = {
      config,
      parameter,
      defaultValueType,
      valueType,
    };
  };

  const expectFallback = function (
    config: DynamicConfig,
    parameter: string,
    defaultValue: any,
    valueType: string,
  ) {
    expect(config.get(parameter, defaultValue)).toStrictEqual(defaultValue);
    const defaultValueType = Array.isArray(defaultValue)
      ? 'array'
      : typeof defaultValue;
    expect(fallback).toStrictEqual({
      config,
      parameter,
      defaultValueType: defaultValueType,
      valueType: valueType,
    });
    fallback = null;
  };
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
    {
      reason: EvaluationReason.Network,
      time: Date.now(),
    },
    [],
    '',
    onFallback,
  );

  type TestObject = {
    key: string;
    key2: number;
  };

  type OtherTestObject = {
    someProp: string;
    otherProp: number;
  };

  const isTestObject = (obj: any): obj is TestObject => {
    return typeof obj?.key === 'string' && typeof obj?.key2 === 'number';
  };

  const isOtherTestObject = (obj: any): obj is OtherTestObject => {
    return (
      typeof obj?.someProp === 'string' && typeof obj?.otherProp === 'number'
    );
  };

  beforeEach(() => {
    fallback = null;
    expect.hasAssertions();
  });

  test('typed get', () => {
    expect(testConfig.get('bool', 3)).toStrictEqual(3);
    expectFallback(testConfig, 'bool', 3, 'boolean');
    expect(testConfig.getValue('111', 222)).toStrictEqual(222);
    // not called when default value is applied because the field is missing
    expect(fallback).toBeNull();
    expect(testConfig.get('numberStr2', 'test')).toStrictEqual('3.3');
    expect(fallback).toBeNull();
    expect(testConfig.get('boolStr1', 'test')).toStrictEqual('true');
    expect(fallback).toBeNull();
    expectFallback(testConfig, 'numberStr2', 17, 'string');
    expect(testConfig.get('arr', ['test'])).toStrictEqual([1, 2, 'three']);
    expect(fallback).toBeNull();
    expectFallback(testConfig, 'object', ['test'], 'object');
    expect(testConfig.get('object', {})).toStrictEqual({
      key: 'value',
      key2: 123,
    });
    expect(fallback).toBeNull();
  });

  test('optional type guard when runtime check succeeds', () => {
    const defaultTestObject: TestObject = {
      key: 'default',
      key2: 0,
    };
    expect(
      testConfig.get('object', defaultTestObject, isTestObject),
    ).toStrictEqual({
      key: 'value',
      key2: 123,
    });
  });

  test('optional type guard default', () => {
    const defaultOtherTestObject: OtherTestObject = {
      someProp: 'other',
      otherProp: 0,
    };
    expect(
      testConfig.get('object', defaultOtherTestObject, isOtherTestObject),
    ).toStrictEqual(defaultOtherTestObject);
  });

  test('optional type guard default when given a narrower type', () => {
    const narrowerOtherTestObject = {
      someProp: 'specificallyThisString',
      otherProp: 0,
    } as const;
    expect(
      testConfig.get('object', narrowerOtherTestObject, isOtherTestObject),
    ).toStrictEqual(narrowerOtherTestObject);
  });

  test('optional type guard default when given a wider type', () => {
    const widerOtherTestObject = {
      someProp: 'Wider type than OtherTestObject',
    };
    expect(
      testConfig.get('object', widerOtherTestObject, isOtherTestObject),
    ).toStrictEqual(widerOtherTestObject);
  });

  test('optional type guard default when given null', () => {
    expect(testConfig.get('object', null, isOtherTestObject)).toBeNull();
  });

  test('optional type guard default given undefined', () => {
    expect(
      testConfig.get('object', undefined, isOtherTestObject),
    ).toBeUndefined();
  });
});

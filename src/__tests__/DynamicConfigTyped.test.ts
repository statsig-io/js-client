import DynamicConfig from '../DynamicConfig';

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

  test('Test typed get', () => {
    expect(testConfig.get<string>('string', 'test')).toStrictEqual('string');
    expect(testConfig.get<number>('bool', 3)).toStrictEqual(3);
    expect(testConfig.get<boolean>('boolStr1', false)).toStrictEqual(false);
    expect(testConfig.get<number>('numberStr2', 17)).toStrictEqual(17);
    expect(
      testConfig.get<Array<String>>('arr', ['test']),
    ).toStrictEqual([1, 2, 'three']);
    expect(testConfig.get<object>('object', {})).toStrictEqual({
      key: 'value',
      key2: 123,
    });
  });
});

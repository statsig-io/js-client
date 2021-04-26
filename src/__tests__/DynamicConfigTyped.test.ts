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
    expect(testConfig.get('bool', 3)).toStrictEqual(3);
    expect(testConfig.getValue('111', 222)).toStrictEqual(222);
    expect(testConfig.get('numberStr2', 'test')).toStrictEqual('3.3');
    expect(testConfig.get('boolStr1', 'test')).toStrictEqual('true');
    expect(testConfig.get('numberStr2', 17)).toStrictEqual(17);
    expect(testConfig.get('arr', ['test'])).toStrictEqual([1, 2, 'three']);
    expect(testConfig.get('object', ['test'])).toStrictEqual(['test']);
    expect(testConfig.get('object', {})).toStrictEqual({
      key: 'value',
      key2: 123,
    });
  });
});

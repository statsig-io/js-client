let statsig;

describe('Verify behavior of top level index functions with synchronous local storage', () => {
  const testStorage = {
    STATSIG_LOCAL_STORAGE_STABLE_ID: '123',
    STATSIG_LOCAL_STORAGE_INTERNAL_STORE: JSON.stringify({
      123: {
        gates: {
          'rGc+6rvo48V4j1sXkvsGHeSfJfY7kMp1OHfQnw+3XbI=': {
            // always_on_gate
            name: 'rGc+6rvo48V4j1sXkvsGHeSfJfY7kMp1OHfQnw+3XbI=',
            value: true,
            rule_id: 'on',
          },
          'lfLEE28iWChuBR9aFJgXGzE/Uy1f23dqw9IO0WmU5EI=': {
            // always_off_gate
            name: 'lfLEE28iWChuBR9aFJgXGzE/Uy1f23dqw9IO0WmU5EI=',
            value: false,
            rule_id: 'default',
          },
        },
        configs: {
          'RMv0YJlLOBe7cY7HgZ3Jox34R0Wrk7jLv3DZyBETA7I=': {
            // test_config
            name: 'RMv0YJlLOBe7cY7HgZ3Jox34R0Wrk7jLv3DZyBETA7I=',
            value: {
              int: 123,
              str: 'I am a string',
            },
            _ruleID: 'ruleID',
          },
        },
      },
    }),
  };

  Storage.prototype.getItem = jest.fn((key) => testStorage[key]);
  Storage.prototype.setItem = jest.fn((key, value) => {
    testStorage[key] = value;
  });
  // @ts-ignore
  global.fetch = jest.fn(() => Promise.resolve());

  beforeEach(() => {
    // @ts-ignore
    jest.resetModules();
    statsig = require('../../index').default;
    expect.hasAssertions();
  });

  test('Verify synchronous setup is sufficient for checking gates/configs', () => {
    statsig._setup('client-key', { userID: '123' });
    expect(statsig.checkGate('always_on_gate')).toBe(true);
    expect(statsig.checkGate('always_off_gate')).toBe(false);
    expect(statsig.checkGate('i_dont_exist')).toBe(false);

    const config = statsig.getConfig('test_config');
    expect(config.get('int')).toBe(123);
    expect(config.get('str')).toBe('I am a string');
  });

  test('Verify same result after async setup complete', () => {
    statsig._setup('client-key', { userID: '123' });
    return statsig._initAsync().then(() => {
      expect(statsig.checkGate('always_on_gate')).toBe(true);
      expect(statsig.checkGate('always_off_gate')).toBe(false);
      expect(statsig.checkGate('i_dont_exist')).toBe(false);

      const config = statsig.getConfig('test_config');
      expect(config.get('int')).toBe(123);
      expect(config.get('str')).toBe('I am a string');
    });
  });
});

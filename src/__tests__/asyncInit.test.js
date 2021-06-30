let statsig;

describe('Verify behavior of top level index functions with asynchronous local storage', () => {
  class AsyncStorage {
    constructor() {
      this.store = {
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
    }

    getItem(key) {
      return Promise.resolve(this.store[key] || null);
    }

    setItem(key, value) {
      this.store[key] = String(value);
      return Promise.resolve();
    }

    removeItem(key, value) {
      delete this.store[key];
      return Promise.resolve();
    }
  }

  // @ts-ignore
  Object.defineProperty(global, 'window', {
    value: {
      localStorage: null,
    },
  });
  // @ts-ignore
  global.fetch = jest.fn(() => Promise.resolve());

  beforeEach(() => {
    // @ts-ignore
    jest.resetModules();
    statsig = require('../../index').default;
    expect.hasAssertions();
  });

  test('Synchronous setup returns defaults sync storage unavailable', () => {
    statsig._setDependencies(
      { sdkType: 'test', sdkVersion: '0.1.0' },
      new AsyncStorage(),
    );
    statsig._setup('client-key', { userID: '123' });

    expect(statsig.checkGate('always_on_gate')).toEqual(false);
    expect(statsig.checkGate('always_on_gate')).toEqual(false);
    expect(statsig.checkGate('always_on_gate')).toEqual(false);

    expect(statsig.getConfig('test_config').getValue()).toEqual({});
  });

  test('Correct result after async setup complete', () => {
    statsig._setDependencies(
      { sdkType: 'test', sdkVersion: '0.1.0' },
      new AsyncStorage(),
    );
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

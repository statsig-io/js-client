import DynamicConfig from '../DynamicConfig';
import InternalStore from '../InternalStore';
import Identity from '../Identity';
import storage from '../utils/storage';

describe('Verify behavior of InternalStore', () => {
  const sdkKey = 'test-internalstorekey';
  const gates = {
    'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=': true,
  };
  const configs = {
    'RMv0YJlLOBe7cY7HgZ3Jox34R0Wrk7jLv3DZyBETA7I=': {
      value: { bool: true },
      rule_id: 'default',
    },
  };
  const config_obj = new DynamicConfig(
    'RMv0YJlLOBe7cY7HgZ3Jox34R0Wrk7jLv3DZyBETA7I=',
    { bool: true },
    'default',
  );

  // @ts-ignore
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          disableAutoEventLogging: true,
          gates: gates,
          feature_gates: {
            'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=': {
              value: true,
              rule_id: 'ruleID123',
            },
          },
          dynamic_configs: configs,
          configs: {},
        }),
    }),
  );

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  test('Verify top level function initializes instance variables.', () => {
    expect.assertions(4);
    const statsigSDK = require('../../index').default;
    return statsigSDK.initialize(sdkKey, null).then(() => {
      // @ts-ignore
      const store = statsigSDK._store;
      expect(store.cache).toBeDefined();
      expect(store.save).toBeInstanceOf(Function);
      expect(store.checkGate).toBeInstanceOf(Function);
      expect(store.getConfig).toBeInstanceOf(Function);
    });
  });

  test('Verify save correctly saves into cache.', () => {
    expect.assertions(3);
    const ident = Identity({ userID: 'user_key' });
    // @ts-ignore
    const spyOnSet = jest.spyOn(window.localStorage.__proto__, 'setItem');
    // @ts-ignore
    const spyOnGet = jest.spyOn(window.localStorage.__proto__, 'getItem');
    storage.init();
    const store = InternalStore(ident);
    return store.loadFromLocalStorage().then(() => {
      return store.save(gates, configs).then(() => {
        const expected = {
          gates: gates,
          configs: {},
        };
        // @ts-ignore
        configs['RMv0YJlLOBe7cY7HgZ3Jox34R0Wrk7jLv3DZyBETA7I'] = {
          ...config_obj,
        };
        // @ts-ignore
        expect(store.cache['user_key']).toMatchObject(expected);
        expect(spyOnSet).toHaveBeenCalledTimes(1);
        expect(spyOnGet).toHaveBeenCalledTimes(1);
      });
    });
  });

  test('Verify checkGate throws when gateName is invalid.', () => {
    expect.assertions(8);
    const statsigSDK = require('../../index').default;
    return statsigSDK.initialize(sdkKey, { userID: 'user_key' }).then(() => {
      // @ts-ignore
      const store = statsigSDK._store;
      // @ts-ignore
      const spy = jest.spyOn(statsigSDK._logger, 'log');
      expect(() => {
        store.checkGate();
      }).toThrowError('Must pass a valid string as the gateName.');
      expect(() => {
        store.checkGate(null);
      }).toThrowError('Must pass a valid string as the gateName.');
      expect(() => {
        store.checkGate(undefined);
      }).toThrowError('Must pass a valid string as the gateName.');
      expect(() => {
        store.checkGate('');
      }).toThrowError('Must pass a valid string as the gateName.');
      expect(() => {
        store.checkGate(1);
      }).toThrowError('Must pass a valid string as the gateName.');
      expect(() => {
        store.checkGate({ obj: 'obj' });
      }).toThrowError('Must pass a valid string as the gateName.');
      expect(() => {
        store.checkGate(true);
      }).toThrowError('Must pass a valid string as the gateName.');
      expect(spy).not.toHaveBeenCalled(); // no exposure log
    });
  });

  test('Verify checkGate returns false and does NOT log exposure when gateName does not exist.', () => {
    expect.assertions(2);
    const statsigSDK = require('../../index').default;
    return statsigSDK.initialize(sdkKey, { userID: 'user_key' }).then(() => {
      // @ts-ignore
      const store = statsigSDK._store;
      // @ts-ignore
      const spy = jest.spyOn(statsigSDK._logger, 'log');
      expect(store.checkGate('fake_gate')).toBe(false);
      expect(spy).toHaveBeenCalledTimes(0);
    });
  });

  test('Verify checkGate returns the correct value.', () => {
    expect.assertions(3);
    const statsigSDK = require('../../index').default;
    return statsigSDK.initialize(sdkKey, { userID: 'user_key' }).then(() => {
      // @ts-ignore
      const store = statsigSDK._store;
      // @ts-ignore
      const spy = jest.spyOn(statsigSDK._logger, 'log');
      expect(store.checkGate('test_gate')).toBe(true);
      expect(
        store.checkGate('AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY='),
      ).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  test('Verify getConfig throws when configName is invalid.', () => {
    expect.assertions(8);
    const statsigSDK = require('../../index').default;
    return statsigSDK.initialize(sdkKey, { userID: 'user_key' }).then(() => {
      // @ts-ignore
      const store = statsigSDK._store;
      // @ts-ignore
      const spy = jest.spyOn(statsigSDK._logger, 'log');
      expect(() => {
        store.getConfig();
      }).toThrowError('Must pass a valid string as the configName.');
      expect(() => {
        store.getConfig(null);
      }).toThrowError('Must pass a valid string as the configName.');
      expect(() => {
        store.getConfig(undefined);
      }).toThrowError('Must pass a valid string as the configName.');
      expect(() => {
        store.getConfig('');
      }).toThrowError('Must pass a valid string as the configName.');
      expect(() => {
        store.getConfig(1);
      }).toThrowError('Must pass a valid string as the configName.');
      expect(() => {
        store.getConfig(true);
      }).toThrowError('Must pass a valid string as the configName.');
      expect(() => {
        store.getConfig({ obj: 'obj' });
      }).toThrowError('Must pass a valid string as the configName.');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  test('Verify getConfig returns a dummy config and does NOT log exposure when configName does not exist.', () => {
    expect.assertions(2);
    const statsigSDK = require('../../index').default;
    return statsigSDK.initialize(sdkKey, { userID: 'user_key' }).then(() => {
      // @ts-ignore
      const store = statsigSDK._store;
      // @ts-ignore
      const spy = jest.spyOn(statsigSDK._logger, 'log');
      expect(store.getConfig('fake_config')).toEqual(
        new DynamicConfig('fake_config'),
      );
      expect(spy).toHaveBeenCalledTimes(0);
    });
  });

  test('Verify getConfig returns the correct value.', () => {
    expect.assertions(2);
    const statsigSDK = require('../../index').default;
    return statsigSDK.initialize(sdkKey, { userID: 'user_key' }).then(() => {
      // @ts-ignore
      const store = statsigSDK._store;
      // @ts-ignore
      const spy = jest.spyOn(statsigSDK._logger, 'log');
      expect(store.getConfig('test_config').getValue()).toMatchObject(
        config_obj.getValue(),
      );
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});

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
      group: 'default',
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
          configs: configs,
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
    const spyOnSet = jest.spyOn(window.localStorage.__proto__, 'setItem');
    const spyOnGet = jest.spyOn(window.localStorage.__proto__, 'getItem');
    storage.init();
    const store = InternalStore(ident);
    return store.loadFromLocalStorage().then(() => {
      return store.save(gates, configs).then(() => {
        expect(store.cache['user_key']).toEqual({
          gates: gates,
          configs: {
            'RMv0YJlLOBe7cY7HgZ3Jox34R0Wrk7jLv3DZyBETA7I=': config_obj,
          },
        });
        expect(spyOnSet).toHaveBeenCalledTimes(1);
        expect(spyOnGet).toHaveBeenCalledTimes(1);
      });
    });
  });

  test('Verify checkGate returns false when gateName is invalid.', () => {
    expect.assertions(8);
    const statsigSDK = require('../../index').default;
    return statsigSDK.initialize(sdkKey, { userID: 'user_key' }).then(() => {
      // @ts-ignore
      const store = statsigSDK._store;
      // @ts-ignore
      const spy = jest.spyOn(statsigSDK._logger, 'log');
      expect(store.checkGate()).toBe(false);
      expect(store.checkGate(null)).toBe(false);
      expect(store.checkGate(undefined)).toBe(false);
      expect(store.checkGate('')).toBe(false);
      expect(store.checkGate(1)).toBe(false);
      expect(store.checkGate({ obj: 'obj' })).toBe(false);
      expect(store.checkGate(true)).toBe(false);
      expect(spy).not.toHaveBeenCalled();
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
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  test('Verify getConfig returns fallback config when configName is invalid.', () => {
    expect.assertions(8);
    const statsigSDK = require('../../index').default;
    return statsigSDK.initialize(sdkKey, { userID: 'user_key' }).then(() => {
      // @ts-ignore
      const store = statsigSDK._store;
      // @ts-ignore
      const spy = jest.spyOn(statsigSDK._logger, 'log');
      expect(store.getConfig()).toEqual(null);
      expect(store.getConfig(null)).toEqual(null);
      expect(store.getConfig(undefined)).toEqual(null);
      expect(store.getConfig('')).toEqual(null);
      expect(store.getConfig(1)).toEqual(null);
      expect(store.getConfig({ obj: 'obj' })).toEqual(null);
      expect(store.getConfig(true)).toEqual(null);
      expect(spy).not.toHaveBeenCalled();
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
      expect(store.getConfig('test_config')).toEqual(config_obj);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});

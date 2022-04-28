/**
 * @jest-environment jsdom
 */

import LogEvent from '../LogEvent';
import StatsigClient from '../StatsigClient';
import { EvaluationReason } from '../StatsigStore';
let statsig;

describe('Verify behavior of top level index functions', () => {
  let postedLogs = {};
  let requestCount = 0;
  let hasCustomID = false;
  // @ts-ignore
  global.fetch = jest.fn((url, params) => {
    requestCount++;
    if (url.toString().includes('rgstr')) {
      postedLogs = JSON.parse(params.body as string);
      return Promise.resolve({ ok: true });
    }
    if (url.toString().includes('initialize')) {
      let body = JSON.parse(params.body as string);
      hasCustomID = body.user.customIDs?.['customID'] != null;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            disableAutoEventLogging: true,
            gates: {
              'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=': true,
            },
            feature_gates: {
              'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=': {
                value: true,
                rule_id: 'ruleID123',
                name: 'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=',
                secondary_exposures: [
                  {
                    gate: 'dependent_gate_1',
                    gateValue: 'true',
                    ruleID: 'rule_1',
                  },
                  {
                    gate: 'dependent_gate_2',
                    gateValue: 'false',
                    ruleID: 'default',
                  },
                ],
              },
            },
            dynamic_configs: {
              'RMv0YJlLOBe7cY7HgZ3Jox34R0Wrk7jLv3DZyBETA7I=': {
                value: {
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
                  numberStr3: '3.3.3',
                },
                rule_id: 'ruleID',
              },
            },
            layer_configs: {},
          }),
      });
    }
  });

  const str_64 =
    '1234567890123456789012345678901234567890123456789012345678901234';
  beforeEach(() => {
    jest.resetModules();
    statsig = require('../index').default;
    expect.hasAssertions();
    requestCount = 0;
    hasCustomID = false;
    window.localStorage.removeItem('STATSIG_LOCAL_STORAGE_INTERNAL_STORE_V4');

    // ensure Date.now() returns the same value in each test
    let now = Date.now();
    jest.spyOn(global.Date, 'now').mockImplementation(() => now);
  });

  test('Verify checkGate throws when calling before initialize', () => {
    expect(() => {
      statsig.checkGate('gate_that_doesnt_exist');
    }).toThrowError('Call and wait for initialize() to finish first.');
    expect(statsig.instance).toBeNull();
  });

  test('Verify checkGate throws with no gate name', () => {
    return statsig.initialize('client-key', null).then(() => {
      expect(() => {
        // @ts-ignore
        statsig.checkGate();
      }).toThrowError('Must pass a valid string as the gateName.');
    });
  });

  test('Verify checkGate throws with wrong type as gate name', () => {
    return statsig.initialize('client-key', null).then(() => {
      expect(() => {
        // @ts-ignore
        statsig.checkGate(false);
      }).toThrowError('Must pass a valid string as the gateName.');
    });
  });

  test('Verify getConfig() and getExperiment() throw with no config name', () => {
    expect.assertions(2);
    return statsig.initialize('client-key', null).then(() => {
      expect(() => {
        // @ts-ignore
        statsig.getConfig();
      }).toThrowError('Must pass a valid string as the configName.');
      expect(() => {
        // @ts-ignore
        statsig.getExperiment();
      }).toThrowError('Must pass a valid string as the experimentName.');
    });
  });

  test('Verify getConfig and getExperiment() throw with wrong type as config name', () => {
    expect.assertions(2);
    return statsig.initialize('client-key', null).then(() => {
      expect(() => {
        // @ts-ignore
        statsig.getConfig(12);
      }).toThrowError('Must pass a valid string as the configName.');
      expect(() => {
        // @ts-ignore
        statsig.getExperiment(12);
      }).toThrowError('Must pass a valid string as the experimentName.');
    });
  });

  test('Verify getConfig and getExperiment throw when calling before initialize', () => {
    expect.assertions(3);
    expect(() => {
      statsig.getConfig('config_that_doesnt_exist');
    }).toThrowError('Call and wait for initialize() to finish first.');
    expect(() => {
      statsig.getExperiment('config_that_doesnt_exist');
    }).toThrowError('Call and wait for initialize() to finish first.');
    expect(statsig.instance).toBeNull();
  });

  test('Verify logEvent throws if called before initialize()', () => {
    expect(() => {
      statsig.logEvent('test_event');
    }).toThrowError('Call and wait for initialize() to finish first.');
    expect(statsig.instance).toBeNull();
  });

  test('Verify checkGate() returns the correct value under correct circumstances', () => {
    expect.assertions(4);
    return statsig
      .initialize('client-key', null, { disableCurrentPageLogging: true })
      .then(() => {
        const ready = statsig.instance.ready;
        expect(ready).toBe(true);

        //@ts-ignore
        const spy = jest.spyOn(statsig.instance.logger, 'log');
        let gateExposure = new LogEvent('statsig::gate_exposure');
        gateExposure.setUser({});
        gateExposure.setMetadata({
          gate: 'test_gate',
          gateValue: String(true),
          ruleID: 'ruleID123',
          reason: EvaluationReason.Network,
          time: Date.now(),
        });
        gateExposure.setSecondaryExposures([
          {
            gate: 'dependent_gate_1',
            gateValue: 'true',
            ruleID: 'rule_1',
          },
          {
            gate: 'dependent_gate_2',
            gateValue: 'false',
            ruleID: 'default',
          },
        ]);
        const gateValue = statsig.checkGate('test_gate');
        expect(gateValue).toBe(true);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(gateExposure);
      });
  });

  test('Updating users before initialize throws', () => {
    expect.assertions(1);
    return expect(() => {
      statsig.updateUser({ userID: 123 });
    }).toThrowError('Call and wait for initialize() to finish first.');
  });

  test('Initialize, switch, sdk ready', () => {
    return statsig.initialize('client-key', null).then(() => {
      return statsig.updateUser({ userID: 123 }).then(() => {
        const ready = statsig.instance.ready;
        expect(ready).toBe(true);
      });
    });
  });

  test('Initialize rejects invalid SDK Key', () => {
    // @ts-ignore
    return expect(statsig.initialize()).rejects.toEqual(
      new Error(
        'Invalid key provided.  You must use a Client SDK Key from the Statsig console to initialize the sdk',
      ),
    );
  });

  test('Initialize rejects Secret Key', () => {
    return expect(statsig.initialize('secret-key', null)).rejects.toEqual(
      new Error(
        'Invalid key provided.  You must use a Client SDK Key from the Statsig console to initialize the sdk',
      ),
    );
  });

  test('Verify getConfig() behaves correctly when calling under correct conditions', () => {
    expect.assertions(4);

    return statsig
      .initialize('client-key', null, { disableCurrentPageLogging: true })
      .then(() => {
        const ready = statsig.instance.ready;
        expect(ready).toBe(true);

        //@ts-ignore
        const spy = jest.spyOn(statsig.instance.logger, 'log');
        let configExposure = new LogEvent('statsig::config_exposure');
        configExposure.setUser({});
        configExposure.setMetadata({
          config: 'test_config',
          ruleID: 'ruleID',
          reason: EvaluationReason.Network,
          time: Date.now(),
        });
        configExposure.setSecondaryExposures([]);
        const config = statsig.getConfig('test_config');
        expect(config?.value).toStrictEqual({
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
          numberStr3: '3.3.3',
        });
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(configExposure);
      });
  });

  test('initializing and updating user without awaiting', async () => {
    await statsig.initialize(
      'client-key',
      { userID: 'pass' },
      {
        disableCurrentPageLogging: true,
      },
    );
    // gate should be true for user ID 'pass'
    expect(statsig.checkGate('test_gate')).toBe(true);

    // update user to be 'fail', but don't wait for the request to return
    let p = statsig.updateUser({ userID: 'fail' });
    // should return the default value, false, instead of the previous user's value, until promise is done
    expect(statsig.checkGate('test_gate')).toBe(false);
    await p;
    expect(statsig.checkGate('test_gate')).toBe(true);

    // switch back to the previous user 'pass', and we should use the cached value, true
    statsig.updateUser({ userID: 'pass' });
    expect(statsig.checkGate('test_gate')).toBe(true);

    // switch back to 'fail' user again, and should immediately get the cached value, true
    statsig.updateUser({ userID: 'fail' });
    expect(statsig.checkGate('test_gate')).toBe(true);

    // initializing and not awaiting should also use cached value
    let client = new StatsigClient('client-key', { userID: 'pass' });
    client.initializeAsync();
    expect(client.checkGate('test_gate')).toBe(true);

    // but not for a new user
    let client2 = new StatsigClient('client-key', { userID: 'pass_2' });
    client2.initializeAsync();
    expect(client2.checkGate('test_gate')).toBe(false);
  });

  test('initializing and updating user without awaiting for no userID', async () => {
    await statsig.initialize('client-key', null, {
      disableCurrentPageLogging: true,
    });
    // gate should be true first
    expect(statsig.checkGate('test_gate')).toBe(true);

    // update user, but don't wait for the request to return
    let p = statsig.updateUser({ userID: 'fail' });
    // should return the default value, false
    expect(statsig.checkGate('test_gate')).toBe(false);

    // switch back to the previous user 'pass', and we should use the cached value, true
    statsig.updateUser(null);
    expect(statsig.checkGate('test_gate')).toBe(true);
  });

  test('Verify getExperiment() behaves correctly when calling under correct conditions', () => {
    expect.assertions(4);

    return statsig
      .initialize('client-key', null, { disableCurrentPageLogging: true })
      .then(() => {
        const ready = statsig.instance.ready;
        expect(ready).toBe(true);

        //@ts-ignore
        const spy = jest.spyOn(statsig.instance.logger, 'log');
        let configExposure = new LogEvent('statsig::config_exposure');
        configExposure.setUser({});
        configExposure.setMetadata({
          config: 'test_config',
          ruleID: 'ruleID',
          reason: EvaluationReason.Network,
          time: Date.now(),
        });
        configExposure.setSecondaryExposures([]);
        const exp = statsig.getExperiment('test_config');
        expect(exp?.value).toStrictEqual({
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
          numberStr3: '3.3.3',
        });
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(configExposure);
      });
  });

  test('Verify big user object and log event are getting trimmed', () => {
    expect.assertions(7);
    let str_1k = str_64;
    // create a 32k long string
    for (let i = 0; i < 4; i++) {
      str_1k += str_1k;
    }
    expect(str_1k.length).toBe(1024);
    return statsig
      .initialize(
        'client-key',
        {
          userID: str_64 + 'more',
          email: 'jest@statsig.com',
          custom: { extradata: str_1k },
        },
        {
          environment: { tier: 'production' },
        },
      )
      .then(() => {
        let user = statsig.instance.identity.getUser();
        expect(user.userID.length).toBe(64);
        expect(user.userID).toEqual(str_64);
        expect(user.email).toEqual('jest@statsig.com');
        expect(user.custom).toEqual({});
        expect(user.statsigEnvironment).toEqual({ tier: 'production' });
        // @ts-ignore
        const spy = jest.spyOn(statsig.instance.logger, 'log');
        statsig.logEvent(str_64 + 'extra', str_64 + 'extra', {
          extradata: str_1k,
        });
        const trimmedEvent = new LogEvent(str_64.substring(0, 64));
        trimmedEvent.setValue(str_64.substring(0, 64));
        trimmedEvent.setMetadata({ error: 'not logged due to size too large' });
        trimmedEvent.addStatsigMetadata('currentPage', 'http://localhost/');
        trimmedEvent.setUser(user);
        expect(spy).toHaveBeenCalledWith(trimmedEvent);
      });
  });

  test('calling initialize() multiple times work as expected', async () => {
    expect.assertions(5);

    // initialize() twice simultaneously reulsts in 1 promise
    const v1 = statsig.initialize('client-key');
    const v2 = statsig.initialize('client-key');
    await expect(v1).resolves.not.toThrow();
    await expect(v2).resolves.not.toThrow();
    expect(requestCount).toEqual(1);

    // initialize() again after the first one completes resolves right away and does not make a new request
    await expect(statsig.initialize('client-key')).resolves.not.toThrow();
    expect(requestCount).toEqual(1);
  });

  test('shutdown does flush logs and they are correct', async () => {
    expect.assertions(8);
    await statsig.initialize('client-key', {
      userID: '12345',
      country: 'US',
      custom: { key: 'value' },
      privateAttributes: { private: 'value' },
    });
    expect(statsig.checkGate('test_gate')).toEqual(true);
    const config = statsig.getConfig('test_config');
    expect(config?.value).toStrictEqual({
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
      numberStr3: '3.3.3',
    });
    statsig.logEvent('test_event', 'value', { key: 'value' });
    statsig.shutdown();
    expect(postedLogs['events'].length).toEqual(3);
    expect(postedLogs['events'][0]).toEqual(
      expect.objectContaining({
        eventName: 'statsig::gate_exposure',
        metadata: {
          gate: 'test_gate',
          gateValue: 'true',
          ruleID: 'ruleID123',
          reason: EvaluationReason.Network,
          time: expect.any(Number),
        },
        secondaryExposures: [
          { gate: 'dependent_gate_1', gateValue: 'true', ruleID: 'rule_1' },
          { gate: 'dependent_gate_2', gateValue: 'false', ruleID: 'default' },
        ],
        user: {
          userID: '12345',
          country: 'US',
          custom: { key: 'value' },
        },
        statsigMetadata: expect.any(Object),
        time: expect.any(Number),
        value: null,
      }),
    );
    expect(postedLogs['events'][1]).toEqual(
      expect.objectContaining({
        eventName: 'statsig::config_exposure',
        metadata: {
          config: 'test_config',
          ruleID: 'ruleID',
          reason: EvaluationReason.Network,
          time: expect.any(Number),
        },
        secondaryExposures: [],
        user: {
          userID: '12345',
          country: 'US',
          custom: { key: 'value' },
        },
        statsigMetadata: expect.any(Object),
        time: expect.any(Number),
        value: null,
      }),
    );
    expect(postedLogs['events'][2]).toEqual(
      expect.objectContaining({
        eventName: 'test_event',
        metadata: {
          key: 'value',
        },
        user: {
          userID: '12345',
          country: 'US',
          custom: { key: 'value' },
        },
        statsigMetadata: expect.any(Object),
        time: expect.any(Number),
        value: 'value',
      }),
    );
    expect(postedLogs['events'][2]).toEqual(
      expect.not.objectContaining({ secondaryExposures: expect.anything() }),
    );

    expect(postedLogs['statsigMetadata']).toEqual(
      expect.objectContaining({
        sdkType: 'js-client',
        sdkVersion: expect.any(String),
        stableID: expect.any(String),
      }),
    );
  });

  test('set and get stableID', async () => {
    await statsig.initialize(
      'client-key',
      { userID: '123' },
      { overrideStableID: '666' },
    );
    expect(statsig.getStableID()).toEqual('666');
  });

  test('LocalMode with updateUser short circuits the network requests', async () => {
    expect.assertions(2);

    await statsig.initialize(
      'client-key',
      { userID: '123' },
      { localMode: true },
    );

    const spy = jest.spyOn(statsig.instance.network, 'fetchValues');
    await expect(statsig.updateUser({ userID: '456' })).resolves.not.toThrow();
    expect(spy).toHaveBeenCalledTimes(0);
  });

  // React Native specific tests
  test('set react native uuid', async () => {
    const RNUUID = {
      v4(): string | number[] {
        return 'uuid_666';
      },
    };
    StatsigClient.setReactNativeUUID(RNUUID);
    const client = new StatsigClient(
      'client-key',
      { userID: '123' },
      { overrideStableID: '666' },
    );
    await client.initializeAsync();
    expect(client.getStableID()).toEqual('666');
    expect(client.getStatsigMetadata().sessionID).toEqual('uuid_666');
  });

  test('customIDs is sent with user', async () => {
    let client = new StatsigClient('client-key', { userID: '123' });
    await client.initializeAsync();
    expect(hasCustomID).toBeFalsy();
    client = new StatsigClient('client-key', {
      userID: '123',
      customIDs: { customID: '666' },
    });
    await client.initializeAsync();
    expect(hasCustomID).toBeTruthy();
  });
});

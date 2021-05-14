const { default: statsig } = require('../../index');
const { default: LogEvent } = require('../LogEvent');

describe('Verify behavior of top level index functions', () => {
  // @ts-ignore
  global.fetch = jest.fn(() =>
    Promise.resolve({
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
          configs: {},
        }),
    }),
  );

  const str_64 =
    '1234567890123456789012345678901234567890123456789012345678901234';

  beforeEach(() => {
    // @ts-ignore
    fetch.mockClear();
    jest.resetModules();
    expect.hasAssertions();

    // ensure Date.now() returns the same value in each test
    let now = Date.now();
    jest.spyOn(global.Date, 'now').mockImplementation(() => now);
  });

  test('Verify checkGate throws when calling before initialize', () => {
    const statsigSDK = require('../../index').default;
    expect(() => {
      statsigSDK.checkGate('gate_that_doesnt_exist');
    }).toThrowError('Call and wait for initialize() to finish first.');
    const ready = statsigSDK.isReady();
    expect(ready).toBe(false);
  });

  test('Verify checkGate throws with no gate name', () => {
    const statsigSDK = require('../../index').default;
    return statsigSDK.initialize('client-key', null).then(() => {
      expect(() => {
        // @ts-ignore
        statsigSDK.checkGate();
      }).toThrowError('Must pass a valid string as a gateName to check');
    });
  });

  test('Verify checkGate throws with wrong type as gate name', () => {
    const statsigSDK = require('../../index').default;
    return statsigSDK.initialize('client-key', null).then(() => {
      expect(() => {
        // @ts-ignore
        statsigSDK.checkGate(false);
      }).toThrowError('Must pass a valid string as a gateName to check');
    });
  });

  test('Verify getConfig throws with no gate name', () => {
    const statsigSDK = require('../../index').default;
    return statsigSDK.initialize('client-key', null).then(() => {
      expect(() => {
        // @ts-ignore
        statsigSDK.getConfig();
      }).toThrowError('Must pass a valid string as a configName to check');
    });
  });

  test('Verify getConfig throws with wrong type as gate name', () => {
    const statsigSDK = require('../../index').default;
    return statsigSDK.initialize('client-key', null).then(() => {
      expect(() => {
        // @ts-ignore
        statsigSDK.getConfig(12);
      }).toThrowError('Must pass a valid string as a configName to check');
    });
  });

  test('Verify getConfig throws when calling before initialize', () => {
    const statsigSDK = require('../../index').default;
    expect(() => {
      statsigSDK.getConfig('config_that_doesnt_exist');
    }).toThrowError('Call and wait for initialize() to finish first.');
    const ready = statsigSDK.isReady();
    expect(ready).toBe(false);
  });

  test('Verify logEvent throws if called before initialize()', () => {
    const statsigSDK = require('../../index').default;
    expect(() => {
      statsigSDK.logEvent('test_event');
    }).toThrowError('Call and wait for initialize() to finish first.');

    const ready = statsigSDK.isReady();
    expect(ready).toBe(false);
  });

  test('Verify updateUser rejects before initialize()', () => {
    const statsigSDK = require('../../index').default;
    return statsigSDK.updateUser({}).then((result) => {
      expect(result).toStrictEqual(false);
    });
  });

  test('Verify checkGate() returns the correct value under correct circumstances', () => {
    expect.assertions(4);
    const statsigSDK = require('../../index').default;
    return statsigSDK.initialize('client-key', null).then(() => {
      const ready = statsigSDK.isReady();
      expect(ready).toBe(true);

      //@ts-ignore
      const spy = jest.spyOn(statsigSDK._logger, 'log');
      let gateExposure = new LogEvent('statsig::gate_exposure');
      gateExposure.setUser({});
      gateExposure.setMetadata({
        gate: 'test_gate',
        gateValue: String(true),
        ruleID: 'ruleID123',
      });
      const gateValue = statsigSDK.checkGate('test_gate');
      expect(gateValue).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(gateExposure);
    });
  });

  test('Updating users before initialize does not ready the sdk', () => {
    const statsigSDK = require('../../index').default;
    return statsigSDK.updateUser({ userID: 123 }).then((result) => {
      expect(result).toStrictEqual(false);
      const ready = statsigSDK.isReady();
      expect(ready).toBe(false);
    });
  });

  test('Initialize, switch, sdk ready', () => {
    const statsigSDK = require('../../index').default;
    return statsigSDK.initialize('client-key', null).then(() => {
      return statsigSDK.updateUser({ userID: 123 }).then(() => {
        const ready = statsigSDK.isReady();
        expect(ready).toBe(true);
      });
    });
  });

  test('Initialize rejects invalid SDK Key', () => {
    const statsigSDK = require('../../index').default;
    // @ts-ignore
    return expect(statsigSDK.initialize()).rejects.toEqual(
      new Error(
        'Invalid key provided.  You must use a Client or Test SDK Key from the Statsig console with the js-client-sdk',
      ),
    );
  });

  test('Initialize rejects Secret Key', () => {
    const statsigSDK = require('../../index').default;
    return expect(statsigSDK.initialize('secret-key', null)).rejects.toEqual(
      new Error(
        'Invalid key provided.  You must use a Client or Test SDK Key from the Statsig console with the js-client-sdk',
      ),
    );
  });

  test('Verify getConfig() behaves correctly when calling under correct conditions', () => {
    expect.assertions(4);
    const statsigSDK = require('../../index').default;

    return statsigSDK.initialize('client-key', null).then(() => {
      const ready = statsigSDK.isReady();
      expect(ready).toBe(true);

      //@ts-ignore
      const spy = jest.spyOn(statsigSDK._logger, 'log');
      let configExposure = new LogEvent('statsig::config_exposure');
      configExposure.setUser({});
      configExposure.setMetadata({
        config: 'test_config',
        ruleID: 'ruleID',
      });
      const config = statsigSDK.getConfig('test_config');
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

  test('Verify big user object and log event are getting trimmed', () => {
    const statsigSDK = require('../../index').default;
    const LogEvent = require('../LogEvent').default;

    expect.assertions(6);
    let str_1k = str_64;
    // create a 32k long string
    for (let i = 0; i < 4; i++) {
      str_1k += str_1k;
    }
    expect(str_1k.length).toBe(1024);
    return statsigSDK
      .initialize('client-key', {
        userID: str_64 + 'more',
        email: 'jest@statsig.com',
        custom: { extradata: str_1k },
      })
      .then(() => {
        // @ts-ignore
        let user = statsigSDK._identity.getUser();
        expect(user.userID.length).toBe(64);
        expect(user.userID).toEqual(str_64);
        expect(user.email).toEqual('jest@statsig.com');
        expect(user.custom).toEqual({});
        // @ts-ignore
        const spy = jest.spyOn(statsigSDK._logger, 'log');
        statsigSDK.logEvent(str_64 + 'extra', str_64 + 'extra', {
          extradata: str_1k,
        });
        const trimmedEvent = new LogEvent(str_64.substring(0, 64));
        trimmedEvent.setValue(str_64.substring(0, 64));
        trimmedEvent.setMetadata({ error: 'not logged due to size too large' });
        trimmedEvent.addStatsigMetadata('currentPage', 'http://localhost/');
        trimmedEvent.setUser(user);
        expect(spy).toBeCalledWith(trimmedEvent);
      });
  });

  test('calling initialize() multiple times work as expected', async () => {
    expect.assertions(5);
    const statsigSDK = require('../../index').default;
    let count = 0;

    global.fetch = jest.fn(
      () =>
        new Promise((resolve, reject) => {
          setTimeout(() => {
            count++;
            resolve({
              // @ts-ignore
              headers: [],
              ok: true,
              json: () =>
                Promise.resolve({
                  disableAutoEventLogging: true,
                  feature_gates: {
                    'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=': {
                      value: true,
                      rule_id: 'ruleID123',
                      name: 'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=',
                    },
                  },
                  configs: {},
                }),
            });
          }, 1000);
        }),
    );

    // initialize() twice simultaneously reulsts in 1 promise
    const v1 = statsigSDK.initialize('client-key');
    const v2 = statsigSDK.initialize('client-key');
    await expect(v1).resolves.not.toThrow();
    await expect(v2).resolves.not.toThrow();
    expect(count).toEqual(1);

    // initialize() again after the first one completes resolves right away and does not make a new request
    await expect(statsigSDK.initialize('client-key')).resolves.not.toThrow();
    expect(count).toEqual(1);
  });
});

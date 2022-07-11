/**
 * @jest-environment jsdom
 */

import 'core-js';

import LogEvent from '../LogEvent';
import StatsigClient from '../StatsigClient';

describe('Verify behavior of StatsigLogger', () => {
  const sdkKey = 'client-loggertestkey';
  const waitAllPromises = () => new Promise(setImmediate);
  //@ts-ignore
  global.fetch = jest.fn((url) => {
    if (url && typeof url === 'string' && url.includes('rgstr')) {
      if (url !== 'https://events.statsigapi.net/v1/rgstr') {
        fail('invalid logevent endpoint');
      }
      return Promise.resolve({
        ok: false,
        text: () => 'error',
      });
    }
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          gates: {},
          feature_gates: {
            'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=': {
              value: true,
              rule_id: 'ruleID123',
            },
          },
          dynamic_configs: {
            'RMv0YJlLOBe7cY7HgZ3Jox34R0Wrk7jLv3DZyBETA7I=': {
              value: { bool: true },
              rule_id: 'default',
            },
          },
          configs: {},
        }),
    });
  });
  beforeEach(() => {
    expect.hasAssertions();
  });

  test('Test constructor', () => {
    expect.assertions(7);
    const client = new StatsigClient(sdkKey, { userID: 'user_key' });
    const logger = client.getLogger();
    const spyOnFlush = jest.spyOn(logger, 'flush');
    const spyOnLog = jest.spyOn(logger, 'log');
    // @ts-ignore trust me, the method exists
    const spyOnFailureLog = jest.spyOn(logger, 'appendFailureLog');
    return client.initializeAsync().then(async () => {
      logger.log(new LogEvent('event'));
      logger.log(new LogEvent('event'));
      logger.log(new LogEvent('event'));
      client.checkGate('test_gate');
      client.checkGate('test_gate');
      client.checkGate('test_gate');
      logger.log(new LogEvent('event'));
      client.getExperiment('test_config');
      client.getExperiment('test_config');
      client.getExperiment('test_config');
      expect(spyOnLog).toHaveBeenCalledTimes(6);
      client.getExperiment('test_config');
      for (var i = 0; i < 95; i++) {
        logger.log(new LogEvent('event'));
      }
      expect(spyOnFlush).toHaveBeenCalledTimes(1);
      await waitAllPromises();
      // posting logs network request fails, causing a log event failure
      expect(spyOnLog).toHaveBeenCalledTimes(101);
      expect(spyOnFailureLog).toHaveBeenCalledTimes(1);
      // manually flush again, failing again, but we dont log a second time
      logger.flush();
      await waitAllPromises();
      expect(spyOnLog).toHaveBeenCalledTimes(101);

      const elevenminslater = Date.now() + 11 * 60 * 1000;
      jest.spyOn(global.Date, 'now').mockImplementation(() => elevenminslater);

      client.checkGate('test_gate');
      client.checkGate('test_gate');
      client.getExperiment('test_config');
      client.getExperiment('test_config');
      expect(spyOnLog).toHaveBeenCalledTimes(103);

      client.updateUser({});
      client.checkGate('test_gate');
      client.checkGate('test_gate');
      client.getExperiment('test_config');
      client.getExperiment('test_config');
      expect(spyOnLog).toHaveBeenCalledTimes(105);
    });
  });
});

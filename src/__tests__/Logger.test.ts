/**
 * @jest-environment jsdom
 */

import LogEvent from '../LogEvent';
import StatsigClient from '../StatsigClient';
import 'core-js';

describe('Verify behavior of StatsigLogger', () => {
  const sdkKey = 'test-internalstorekey';
  const waitAllPromises = () => new Promise(setImmediate);
  //@ts-ignore
  global.fetch = jest.fn((url) => {
    if (url && typeof url === 'string' && url.includes('log_event')) {
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
    expect.assertions(4);
    const client = new StatsigClient();
    const logger = client.getLogger();
    const spyOnFlush = jest.spyOn(logger, 'flush');
    const spyOnLog = jest.spyOn(logger, 'log');
    return client
      .initializeAsync(sdkKey, { userID: 'user_key' })
      .then(async () => {
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
        expect(spyOnLog).toHaveBeenCalledTimes(10);
        // should log 11 events, triggering a flush
        client.getExperiment('test_config');
        expect(spyOnFlush).toHaveBeenCalledTimes(1);
        await waitAllPromises();
        // posting logs network request fails, causing a log event failure
        expect(spyOnLog).toHaveBeenCalledTimes(12);
        // manually flush again, failing again, but we dont log a second time
        logger.flush();
        await waitAllPromises();
        expect(spyOnLog).toHaveBeenCalledTimes(12);
      });
  });
});

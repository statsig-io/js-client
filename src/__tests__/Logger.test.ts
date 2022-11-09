/**
 * @jest-environment jsdom
 */

import 'core-js';

import LogEvent from '../LogEvent';
import StatsigClient from '../StatsigClient';
import StatsigLogger from '../StatsigLogger';

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
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify({
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
        ),
    });
  });
  beforeEach(() => {
    expect.hasAssertions();
  });

  test('Test constructor', () => {
    expect.assertions(8);
    const client = new StatsigClient(
      sdkKey,
      { userID: 'user_key' },
      { disableDiagnosticsLogging: true },
    );
    const logger = client.getLogger();
    const spyOnFlush = jest.spyOn(logger, 'flush');
    const spyOnLog = jest.spyOn(logger, 'log');

    // @ts-ignore access private attribute
    expect(client.getLogger().flushInterval).not.toBeNull();

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

  test('Test local mode does not set up a flush interval', () => {
    expect.assertions(1);
    const client = new StatsigClient(
      sdkKey,
      { userID: 'user_key' },
      { localMode: true },
    );

    // @ts-ignore access private attribute
    expect(client.getLogger().flushInterval).toBeNull();
  });

  describe('window/document event handling', () => {
    let logger: StatsigLogger;
    let spy: jest.SpyInstance;

    beforeEach(() => {
      jest.useFakeTimers();
      const client = new StatsigClient(sdkKey, { userID: 'user_key' });
      logger = client.getLogger();
      spy = jest.spyOn(logger, 'flush');
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('flushes quickly on init', () => {
      expect(spy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(101);
      expect(spy).toHaveBeenCalledWith();

      jest.clearAllMocks();
      expect(spy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1001);
      expect(spy).toHaveBeenCalledWith();
    });

    it('flushes on page load', () => {
      jest.advanceTimersByTime(2000);
      jest.clearAllMocks();

      window.dispatchEvent(new Event('load'));

      expect(spy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(101);
      expect(spy).toHaveBeenCalledWith();

      jest.clearAllMocks();
      expect(spy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1001);
      expect(spy).toHaveBeenCalledWith();
    });

    it('flushes on page beforeunload', () => {
      expect(spy).not.toHaveBeenCalled();
      window.dispatchEvent(new Event('beforeunload'));
      expect(spy).toHaveBeenCalledWith(true);
    });

    it('flushes on page blur', () => {
      expect(spy).not.toHaveBeenCalled();
      window.dispatchEvent(new Event('blur'));
      expect(spy).toHaveBeenCalledWith(true);
    });

    it('flushes on visibilitychange hidden', () => {
      expect(spy).not.toHaveBeenCalled();
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });
      Object.defineProperty(document, 'hidden', {
        value: true,
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(spy).toHaveBeenCalledWith(true);
    });

    it('flushes on visibilitychange visible', () => {
      expect(spy).not.toHaveBeenCalled();
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      });
      Object.defineProperty(document, 'hidden', {
        value: false,
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(spy).toHaveBeenCalledWith(false);
    });
  });

  test('Test diagnostics', async () => {
    expect.assertions(2);
    const client = new StatsigClient(
      sdkKey,
      { userID: 'user_key' },
      { disableCurrentPageLogging: true },
    );
    const logger = client.getLogger();
    const spyOnLog = jest.spyOn(logger, 'log');
    await client.initializeAsync();

    expect(spyOnLog).toHaveBeenCalledTimes(1);
    const event = new LogEvent('statsig::diagnostics');
    event.setMetadata({
      context: 'initialize',
      markers: [
        {
          action: 'start',
          key: 'overall',
          step: null,
          timestamp: expect.any(Number),
          value: null,
        },
        {
          action: 'start',
          key: 'initialize',
          step: 'network_request',
          timestamp: expect.any(Number),
          value: null,
        },
        {
          action: 'end',
          key: 'initialize',
          step: 'network_request',
          timestamp: expect.any(Number),
          value: 200,
        },
        {
          action: 'start',
          key: 'initialize',
          step: 'process',
          timestamp: expect.any(Number),
          value: null,
        },
        {
          action: 'end',
          key: 'initialize',
          step: 'process',
          timestamp: expect.any(Number),
          value: null,
        },
        {
          action: 'end',
          key: 'overall',
          step: null,
          timestamp: expect.any(Number),
          value: null,
        },
      ],
    });
    event.setUser({ userID: 'user_key' });
    expect(spyOnLog).toHaveBeenCalledWith(event);
  });
});

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

  const requestHeaders: HeadersInit = new Headers();
  requestHeaders.set('Content-Type', 'application/json');
  requestHeaders.set('x-statsig-region', 'us-west-1');

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
      headers: requestHeaders,
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
    } as Response);
  });
  beforeEach(() => {
    expect.hasAssertions();
  });

  test('constructor', () => {
    expect.assertions(11);
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
    const spyOnFailureLog = jest.spyOn(logger, 'newFailedRequest');
    const spyOnErrorBoundary = jest.spyOn(
      client.getErrorBoundary(),
      'logError',
    );
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
      for (let i = 0; i < 95; i++) {
        logger.log(new LogEvent('event'));
      }
      expect(spyOnFlush).toHaveBeenCalledTimes(1);
      expect(spyOnLog).toHaveBeenCalledTimes(101);
      await waitAllPromises();
      // posting logs network request fails, causing a log event failure
      expect(spyOnErrorBoundary).toHaveBeenCalledTimes(1);
      expect(spyOnLog).toHaveBeenCalledTimes(101);
      expect(spyOnFailureLog).toHaveBeenCalledTimes(1);
      // manually flush again, failing again
      logger.flush();
      await waitAllPromises();
      // we dont log to the logger, but we do log to error boundary
      expect(spyOnLog).toHaveBeenCalledTimes(101);
      expect(spyOnErrorBoundary).toHaveBeenCalledTimes(2);

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

  test('local mode does not set up a flush interval', () => {
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

  test('diagnostics', async () => {
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
          timestamp: expect.any(Number),
        },
        {
          action: 'start',
          key: 'initialize',
          step: 'network_request',
          retryAttempt: 0,
          timestamp: expect.any(Number),
        },
        {
          action: 'end',
          key: 'initialize',
          step: 'network_request',
          timestamp: expect.any(Number),
          statusCode: 200,
          isDelta: false,
          sdkRegion: 'us-west-1',
          success: true,
          isRetry: false,
          retryAttempt: 0,
          retryLimit: 3,
        },
        {
          action: 'start',
          key: 'initialize',
          step: 'process',
          timestamp: expect.any(Number),
        },
        {
          action: 'end',
          key: 'initialize',
          step: 'process',
          timestamp: expect.any(Number),
          success: true,
        },
        {
          action: 'end',
          key: 'overall',
          timestamp: expect.any(Number),
          success: true,
        },
      ],
    });
    event.setUser({ userID: 'user_key' });
    expect(spyOnLog).toHaveBeenCalledWith(event);
  });
});

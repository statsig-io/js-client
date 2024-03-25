/**
 * @jest-environment jsdom
 */

import 'core-js';

import LogEvent from '../LogEvent';
import StatsigClient from '../StatsigClient';
import StatsigLogger from '../StatsigLogger';
import StatsigLocalStorage from '../utils/StatsigLocalStorage';
type FailedLogEventBody = {
  events: object[];
  statsigMetadata: object;
  time: number;
};

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
        status: 408,
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

  const store: Record<string, string> = {};
  const fakeAsyncStorage = {
    getItem(key: string): Promise<string | null> {
      return Promise.resolve(store[key] ?? null);
    },
    setItem(key: string, value: string): Promise<void> {
      store[key] = value;
      return Promise.resolve();
    },
    removeItem(key: string): Promise<void> {
      delete store[key];
      return Promise.resolve();
    },
  };
  beforeEach(() => {
    expect.hasAssertions();
  });

  describe('Log Events Failure', () => {
    let client: StatsigClient
    let networkSpy: jest.SpyInstance<unknown>
    let spyOnEB:jest.SpyInstance<unknown>
    let spyOnLog: jest.SpyInstance<unknown>
    let spyOnFlush: jest.SpyInstance<unknown>
    let spyOnResend: jest.SpyInstance<unknown>
    let logger: StatsigLogger
    beforeEach(async () => {
      client = new StatsigClient(
        sdkKey,
        { userID: 'user_key' },
        { disableDiagnosticsLogging: true },
      );
      StatsigClient.setAsyncStorage(fakeAsyncStorage)
      networkSpy = jest.spyOn(client.getNetwork(), 'postToEndpoint')
      // Mock postToEndpoint directly so we bypass retry to speed up tests
      networkSpy.mockImplementation((endpointName) => {
        if(endpointName == 'initialize') {
          const response = {
            ok: true,
            status: 200,
            headers: requestHeaders,
          } as Response
          return  Promise.resolve(
            {
             ...response,
              data:{
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
            }},
          )
        }
        return Promise.reject("Sample error")
      })
      logger = client.getLogger()
      spyOnFlush = jest.spyOn(logger, 'flush');
      spyOnLog = jest.spyOn(logger, 'log');
      spyOnResend = jest.spyOn(client.getLogger(), "sendSavedRequests")
      spyOnEB = jest.spyOn(client.getErrorBoundary(), "logError")
    })

    afterEach(() => {
      networkSpy.mockClear()
    })

    it('Save to cache when failure', async () => {

      // @ts-ignore access private attribute
      expect(client.getLogger().flushInterval).not.toBeNull();

      await client.initializeAsync().then(async () => {
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
        expect(spyOnLog).toHaveBeenCalledTimes(7);
        client.getExperiment('test_config');
        for (let i = 0; i < 95; i++) {
          logger.log(new LogEvent('event'));
        }
        expect(spyOnFlush).toHaveBeenCalledTimes(1);
        expect(spyOnLog).toHaveBeenCalledTimes(102);
        client.shutdown()
        await waitAllPromises()
        const savedLoggingRequest = await fakeAsyncStorage.getItem('STATSIG_LOCAL_STORAGE_LOGGING_REQUEST')
        expect(JSON.parse(savedLoggingRequest ?? "")).toMatchObject([{ "events": expect.any(Array), "statsigMetadata": expect.any(Object), "time": expect.any(Number) }, { "events": expect.any(Array), "statsigMetadata": expect.any(Object), "time": expect.any(Number) }])
      });
    });

    it("Retry on restart", async () => {
      // No events have been dropped yet
      await client.initializeAsync()
      expect(spyOnEB).not.toBeCalled()
      expect(spyOnResend).toBeCalledTimes(1)
      client.shutdown()
    })

    it("Drop events when too old when retry at initialization", async () => {
      const eightDaysLater = Date.now() + 8 * 24 * 60 * 60 * 1000;
      jest.spyOn(global.Date, 'now').mockImplementation(() => eightDaysLater);
      await client.initializeAsync()
      expect(spyOnResend).toBeCalledTimes(1)
      // Drop 3 batches, 2 from frist session within test and 1 from second session
      await waitAllPromises()
      expect(spyOnEB).toBeCalledTimes(3)
      client.shutdown()
      await waitAllPromises()
      const savedLoggingRequest = await fakeAsyncStorage.getItem('STATSIG_LOCAL_STORAGE_LOGGING_REQUEST') ?? ""
      const parsedSavedLoggingRequest = JSON.parse(savedLoggingRequest) as FailedLogEventBody[]
      expect(parsedSavedLoggingRequest.length).toBe(1)
    })

    it("Stop adding events(dropping) if too much", async () => {
      fakeAsyncStorage.removeItem('STATSIG_LOCAL_STORAGE_LOGGING_REQUEST')
      for (let i = 0; i < 1005; i++) {
        client.logEvent("test_event");
      }
      client.shutdown()
      await waitAllPromises()
      // Dropping last batch because it's too much 
      expect(spyOnEB).toBeCalledTimes(1)
      const savedLoggingRequest = await fakeAsyncStorage.getItem('STATSIG_LOCAL_STORAGE_LOGGING_REQUEST') ?? ""
      const parsedSavedLoggingRequest = JSON.parse(savedLoggingRequest) as FailedLogEventBody[]
      expect(parsedSavedLoggingRequest.length).toBe(10)
    })
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
      statsigOptions: {
        "disableCurrentPageLogging": true,
      },
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
          attempt: 1,
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
          attempt: 1,
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
          evaluationDetails: {
            reason: 'Uninitialized',
            time: 0,
          },
          success: true,
        },
      ],
    });
    event.setUser({ userID: 'user_key' });
    expect(spyOnLog).toHaveBeenCalledWith(event);
  });
});

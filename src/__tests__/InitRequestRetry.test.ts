import Statsig from '../index';

describe('Statsig Initialization Retry Logic', () => {
    const DEFAULT_INIT_NETWORK_RETRIES = 3;
    let initCalledTimes = 0;
    let backoff = 1000;
    jest.setTimeout(1000000);

    beforeEach(async () => {
      initCalledTimes = 0;
      global.window = {} as any;
      // @ts-ignore
      global.fetch = jest.fn((url, params: any) => {
        if (url.toString().includes('/initialize')) {
          initCalledTimes++;
        }
        return Promise.resolve({
          ok: false,
          status: 500, // retryable code
          text: () => Promise.resolve('error!'),
        })
      });
    });

    afterEach(() => {
        delete (global as any).window;
        Statsig.shutdown();
    })
  
    test('Should retry on failure with retryable status code when retries option is not customized', async () => {
      await Statsig.initialize('client-key', { userID: 'whd' }, { initTimeoutMs: 9999 });
      jest.advanceTimersByTime(backoff * 2); // Simulate backoff period
      expect(initCalledTimes).toEqual(DEFAULT_INIT_NETWORK_RETRIES); // default retry is 3
    });
  
    test('Should not retry on failure when retries are setted to be 0', async () => {
      // Initialize Statsig with retries customized
      await Statsig.initialize('client-key', { userID: 'whd' }, { initRequestRetries: 0 });
      expect(initCalledTimes).toEqual(1);
    });

    test('Should not retry on failure when retries option is customized', async () => {
      // Initialize Statsig with retries customized
      await Statsig.initialize('client-key', { userID: 'whd' }, { initRequestRetries: 4, initTimeoutMs: 9999 });
      jest.advanceTimersByTime(backoff * 2); // Simulate backoff period
      expect(initCalledTimes).toEqual(4);
    });

    test('should only retry once if negative retries be passed in', async () => {
      await Statsig.initialize('client-key', { userID: 'whd' }, { initRequestRetries: -4, initTimeoutMs: 9999 });
      jest.advanceTimersByTime(backoff * 2);
      expect(initCalledTimes).toEqual(1);
    });
  });

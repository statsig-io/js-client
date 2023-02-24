/**
 * @jest-environment jsdom
 */
import Statsig, { StatsigClient } from '../index';

describe('Test Statsig options', () => {
  test('init completion callback when there is an error', async () => {
    expect.assertions(7);
    let initTime, initSuccess, initMessage;

    global.fetch = jest.fn((url, params) => {
      return new Promise((resolve, reject) => {
        setTimeout(
          () =>
            // @ts-ignore
            resolve({
              ok: false,
              status: 401,
              text: () => Promise.resolve('error!'),
            }),
          100,
        );
      });
    });

    const result = await Statsig.initialize(
      'client-key',
      { userID: 'jkw' },
      {
        initCompletionCallback: (time, success, message) => {
          initTime = time;
          initSuccess = success;
          initMessage = message;
        },
      },
    );

    expect(result.initDurationMs).toBeGreaterThanOrEqual(100);
    expect(result.success).toEqual(false);
    expect(result.message).toEqual('401: error!');

    expect(typeof initTime).toEqual('number');
    expect(initTime).toBeGreaterThanOrEqual(100);
    expect(initSuccess).toEqual(false);
    expect(initMessage).toEqual('401: error!');
  });

  test('init completion callback when it succeeds', async () => {
    expect.assertions(7);
    let initTime, initSuccess, initMessage;

    global.fetch = jest.fn((url, params) => {
      return new Promise((resolve, reject) => {
        setTimeout(
          () =>
            // @ts-ignore
            resolve({
              ok: true,
              status: 200,
              text: () => Promise.resolve(JSON.stringify({})),
            }),
          100,
        );
      });
    });

    const c = new StatsigClient(
      'client-key',
      { userID: 'jkw' },
      {
        initCompletionCallback: (time, success, message) => {
          initTime = time;
          initSuccess = success;
          initMessage = message;
        },
      },
    );
    const result = await c.initializeAsync();

    expect(typeof initTime).toEqual('number');
    expect(initTime).toBeGreaterThanOrEqual(100);
    expect(initSuccess).toEqual(true);
    expect(initMessage).toBeNull();

    expect(result.initDurationMs).toBeGreaterThanOrEqual(100);
    expect(result.success).toEqual(true);
    expect(result.message).toBeNull();
  });

  test('init completion callback when it times out', async () => {
    expect.assertions(9);
    let initTime, initSuccess, initMessage;

    global.fetch = jest.fn((url, params) => {
      return new Promise((resolve, reject) => {
        setTimeout(
          () =>
            // @ts-ignore
            resolve({
              ok: true,
              status: 200,
              text: () => Promise.resolve(JSON.stringify({})),
            }),
          100,
        );
      });
    });

    const c = new StatsigClient(
      'client-key',
      { userID: 'jkw' },
      {
        initTimeoutMs: 10,
        initCompletionCallback: (time, success, message) => {
          initTime = time;
          initSuccess = success;
          initMessage = message;
        },
      },
    );
    const result = await c.initializeAsync();

    expect(result.initDurationMs).toBeGreaterThanOrEqual(10);
    expect(result.initDurationMs).toBeLessThanOrEqual(1000);
    expect(result.success).toEqual(false);
    expect(result.message).toEqual('The initialization timeout of 10ms has been hit before the network request has completed.');

    expect(typeof initTime).toEqual('number');
    expect(initTime).toBeGreaterThanOrEqual(10);
    expect(initTime).toBeLessThanOrEqual(1000);
    expect(initSuccess).toEqual(false);
    expect(initMessage).toEqual(
      'The initialization timeout of 10ms has been hit before the network request has completed.',
    );
  });
});

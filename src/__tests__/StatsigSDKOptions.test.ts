/**
 * @jest-environment jsdom
 */
import Statsig from '../index';

describe('Test Statsig options', () => {
  beforeAll(async () => {
    global.fetch = jest.fn((url, params) => {
      return new Promise((resolve, reject) => {
        setTimeout(
          () =>
            // @ts-ignore
            resolve({
              ok: true,
              text: () => Promise.resolve(JSON.stringify({})),
            }),
          1000,
        );
      });
    });
  });

  test('init completion callback', async () => {
    expect.assertions(2);
    let initTime;
    await Statsig.initialize(
      'client-key',
      { userID: 'jkw' },
      {
        initCompletionCallback: (time) => {
          initTime = time;
          console.log(time);
        },
      },
    );
    expect(typeof initTime).toEqual('number');
    expect(initTime).toBeGreaterThanOrEqual(1000);
  });
});

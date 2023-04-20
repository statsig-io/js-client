/**
 * @jest-environment jsdom
 */

import Statsig from '..';

jest.mock('../StatsigSDKOptions', () => {
  const actual = jest.requireActual('../StatsigSDKOptions');
  actual.INIT_TIMEOUT_DEFAULT_MS = 1;
  return actual;
});

describe('Init Timeout Throwing', () => {
  beforeEach(async () => {
    // @ts-ignore
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
          1000,
        );
      });
    });

    await Statsig.initialize(
      'client-key',
      { userID: 'a-user' },
      { initTimeoutMs: 1 },
    );
  });

  it('does not throw with updateUser timeout, applies timeout', async () => {
    const start = Date.now();
    await Statsig.updateUser({ userID: 'b-user' });
    const end = Date.now();
    expect(end - start).toBeLessThan(100);
  });

  it('prefetch users does not throw or apply initialize timeout', async () => {
    const start = Date.now();
    await Statsig.prefetchUsers([{ userID: 'c-user' }]);
    const end = Date.now();
    expect(end - start).toBeGreaterThanOrEqual(1000);
  });
});

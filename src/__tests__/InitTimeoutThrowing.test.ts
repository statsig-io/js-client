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
      return new Promise(() => {});
    });

    await Statsig.initialize(
      'client-key',
      { userID: 'a-user' },
      { initTimeoutMs: 1 },
    );
  });

  it('does not throw with updateUser timeout', async () => {
    await Statsig.updateUser({ userID: 'b-user' });
  });

  it('does not throw with prefetchUsers timeout', async () => {
    await Statsig.prefetchUsers([{ userID: 'c-user' }]);
  });
});

/**
 * @jest-environment jsdom
 */

import Statsig from '..';

describe('Init Timeout Throwing', () => {
  const endpointCalls: Record<string, number> = {};
  beforeEach(async () => {
    // @ts-ignore
    global.fetch = jest.fn((url, params) => {
      console.log(url.toString());
      if (endpointCalls[url.toString()] !== undefined) {
        endpointCalls[url.toString()]++
      } else {
        endpointCalls[url.toString()] = 1
      }
      return Promise.reject(new Error("testing fetch throws"));
    });
  });

  it('does not retry if fetch throws', async () => {
    await Statsig.initialize(
      'client-key',
      { userID: 'a-user' },
      { api: "test" },
    );
    expect(endpointCalls["test/initialize"]).toEqual(1);
  });
});

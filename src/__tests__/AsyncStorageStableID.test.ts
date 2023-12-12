/**
 * @jest-environment jsdom
 */

import Statsig from '..';
import { StatsigUninitializedError } from '../Errors';

Statsig.encodeIntializeCall = false;

let resolvers: { resolve: (input: any) => void; reject: () => void }[] = [];

jest.mock('../utils/StatsigAsyncStorage', () => {
  return {
    asyncStorage: {},
    getItemAsync(key: string): Promise<string | null> {
      return new Promise((resolve, reject) => {
        resolvers.push({ resolve, reject });
      });
    },
    setItemAsync(key: string, value: string): Promise<void> {
      return Promise.resolve();
    },
    removeItemAsync(key: string): Promise<void> {
      return Promise.resolve();
    },
  };
});

/**
 * Tests a very specific bug where Statsig.updateUser would call /initialize with an empty StableID.
 */
describe('AsyncStorage StableID BugFix', () => {
  let requests: { url: string; body: Record<string, unknown> }[] = [];

  (global as any).fetch = jest.fn((url, params) => {
    requests.push({ url, body: JSON.parse(params.body) });
    return Promise.reject();
  });

  it('hits initialize with a stableID', async () => {
    Statsig.initialize('client-key'); // blocked waiting for stableID
    Statsig.updateUser({ userID: 'a-user' }); // issue /initialize request

    resolvers.forEach((entry) => entry.resolve('a-stable-id'));

    await new Promise((r) => setTimeout(r, 1));

    expect(requests[0].body.statsigMetadata).toMatchObject({
      stableID: expect.any(String),
    });
  });
});

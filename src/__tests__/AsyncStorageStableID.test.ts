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
  let called = false;

  (global as any).fetch = jest.fn((url, params) => {
    called = true;
    return Promise.reject();
  });

  it('does not hit initialize', async () => {
    Statsig.initialize('client-key');

    expect(async () => {
      await Statsig.updateUser({ userID: 'a-user' });
    }).rejects.toThrow(StatsigUninitializedError);

    expect(called).toBe(false);
  });
});

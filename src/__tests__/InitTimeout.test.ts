/**
 * @jest-environment jsdom
 */

import Statsig, { StatsigClient } from '..';
import { sha256Hash } from '../utils/Hashing';
import LocalStorageMock from './LocalStorageMock';

jest.mock('../StatsigSDKOptions', () => {
  const actual = jest.requireActual('../StatsigSDKOptions');
  actual.INIT_TIMEOUT_DEFAULT_MS = 1;
  return actual;
});

const NETWORK_TIME = 100;

describe('Init Timeout', () => {
  describe('Init Timeout Cleared', () => {
    const sdkKey = 'client-clienttestkey';
    const baseInitResponse = {
      feature_gates: {
        [sha256Hash('test_gate')]: {
          value: true,
          rule_id: 'ruleID123',
        },
      },
      dynamic_configs: {
        [sha256Hash('test_config')]: {
          value: {
            num: 4,
          },
        },
      },
      has_updates: true,
      time: 123456789,
    };

    let respObject: any = baseInitResponse;
    const localStorage = new LocalStorageMock();
    // @ts-ignore
    Object.defineProperty(window, 'localStorage', {
      value: localStorage,
    });

    // @ts-ignore
    global.fetch = jest.fn((url, params) => {
      if (url.toString() !== 'https://featureassets.org/v1/initialize') {
        return Promise.reject(new Error('invalid initialize endpoint'));
      }

      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(respObject)),
      });
    });

    beforeEach(() => {
      jest.resetModules();

      Statsig.encodeIntializeCall = false;
      window.localStorage.clear();
    });

    test('that override APIs work', async () => {
      const spy = jest.spyOn(global, 'clearTimeout');
      const statsig = new StatsigClient(
        sdkKey,
        { userID: '123' },
        {
          initTimeoutMs: 9999,
        },
      );
      await statsig.initializeAsync();

      expect(statsig.checkGate('test_gate')).toBe(true);
      expect(spy).toHaveBeenCalledWith(expect.any(Number));
    });
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
            NETWORK_TIME,
          );
        });
      });

      await Statsig.initialize(
        'client-key',
        { userID: 'a-user' },
        { initTimeoutMs: 1 },
      );
    });

    afterAll(() => {
      jest.resetModules();
    });

    it('does not throw with updateUser timeout, applies timeout', async () => {
      const start = Date.now();
      await Statsig.updateUser({ userID: 'b-user' });
      const end = Date.now();
      expect(end - start).toBeLessThan(50);
    });

    it('prefetch users does not throw or apply initialize timeout', async () => {
      const start = Date.now();
      await Statsig.prefetchUsers([{ userID: 'c-user' }]);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(NETWORK_TIME);
    });
  });
});

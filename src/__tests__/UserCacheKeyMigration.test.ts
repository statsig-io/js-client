/**
 * @jest-environment jsdom
 */

import { INTERNAL_STORE_KEY } from '../utils/Constants';
import { getUserCacheKey } from '../utils/Hashing';
import LocalStorageMock from './LocalStorageMock';
import Statsig, { DynamicConfig } from '..';
import * as TestData from './initialize_response.json';

const MOCK_TIME_VALUE = 11223344;
const HASHED_CONFIG_NAME = 'klGzwI7eIlw4LSeTwhb4C0NCIhHJrIf441Dni6g7DkE='; // a_config

describe('UserCacheKey Migration', () => {
  const localStorage = new LocalStorageMock();
  const user = {
    userID: 'user_id',
    customIDs: { k1: 'v1', k2: 'v2' },
  };

  let requests: { url: string; body: Record<string, unknown> }[] = [];

  beforeAll(() => {
    global.fetch = jest.fn((url, params) => {
      requests.push({
        url: url.toString(),
        body: JSON.parse(params?.body?.toString() ?? '{}'),
      });

      if (url.toString().endsWith('/initialize')) {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                ...makeResponse('from_network'),
                time: MOCK_TIME_VALUE,
              }),
            ),
        }) as any;
      }

      return new Promise(() => {}); // never return
    });

    localStorage.clear();
    Object.defineProperty(window, 'localStorage', { value: localStorage });
  });

  describe.each([
    { v1Cache: true, v2Cache: false, v3Cache: false, expected: 'v1_value' },
    { v1Cache: false, v2Cache: true, v3Cache: false, expected: 'v2_value' },
    { v1Cache: true, v2Cache: true, v3Cache: false, expected: 'v2_value' },
    { v1Cache: true, v2Cache: true, v3Cache: true, expected: 'v3_value' },
  ])('With Cache Settings: %s', ({ v1Cache, v2Cache, v3Cache, expected }) => {
    let initPromise: Promise<void>;
    let config: DynamicConfig;

    beforeAll(async () => {
      const keys = getUserCacheKey('stable_id', user, 'client-key');

      localStorage.setItem(
        INTERNAL_STORE_KEY,
        JSON.stringify({
          [keys.v1]: v1Cache ? makeResponse('v1_value') : undefined,
          [keys.v2]: v2Cache ? makeResponse('v2_value') : undefined,
          [keys.v3]: v3Cache ? makeResponse('v3_value') : undefined,
        }),
      );

      Statsig.encodeIntializeCall = false;
      initPromise = Statsig.initialize('client-key', user, {
        overrideStableID: 'stable_id',
        disableDiagnosticsLogging: true,
      });

      config = Statsig.getConfig('a_config');
      await initPromise;
    });

    it('gets a cache value', () => {
      expect(config.getValue('a_string')).toEqual(expected);
    });

    it('writes updated values with mock time to cache as v3', () => {
      const storage = JSON.parse(
        localStorage.getItem(INTERNAL_STORE_KEY) ?? '{}',
      );

      const key = getUserCacheKey('stable_id', user, 'client-key').v3;
      expect(storage[key].time).toEqual(MOCK_TIME_VALUE);
    });

    it('deletes all reference to v2', () => {
      const storage = JSON.parse(
        localStorage.getItem(INTERNAL_STORE_KEY) ?? '{}',
      );

      const key = getUserCacheKey('stable_id', user, 'client-key').v2;
      expect(storage[key]).toBeUndefined();
    });

    it('deletes all reference to v1', () => {
      const storage = JSON.parse(
        localStorage.getItem(INTERNAL_STORE_KEY) ?? '{}',
      );

      const key = getUserCacheKey('stable_id', user, 'client-key').v1;
      expect(storage[key]).toBeUndefined();
    });

    describe('once shutdown', () => {
      beforeAll(() => {
        Statsig.shutdown();
      });

      it('logged exposures as Cache', () => {
        const events = requests[1].body.events as Array<
          Record<string, unknown>
        >;
        expect(events[0].eventName).toEqual('statsig::config_exposure');
        expect(events[0].metadata).toMatchObject({
          reason: 'Cache',
        });
      });
    });
  });
});

function makeResponse(value: string) {
  return {
    ...TestData,
    ...{
      dynamic_configs: {
        [HASHED_CONFIG_NAME]: {
          name: HASHED_CONFIG_NAME,
          value: {
            a_string: value,
          },
          rule_id: 'default',
          group: 'default',
          group_name: 'default',
          is_device_based: false,
          id_type: 'userID',
          secondary_exposures: [],
        },
      },
    },
  };
}

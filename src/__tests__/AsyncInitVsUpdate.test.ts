/**
 * @jest-environment jsdom
 */

import Statsig from '..';
import StatsigClient from '../StatsigClient';
import { INTERNAL_STORE_KEY } from '../utils/Constants';
import LocalStorageMock from './LocalStorageMock';

const makeResponse = (ruleID: string, value: string) => {
  return JSON.stringify({
    feature_gates: {},
    dynamic_configs: {
      'klGzwI7eIlw4LSeTwhb4C0NCIhHJrIf441Dni6g7DkE=': {
        name: 'klGzwI7eIlw4LSeTwhb4C0NCIhHJrIf441Dni6g7DkE=',
        value: { a_key: value },
        rule_id: ruleID,
        group: 'a_group',
        is_device_based: false,
        secondary_exposures: [],
      },
    },
    layer_configs: {},
    sdkParams: {},
    has_updates: true,
    time: 1647984444418,
  });
};

const waitOneFrame = async () => {
  await new Promise((r) => setTimeout(r, 1));
};

describe('Race conditions between initializeAsync and updateUser', () => {
  Promise.all([]);
  const time = Date.now();
  let promiseForInitializeOnUserA: Promise<string>;
  let resolveInitializeForUserA: (response: string) => void;

  let promiseForUpdateUserOnUserB: Promise<string>;
  let resolveUpdateUserForUserB: (response: string) => void;

  let logs: Record<string, any>[] = [];

  // ensure Date.now() returns the same value in each test
  jest.spyOn(global.Date, 'now').mockImplementation(() => time);

  const localStorage = new LocalStorageMock();
  // @ts-ignore
  Object.defineProperty(window, 'localStorage', {
    value: localStorage,
  });

  const emptyStore = {
    feature_gates: {},
    dynamic_configs: {},
    sticky_experiments: {},
    layer_configs: {},
    time: 0,
    evaluation_time: 0,
  };
  let expectedStorage = {};

  // @ts-ignore
  global.fetch = jest.fn((url, params: any) => {
    if (url.toString().includes('/rgstr')) {
      logs.push(JSON.parse(params?.body));
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve('{}'),
      });
    }

    const body = JSON.parse(params?.body);
    return Promise.resolve({
      ok: true,
      text: () =>
        body.user.userID === 'user-a'
          ? promiseForInitializeOnUserA
          : promiseForUpdateUserOnUserB,
    });
  });

  beforeEach(() => {
    logs = [];

    localStorage.clear();

    promiseForInitializeOnUserA = new Promise((r) => {
      resolveInitializeForUserA = r;
    });

    promiseForUpdateUserOnUserB = new Promise((r) => {
      resolveUpdateUserForUserB = r;
    });
  });

  it('does not overwrite user values when unawaited response return', async () => {
    Statsig.encodeIntializeCall = false;
    const client = new StatsigClient('client-key', {
      userID: 'user-a',
      customIDs: { workID: 'employee-a' },
    });

    // Call both without awaiting either
    client.initializeAsync();

    let config = client.getExperiment('a_config');
    expect(config.getValue('a_key', 'default_value')).toEqual('default_value');
    const firstUserCacheKey = client.getCurrentUserCacheKey();

    expectedStorage[firstUserCacheKey] = emptyStore;
    expect(JSON.parse(localStorage.getItem(INTERNAL_STORE_KEY))).toMatchObject(
      expectedStorage,
    );

    client.updateUser({
      userID: 'user-b',
      customIDs: { workID: 'employee-b' },
    });
    const secondUserCacheKey = client.getCurrentUserCacheKey();
    config = client.getExperiment('a_config');
    expect(config.getValue('a_key', 'default_value')).toEqual('default_value');
    expectedStorage[secondUserCacheKey] = emptyStore;
    expect(JSON.parse(localStorage.getItem(INTERNAL_STORE_KEY))).toMatchObject(
      expectedStorage,
    );
    await waitOneFrame();

    // Send response to /initialize for initializeAsync
    const userAResponse = makeResponse('test', 'original_init_value');
    resolveInitializeForUserA(userAResponse);
    await waitOneFrame();
    expectedStorage = updateStorage(
      expectedStorage,
      firstUserCacheKey,
      userAResponse,
    );

    expect(JSON.parse(localStorage.getItem(INTERNAL_STORE_KEY))).toMatchObject(
      expectedStorage,
    );

    // Ensure we get default_value, not what was returned for initializeAsync
    config = client.getExperiment('a_config');
    expect(config.getValue('a_key', 'default_value')).toEqual('default_value');

    // Send response to /initialize for updateUser
    const userBResponse = makeResponse('control', 'update_user_value');
    resolveUpdateUserForUserB(userBResponse);
    await waitOneFrame();
    expectedStorage = updateStorage(
      expectedStorage,
      secondUserCacheKey,
      userBResponse,
    );

    expect(JSON.parse(localStorage.getItem(INTERNAL_STORE_KEY))).toMatchObject(
      expectedStorage,
    );

    // Ensure we get update_user_value that was returned for updateUser
    config = client.getExperiment('a_config');
    expect(config.getValue('a_key', 'default_value')).toEqual(
      'update_user_value',
    );

    expect(JSON.parse(localStorage.getItem(INTERNAL_STORE_KEY))).toMatchObject(
      expectedStorage,
    );

    client.shutdown();
    expect(logs).toEqual([
      {
        events: [
          expect.objectContaining({
            eventName: 'statsig::config_exposure',
            metadata: {
              config: 'a_config',
              reason: 'Uninitialized',
              ruleID: '',
              time: expect.any(Number),
            },
            user: { userID: 'user-a', customIDs: { workID: 'employee-a' } },
          }),
          expect.objectContaining({
            eventName: 'statsig::config_exposure',
            metadata: {
              config: 'a_config',
              reason: 'Uninitialized',
              ruleID: '',
              time: expect.any(Number),
            },
            user: { userID: 'user-b', customIDs: { workID: 'employee-b' } },
          }),
          expect.objectContaining({
            eventName: 'statsig::config_exposure',
            metadata: {
              config: 'a_config',
              reason: 'Network',
              ruleID: 'control',
              time: expect.any(Number),
            },
            user: { userID: 'user-b', customIDs: { workID: 'employee-b' } },
          }),
        ],
        statsigMetadata: expect.any(Object),
      },
    ]);
  });
});

function updateStorage(currentStorage, key, value) {
  const expected = { ...currentStorage };
  const newConfigs = JSON.parse(value);
  expected[key] = {
    ...currentStorage[key],
    dynamic_configs: newConfigs.dynamic_configs,
    time: Date.now(),
    evaluation_time: Date.now(),
  };
  return expected;
}

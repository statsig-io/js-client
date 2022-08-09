/**
 * @jest-environment jsdom
 */

import Statsig from '..';
import StatsigClient from '../StatsigClient';

const makeResponse = (ruleID: string, value: string) => {
  return {
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
  };
};

const waitOneFrame = async () => {
  await new Promise((r) => setTimeout(r, 1));
};

type PromiseStringRecord = Promise<Record<string, any>>;

describe('Race conditions between initializeAsync and updateUser', () => {
  Promise.all([]);
  let promiseForInitializeOnUserA: PromiseStringRecord;
  let resolveInitializeForUserA: (response: Record<string, any>) => void;

  let promiseForUpdateUserOnUserB: PromiseStringRecord;
  let resolveUpdateUserForUserB: (response: Record<string, any>) => void;

  let logs: Record<string, any>[] = [];

  // @ts-ignore
  global.fetch = jest.fn((url, params: any) => {
    if (url.toString().includes('/rgstr')) {
      logs.push(JSON.parse(params?.body));
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }

    const body = JSON.parse(params?.body);
    return Promise.resolve({
      ok: true,
      json: () =>
        body.user.userID === 'user-a'
          ? promiseForInitializeOnUserA
          : promiseForUpdateUserOnUserB,
    });
  });

  beforeEach(() => {
    logs = [];

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
    let config = client.getConfig('a_config');
    expect(config.getValue('a_key', 'default_value')).toEqual('default_value');

    client.updateUser({
      userID: 'user-b',
      customIDs: { workID: 'employee-b' },
    });

    config = client.getConfig('a_config');
    expect(config.getValue('a_key', 'default_value')).toEqual('default_value');

    await waitOneFrame();

    // Send response to /initialize for initializeAsync
    resolveInitializeForUserA(makeResponse('test', 'original_init_value'));
    await waitOneFrame();

    // Ensure we get default_value, not what was returned for initializeAsync
    config = client.getConfig('a_config');
    expect(config.getValue('a_key', 'default_value')).toEqual('default_value');

    // Send response to /initialize for updateUser
    resolveUpdateUserForUserB(makeResponse('control', 'update_user_value'));
    await waitOneFrame();

    // Ensure we get update_user_value that was returned for updateUser
    config = client.getConfig('a_config');
    expect(config.getValue('a_key', 'default_value')).toEqual(
      'update_user_value',
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

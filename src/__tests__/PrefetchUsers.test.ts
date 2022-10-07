/**
 * @jest-environment jsdom
 */

import Statsig from '..';
import StatsigClient from '../StatsigClient';

const aConfigHash = 'klGzwI7eIlw4LSeTwhb4C0NCIhHJrIf441Dni6g7DkE=';

function makeConfigDef(value: Record<string, string>) {
  return {
    name: aConfigHash,
    value,
    group: 'a_group',
    rule_id: 'a_rule_id',
    is_device_based: false,
    is_experiment_active: false,
    is_user_in_experiment: false,
    secondary_exposures: [],
  };
}

describe('Prefetch Users', () => {
  const user = { userID: 'a-user' };
  const prefetchUsers = [
    ['b-user', 'group_1'],
    ['c-user', 'group_2'],
  ].map(([userID, customID]) => ({
    userID,
    customIDs: { GroupID: customID },
  }));

  let initializeCalls = 0;

  //@ts-ignore
  global.fetch = jest.fn((_url, params) => {
    initializeCalls++;

    const body = JSON.parse(params?.body as string);

    let response = {};

    switch (body.user?.userID) {
      case undefined:
        response = {
          feature_gates: {},
          dynamic_configs: {
            [aConfigHash]: makeConfigDef({ key: 'empty_user_value' }),
          },
          layer_configs: {},
          has_updates: true,
        };
        break;
      case 'a-user':
        response = {
          feature_gates: {},
          dynamic_configs: {
            [aConfigHash]: makeConfigDef({ key: 'a_user_value' }),
          },
          layer_configs: {},
          has_updates: true,
        };
        break;
    }

    if (body.prefetchUsers) {
      response['prefetched_user_values'] = {
        '-1491500988': {
          // b-user
          feature_gates: {},
          dynamic_configs: {
            [aConfigHash]: makeConfigDef({ key: 'b_user_value' }),
          },
          layer_configs: {},
          has_updates: true,
        },
        '-1940197626': {
          // c-user
          feature_gates: {},
          dynamic_configs: {
            [aConfigHash]: makeConfigDef({ key: 'c_user_value' }),
          },
          layer_configs: {},
          has_updates: true,
        },
      };
    }

    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(response)),
    });
  });

  beforeEach(() => {
    initializeCalls = 0;
    Statsig.encodeIntializeCall = false;
  });

  it('can be initilialized with prefetchUsers only', async () => {
    const client = new StatsigClient('client-key', null, {
      overrideStableID: 'a_stable_id',
      prefetchUsers,
    });
    await client.initializeAsync();

    expect(client.getConfig('a_config').value).toEqual({
      key: 'empty_user_value',
    });
  });

  it('can be initialized with a singular user and prefetchUsers', async () => {
    const client = new StatsigClient('client-key', user, {
      overrideStableID: 'a_stable_id',
      prefetchUsers,
    });
    await client.initializeAsync();

    expect(client.getConfig('a_config').value).toEqual({
      key: 'a_user_value',
    });
  });

  it('can be initialized when singular user is also in prefetchUser', async () => {
    const client = new StatsigClient('client-key', user, {
      overrideStableID: 'a_stable_id',
      prefetchUsers: [user, ...prefetchUsers],
    });
    await client.initializeAsync();

    expect(client.getConfig('a_config').value).toEqual({
      key: 'a_user_value',
    });
  });

  it('does not hit the network for pretchUsers', async () => {
    const client = new StatsigClient('client-key', user, {
      overrideStableID: 'a_stable_id',
      prefetchUsers,
    });
    await client.initializeAsync();

    expect(initializeCalls).toBe(1);
    await client.updateUser(prefetchUsers[0]);
    expect(initializeCalls).toBe(1);

    await client.updateUser(prefetchUsers[1]);
    expect(initializeCalls).toBe(1);
  });

  it('does hit the network for a non prefetchUser', async () => {
    const client = new StatsigClient('client-key', user, {
      overrideStableID: 'a_stable_id',
      prefetchUsers,
    });
    await client.initializeAsync();

    expect(initializeCalls).toBe(1);
    await client.updateUser({ userID: 'new-user' });
    expect(initializeCalls).toBe(2);
  });

  it('returns the prefetchUsers values', async () => {
    const client = new StatsigClient('client-key', user, {
      overrideStableID: 'a_stable_id',
      prefetchUsers,
    });
    await client.initializeAsync();

    await client.updateUser(prefetchUsers[0]);
    expect(client.getConfig('a_config').value['key']).toEqual('b_user_value');

    await client.updateUser(prefetchUsers[1]);
    expect(client.getConfig('a_config').value['key']).toEqual('c_user_value');
  });

  it('hits the network if you update to a user that was previously prefetched', async () => {
    const client = new StatsigClient('client-key', user, {
      overrideStableID: 'a_stable_id',
      prefetchUsers,
    });
    await client.initializeAsync();
    expect(initializeCalls).toBe(1);

    await client.updateUser(prefetchUsers[0]);
    expect(initializeCalls).toBe(1);

    initializeCalls = 0;

    const client2 = new StatsigClient('client-key', user, {
      overrideStableID: 'a_stable_id',
    });
    await client2.initializeAsync();
    expect(initializeCalls).toBe(1);

    await client2.updateUser(prefetchUsers[0]);
    expect(initializeCalls).toBe(2);
  });

  it('does not hit network when prefetch is called with no users', async () => {
    const client = new StatsigClient('client-key', user, {
      overrideStableID: 'a_stable_id',
    });
    await client.initializeAsync();
    await client.prefetchUsers([]);
    expect(initializeCalls).toBe(1);
  });

  it('does not hit network when a user is prefetched before upateUser', async () => {
    const client = new StatsigClient('client-key', user, {
      overrideStableID: 'a_stable_id',
    });
    await client.initializeAsync();
    await client.prefetchUsers(prefetchUsers);
    expect(initializeCalls).toBe(2);

    await client.updateUser(prefetchUsers[0]);
    expect(initializeCalls).toBe(2);
  });

  it('does not consider cacheValues for previously prefetched users when re-inited', async () => {
    const client = new StatsigClient('client-key', user, {
      overrideStableID: 'a_stable_id',
      prefetchUsers,
    });
    await client.initializeAsync();
    expect(initializeCalls).toBe(1);

    const client2 = new StatsigClient('client-key', user, {
      overrideStableID: 'a_stable_id',
    });
    await client2.initializeAsync();
    expect(initializeCalls).toBe(2);

    await client2.updateUser(prefetchUsers[0]);
    expect(initializeCalls).toBe(3);
  });

  it('does not overwrite the current user when prefetchUser is called', async () => {
    const client = new StatsigClient('client-key', user, {
      overrideStableID: 'a_stable_id',
    });
    await client.initializeAsync();
    await client.prefetchUsers(prefetchUsers);

    expect(client.getConfig('a_config').value).toEqual({
      key: 'a_user_value',
    });
  });
});

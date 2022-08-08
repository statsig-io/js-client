/**
 * @jest-environment jsdom
 */

import Statsig from '..';
import StatsigClient from '../StatsigClient';

const EMPTY_RESPONSE = {
  feature_gates: {},
  dynamic_configs: {},
  layer_configs: {},
  sdkParams: {},
  has_updates: true,
  time: 1647984444418,
};

type PromiseStringRecord = Promise<Record<string, any>>;

describe('Race conditions between initializeAsync and updateUser', () => {
  Promise.all([]);
  let promiseForA: PromiseStringRecord;
  let promiseForB: PromiseStringRecord;
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
      json: () => (body.user.userID === 'user-a' ? promiseForA : promiseForB),
    });
  });

  beforeEach(() => {
    promiseForA = Promise.all([]);
    promiseForB = Promise.all([]);
    logs = [];
  });

  it('does not overwrite user values when unawaited response return', async () => {
    Statsig.encodeIntializeCall = false;
    const client = new StatsigClient('client-key', {
      userID: 'user-a',
      customIDs: { workID: 'employee-a' },
    });

    let resolverA = (a: Record<string, any>) => {};
    promiseForA = new Promise((r) => {
      resolverA = r;
    });

    let resolverB = (b: Record<string, any>) => {};
    promiseForB = new Promise((r) => {
      resolverB = r;
    });

    client.initializeAsync();
    client.updateUser({
      userID: 'user-b',
      customIDs: { workID: 'employee-b' },
    });

    await new Promise((r) => setTimeout(r, 1));

    resolverA({
      ...EMPTY_RESPONSE,
      dynamic_configs: {
        'klGzwI7eIlw4LSeTwhb4C0NCIhHJrIf441Dni6g7DkE=': {
          name: 'klGzwI7eIlw4LSeTwhb4C0NCIhHJrIf441Dni6g7DkE=',
          value: { a_key: 'original_init_value' },
          rule_id: 'test',
          group: 'test',
          is_device_based: false,
          secondary_exposures: [],
        },
      },
    });

    await new Promise((r) => setTimeout(r, 1));

    let config = client.getConfig('a_config');
    expect(config.getValue('a_key', 'default_value')).toEqual('default_value');

    resolverB({
      ...EMPTY_RESPONSE,
      dynamic_configs: {
        'klGzwI7eIlw4LSeTwhb4C0NCIhHJrIf441Dni6g7DkE=': {
          name: 'klGzwI7eIlw4LSeTwhb4C0NCIhHJrIf441Dni6g7DkE=',
          value: { a_key: 'update_user_value' },
          rule_id: 'control',
          group: 'control',
          is_device_based: false,
          secondary_exposures: [],
        },
      },
    });

    await new Promise((r) => setTimeout(r, 1));

    config = client.getConfig('a_config');
    expect(config.getValue('a_key', 'default_value')).toEqual(
      'update_user_value',
    );

    client.shutdown();
    await new Promise((r) => setTimeout(r, 1));
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
          }),
          expect.objectContaining({
            eventName: 'statsig::config_exposure',
            metadata: {
              config: 'a_config',
              reason: 'Network',
              ruleID: 'control',
              time: expect.any(Number),
            },
          }),
        ],
        statsigMetadata: expect.any(Object),
      },
    ]);
  });
});

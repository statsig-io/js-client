/**
 * @jest-environment jsdom
 */

import Statsig from '..';
import StatsigClient from '../StatsigClient';
import { EvaluationReason } from '../StatsigStore';
import * as TestData from './initialize_response.json';
import LocalStorageMock from './LocalStorageMock';

describe('Statsig Client Bootstrapping', () => {
  const sdkKey = 'client-clienttestkey';
  var parsedRequestBody;
  // @ts-ignore
  global.fetch = jest.fn((url, params) => {
    if (
      url &&
      typeof url === 'string' &&
      url.includes('initialize') &&
      url !== 'https://featuregates.org/v1/initialize'
    ) {
      return Promise.reject(new Error('invalid initialize endpoint'));
    }
    parsedRequestBody = JSON.parse(params?.body as string);
    return Promise.resolve({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            feature_gates: {
              'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=': {
                value: true,
                rule_id: 'ruleID123',
              },
            },
            dynamic_configs: {
              'RMv0YJlLOBe7cY7HgZ3Jox34R0Wrk7jLv3DZyBETA7I=': {
                value: {
                  num: 4,
                },
              },
            },
          }),
        ),
    });
  });

  const localStorage = new LocalStorageMock();
  // @ts-ignore
  Object.defineProperty(window, 'localStorage', {
    value: localStorage,
  });

  beforeEach(() => {
    jest.resetModules();
    parsedRequestBody = null;

    Statsig.encodeIntializeCall = false;
    window.localStorage.clear();
  });

  it('bootstraps with valid values', async () => {
    expect.assertions(14);

    const client = new StatsigClient(
      'client-xyz',
      { email: 'tore@statsig.com' },
      { initializeValues: TestData },
    );
    // usable immediately, without an async initialize
    expect(client.checkGate('test_gate')).toBe(false);
    expect(client.checkGate('i_dont_exist')).toBe(false);
    expect(client.checkGate('always_on_gate')).toBe(true);
    expect(client.checkGate('on_for_statsig_email')).toBe(true);
    expect(client.getConfig('test_config').get('number', 10)).toEqual(7);
    expect(client.getConfig('test_config').getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Bootstrap,
      time: expect.any(Number),
    });

    expect(client.getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Bootstrap,
      time: expect.any(Number),
    });

    await client.initializeAsync();
    // nothing changed, network not hit
    expect(parsedRequestBody).toBeNull();
    expect(client.checkGate('test_gate')).toBe(false);
    expect(client.checkGate('i_dont_exist')).toBe(false);
    expect(client.checkGate('always_on_gate')).toBe(true);
    expect(client.checkGate('on_for_statsig_email')).toBe(true);
    expect(client.getConfig('test_config').get('number', 10)).toEqual(7);
    expect(
      client.getLayer('c_layer_with_holdout').get('holdout_layer_param', 'x'),
    ).toEqual('layer_default');
  });

  it('uses defaults with bootstrap values is empty', async () => {
    expect.assertions(5);

    const client = new StatsigClient(
      'client-xyz',
      { email: 'tore@statsig.com' },
      { initializeValues: {} },
    );

    // we get defaults everywhere else
    expect(client.checkGate('test_gate')).toBe(false);
    expect(client.checkGate('always_on_gate')).toBe(false);
    expect(client.checkGate('on_for_statsig_email')).toBe(false);
    expect(client.getConfig('test_config').get('number', 10)).toEqual(10);
    expect(client.getConfig('test_config').getEvaluationDetails()).toEqual({
      reason: EvaluationReason.Unrecognized,
      time: expect.any(Number),
    });
  });

  it('reports InvalidBootstrap', () => {
    const client = new StatsigClient(
      'client-xyz',
      { userID: 'dloomb' },
      {
        initializeValues: {
          ...TestData,
          ...{ evaluated_keys: { userID: 'tore' } },
        },
      },
    );

    expect(
      client.getConfig('test_config').getEvaluationDetails(),
    ).toMatchObject({
      reason: EvaluationReason.InvalidBootstrap,
    });
  });
});

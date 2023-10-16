/**
 * @jest-environment jsdom
 */

import StatsigClient from '../StatsigClient';
import Statsig from '..';
import { EvaluationReason } from '../utils/BootstrapValidator';

describe('Verify behavior of StatsigClient when 204 returned from initialize', () => {
  const sdkKey = 'client-clienttestkey';
  let parsedRequestBody;
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
      status: 204,
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
            has_updates: true,
          }),
        ),
    });
  });

  beforeEach(() => {
    jest.resetModules();
    parsedRequestBody = null;

    Statsig.encodeIntializeCall = false;
  });

  test('status 204 response is a noop', async () => {
    expect.assertions(2);
    const statsig = new StatsigClient(sdkKey, { userID: '123' });
    await statsig.initializeAsync();

    expect(statsig.checkGate('test_gate')).toBe(false);
    // @ts-ignore
    expect(statsig.getStore().reason).toBe(EvaluationReason.NetworkNotModified);
  });
});

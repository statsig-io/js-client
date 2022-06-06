/**
 * @jest-environment node
 */

import StatsigClient from '../StatsigClient';
import { EvaluationReason } from '../StatsigStore';
import * as TestData from './initialize_response.json';

describe('Verify behavior of StatsigClient outside of browser environment', () => {
  test('Client is usable with default values', async () => {
    expect.assertions(7);

    // verify we are not in a browser environment
    expect(typeof fetch).toBe('undefined');

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

    await client.initializeAsync();
    client.shutdown();
  });
});

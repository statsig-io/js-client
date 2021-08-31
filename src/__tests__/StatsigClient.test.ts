/**
 * @jest-environment jsdom
 */

import StatsigClient from '../StatsigClient';

describe('Verify behavior of StatsigClient', () => {
  const sdkKey = 'client-clienttestkey';

  // @ts-ignore
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          feature_gates: {
            'AoZS0F06Ub+W2ONx+94rPTS7MRxuxa+GnXro5Q1uaGY=': {
              value: true,
              rule_id: 'ruleID123',
            },
          },
        }),
    }),
  );

  test('Test constructor', () => {
    expect.assertions(4);
    const client = new StatsigClient();
    expect(() => {
      client.checkGate('config_that_doesnt_exist');
    }).toThrowError('Call and wait for initialize() to finish first.');
    expect(() => {
      client.getConfig('config_that_doesnt_exist');
    }).toThrowError('Call and wait for initialize() to finish first.');
    expect(() => {
      client.getExperiment('config_that_doesnt_exist');
    }).toThrowError('Call and wait for initialize() to finish first.');
    expect(() => {
      client.logEvent('config_that_doesnt_exist');
    }).toThrowError('Must initialize() before logging events.');
  });

  test('that override APIs work', async () => {
    expect.assertions(8);
    const statsig = new StatsigClient();
    await statsig.initializeAsync(sdkKey, { userID: '123' });
    // test_gate is true without override
    expect(statsig.checkGate('test_gate')).toBe(true);

    // becomes false with override
    statsig.overrideGate('test_gate', false);
    expect(statsig.checkGate('test_gate')).toBe(false);
    expect(statsig.getOverrides()).toEqual({ test_gate: false });

    // overriding non-existent gate does not do anything
    statsig.overrideGate('fake_gate', true);
    expect(statsig.getOverrides()).toEqual({ test_gate: false });

    // remove all overrides
    statsig.removeOverride();
    expect(statsig.getOverrides()).toEqual({});

    // remove a named override
    statsig.overrideGate('test_gate', false);
    expect(statsig.checkGate('test_gate')).toBe(false);
    expect(statsig.getOverrides()).toEqual({ test_gate: false });
    statsig.removeOverride('test_gate');
    expect(statsig.getOverrides()).toEqual({});
  });
});

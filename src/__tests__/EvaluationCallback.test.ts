/**
 * @jest-environment jsdom
 */

import Statsig from '..';
import { sha256Hash } from '../utils/Hashing';

describe('Evaluation Callback', () => {
  let gateCount = 0;
  let configCount = 0;
  let expCount = 0;
  let layerCount = 0;
  let lastName = '';
  let lastRuleID = '';
  beforeAll(async () => {
    // @ts-ignore
    global.fetch = jest.fn((url, params) => {
      if (url.toString().includes('rgstr')) {
        return;
      }

      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              feature_gates: {
                [sha256Hash('a_gate')]: {
                  value: true,
                  rule_id: 'blah',
                  group_name: 'tvh',
                  id_type: 'userID',
                },
                [sha256Hash('b_gate')]: {
                  value: false,
                  rule_id: 'default',
                  group_name: null,
                  id_type: 'stableID',
                },
              },
              dynamic_configs: {
                [sha256Hash('an_experiment')]: {
                  value: { a_bool: true },
                  rule_id: '456',
                },
                [sha256Hash('a_config')]: {
                  value: { a_bool: true },
                  rule_id: '123',
                },
              },
              layer_configs: {
                [sha256Hash('a_layer')]: {
                  value: { a_bool: true },
                  rule_id: '789',
                },
              },
              sdkParams: {},
              has_updates: true,
              time: 1647984444418,
            }),
          ),
      });
    });

    // @ts-ignore
    Statsig.instance = null;
    await Statsig.initialize(
      'client-key',
      { userID: 'dloomb' },
      {
        initTimeoutMs: 1,
        disableDiagnosticsLogging: true,
        evaluationCallback: (args) => {
          if (args.type === 'gate') {
            gateCount++;
            lastName = args.gate.getName();
            lastRuleID = args.gate.getRuleID();
          }
          if (args.type === 'config') {
            configCount++;
            lastName = args.config.getName();
            lastRuleID = args.config.getRuleID();
          }
          if (args.type === 'experiment') {
            expCount++;
            lastName = args.config.getName();
            lastRuleID = args.config.getRuleID();
          }
          if (args.type === 'layer') {
            layerCount++;
            lastName = args.layer.getName();
            lastRuleID = args.layer.getRuleID();
          }
        },
      },
    );

    // @ts-ignore
    Statsig.instance.options.loggingBufferMaxSize = 1;
  });

  afterAll(() => {
    Statsig.shutdown();
  });

  it('Calls callback for gate', async () => {
    const gate = Statsig.checkGate('a_gate');
    expect(gateCount).toBe(1);
    expect(lastName).toBe('a_gate');
    expect(lastRuleID).toBe('blah');
    gateCount = 0;
  });

  it('Calls callback for gate b', async () => {
    const gate = Statsig.checkGate('b_gate');
    expect(gateCount).toBe(1);
    expect(lastName).toBe('b_gate');
    expect(lastRuleID).toBe('default');
    gateCount = 0;
  });

  it('Calls callback for non exposure gate check', async () => {
    const gate = Statsig.checkGateWithExposureLoggingDisabled('a_gate');
    expect(gateCount).toBe(1);
    expect(lastName).toBe('a_gate');
    expect(lastRuleID).toBe('blah');
    gateCount = 0;
  });

  it('Calls callback for config', async () => {
    const config = Statsig.getConfig('a_config');
    expect(configCount).toBe(1);
    expect(lastName).toBe('a_config');
    expect(lastRuleID).toBe('123');
    configCount = 0;
  });

  it('Calls callback for non exposure config check', async () => {
    const config = Statsig.getConfigWithExposureLoggingDisabled('a_config');
    expect(configCount).toBe(1);
    expect(lastName).toBe('a_config');
    expect(lastRuleID).toBe('123');
    configCount = 0;
  });

  it('Calls callback for experiment', async () => {
    const exp = Statsig.getExperiment('an_experiment');
    expect(expCount).toBe(1);
    expect(lastName).toBe('an_experiment');
    expect(lastRuleID).toBe('456');
    expCount = 0;
  });

  it('Calls callback for non exposure experiment check', async () => {
    const exp =
      Statsig.getExperimentWithExposureLoggingDisabled('an_experiment');
    expect(expCount).toBe(1);
    expect(lastName).toBe('an_experiment');
    expect(lastRuleID).toBe('456');
    expCount = 0;
  });

  it('Calls callback for layer', async () => {
    const layer = Statsig.getLayer('a_layer');
    expect(layerCount).toBe(1);
    expect(lastName).toBe('a_layer');
    expect(lastRuleID).toBe('789');
    layerCount = 0;
  });

  it('Calls callback for non exposure experiment check', async () => {
    const layer = Statsig.getLayerWithExposureLoggingDisabled('a_layer');
    expect(layerCount).toBe(1);
    expect(lastName).toBe('a_layer');
    expect(lastRuleID).toBe('789');
    layerCount = 0;
  });
});

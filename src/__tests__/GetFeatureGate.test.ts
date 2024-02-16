/**
 * @jest-environment jsdom
 */

import Statsig from '..';
import { sha256Hash } from '../utils/Hashing';

describe('ExposureLogging', () => {
  let events: {
    eventName: string;
    metadata: { gate?: string; config?: string; isManualExposure?: string, ruleID?: string, gateValue: string };
  }[] = [];

  beforeEach(async () => {
    // @ts-ignore
    global.fetch = jest.fn((url, params) => {
      if (url.toString().includes('rgstr')) {
        const newEvents: typeof events = JSON.parse(params?.body as string)[
          'events'
        ];
        newEvents.forEach(newEvent => {
          if(newEvent.eventName !== "statsig::diagnostics") {
            events.push(newEvent)
          }
        })
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
                },
                [sha256Hash('a_config')]: {
                  value: { a_bool: true },
                },
              },
              layer_configs: {
                [sha256Hash('a_layer')]: {
                  value: { a_bool: true },
                },
              },
              sdkParams: {},
              has_updates: true,
              time: 1647984444418,
            }),
          ),
      });
    });

    events = [];

    // @ts-ignore
    Statsig.instance = null;
    await Statsig.initialize(
      'client-key',
      { userID: 'dloomb' },
      { initTimeoutMs: 1, disableDiagnosticsLogging: true },
    );

    // @ts-ignore
    Statsig.instance.options.loggingBufferMaxSize = 1;
  });

  afterEach(() => {
    Statsig.shutdown();
  });

  describe('standard use', () => {
    it('logs gate exposures', async () => {
      const gate = Statsig.getFeatureGate('a_gate');
      expect(events.length).toBe(1);
      expect(gate.value).toBe(true);
      expect(events[0].metadata.gateValue).toBe('true');
      expect(events[0].metadata.gate).toEqual('a_gate');
      expect(events[0].metadata.isManualExposure).toBeUndefined();
      expect(events[0].eventName).toEqual('statsig::gate_exposure');
      expect(events[0].metadata.ruleID).toEqual('blah');
    });

    it('doesnt log gate exposures if disabled', async () => {
      const gate = Statsig.getFeatureGate('a_gate', { disableExposureLogging: true });
      expect(events.length).toBe(0);
    });

    it('doesnt ignore overrides', async () => {
      const gate = Statsig.getFeatureGate('a_gate', { disableExposureLogging: true });
      expect(events.length).toBe(0);
    });

    it('ignores overrides correctly', async () => {
      const gate = Statsig.getFeatureGate('a_gate', { disableExposureLogging: true });
      expect(gate.value).toBeTruthy();


      Statsig.overrideGate('a_gate', false)
      const overriddenGate = Statsig.getFeatureGate('a_gate', { disableExposureLogging: true });
      expect(overriddenGate.value).toBeFalsy();

      const nonOverriden = Statsig.getFeatureGate('a_gate', { disableExposureLogging: true, ignoreOverrides: true });
      expect(nonOverriden.value).toBeTruthy();
      Statsig.removeGateOverride('a_gate');
    });

    it('returns the correct group name', async () => {
      const gate = Statsig.getFeatureGate('a_gate');
      expect(gate.getValue()).toBe(true);
      expect(gate.getGroupName()).toEqual('tvh');

      const bGate = Statsig.getFeatureGate('b_gate');
      expect(bGate.getValue()).toBe(false);
      expect(bGate.getGroupName()).toEqual(null);
    });

    it('returns the correct ID type', async () => {
      const gate = Statsig.getFeatureGate('a_gate');
      expect(gate.getIDType()).toEqual('userID');

      const bGate = Statsig.getFeatureGate('b_gate');
      expect(bGate.getIDType()).toEqual('stableID');
    });
  });
});

/**
 * @jest-environment jsdom
 */

import Statsig from '..';
import { sha256Hash } from '../utils/Hashing';

describe('ExposureLogging', () => {
  let events: {
    eventName: string;
    metadata: { gate?: string; config?: string; isManualExposure?: string };
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
      Statsig.checkGate('a_gate');
      expect(events.length).toBe(1);
      expect(events[0].metadata.gate).toEqual('a_gate');
      expect(events[0].metadata.isManualExposure).toBeUndefined();
      expect(events[0].eventName).toEqual('statsig::gate_exposure');
    });

    it('logs config exposures', async () => {
      Statsig.getConfig('a_config');
      expect(events.length).toBe(1);
      expect(events[0].metadata.config).toEqual('a_config');
      expect(events[0].metadata.isManualExposure).toBeUndefined();
      expect(events[0].eventName).toEqual('statsig::config_exposure');
    });

    it('logs experiment exposures', async () => {
      Statsig.getExperiment('an_experiment');
      expect(events.length).toBe(1);
      expect(events[0].metadata.config).toEqual('an_experiment');
      expect(events[0].metadata.isManualExposure).toBeUndefined();
      expect(events[0].eventName).toEqual('statsig::config_exposure');
    });

    it('logs layer exposures', async () => {
      const layer = Statsig.getLayer('a_layer');
      layer.get('a_bool', false);
      expect(events.length).toBe(1);
      expect(events[0].metadata.config).toEqual('a_layer');
      expect(events[0].metadata.isManualExposure).toBeUndefined();
      expect(events[0].eventName).toEqual('statsig::layer_exposure');
    });
  });

  describe('exposure logging disabled', () => {
    it('does not log gate exposures', async () => {
      Statsig.checkGateWithExposureLoggingDisabled('a_gate');
      expect(events.length).toBe(0);
    });

    it('does not log config exposures', async () => {
      Statsig.getConfigWithExposureLoggingDisabled('a_config');
      expect(events.length).toBe(0);
    });

    it('does not log experiment exposures', async () => {
      Statsig.getExperimentWithExposureLoggingDisabled('an_experiment');
      expect(events.length).toBe(0);
    });

    it('does not log layer exposures', async () => {
      const layer = Statsig.getLayerWithExposureLoggingDisabled('a_layer');
      layer.get('a_bool', false);
      expect(events.length).toBe(0);
    });
  });

  describe('manual exposure logging', () => {
    it('logs a manual gate exposure', async () => {
      Statsig.manuallyLogGateExposure('a_gate');
      expect(events.length).toBe(1);
      expect(events[0].metadata.gate).toEqual('a_gate');
      expect(events[0].metadata.isManualExposure).toEqual('true');
      expect(events[0].eventName).toEqual('statsig::gate_exposure');
    });

    it('logs a manual config exposure', async () => {
      Statsig.manuallyLogConfigExposure('a_config');
      expect(events.length).toBe(1);
      expect(events[0].metadata.config).toEqual('a_config');
      expect(events[0].metadata.isManualExposure).toEqual('true');
      expect(events[0].eventName).toEqual('statsig::config_exposure');
    });

    it('logs a manual experiment exposure', async () => {
      Statsig.manuallyLogExperimentExposure('an_experiment');
      expect(events.length).toBe(1);
      expect(events[0].metadata.config).toEqual('an_experiment');
      expect(events[0].metadata.isManualExposure).toEqual('true');
      expect(events[0].eventName).toEqual('statsig::config_exposure');
    });

    it('logs a manual layer exposure', async () => {
      Statsig.manuallyLogLayerParameterExposure('a_layer', 'a_bool');
      expect(events.length).toBe(1);
      expect(events[0].metadata.config).toEqual('a_layer');
      expect(events[0].metadata.isManualExposure).toEqual('true');
      expect(events[0].eventName).toEqual('statsig::layer_exposure');
    });
  });
});

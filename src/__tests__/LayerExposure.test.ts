/**
 * @jest-environment jsdom
 */

import Statsig from '../index';
import { EvaluationReason } from '../utils/EvaluationReason';
import { sha256Hash } from '../utils/Hashing';
import { StatsigInitializeResponse } from './index.test';

type Indexable = {
  [key: string]: (_arg0: string, _arg1: any) => any;
};

describe('Layer Exposure Logging', () => {
  const response: StatsigInitializeResponse = {
    feature_gates: {},
    dynamic_configs: {},
    layer_configs: {},
    sdkParams: {},
    has_updates: true,
    time: 1647984444418,
  };
  let logs: {
    events: Record<string, any>[];
  };

  beforeAll(async () => {
    // @ts-ignore
    global.fetch = jest.fn((url, params) => {
      if (url.toString().includes('rgstr')) {
        logs = JSON.parse(params?.body as string);
        return Promise.resolve({ ok: true, text: () => Promise.resolve('{}') });
      }

      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(response)),
      });
    });
  });

  beforeEach(() => {
    logs = {
      events: [],
    };
    response.layer_configs = {};
  });

  it('does not log on invalid types', async () => {
    // @ts-ignore
    response.layer_configs[sha256Hash('layer')] = {
      value: { an_int: 99 },
    };

    await Statsig.initialize('client-key', null, {
      disableDiagnosticsLogging: true,
    });

    const layer = Statsig.getLayer('layer') as unknown as Indexable;
    layer.get('an_int', '');
    Statsig.shutdown();

    expect(logs).toEqual({
      events: [],
    });
  });

  describe.each([['getValue'], ['get']])('with method "%s"', (method) => {
    it('does not log a non-existent key', async () => {
      await Statsig.initialize('client-key', null, {
        disableDiagnosticsLogging: true,
      });

      const layer = Statsig.getLayer('layer') as unknown as Indexable;
      layer[method]('an_int', 0);
      Statsig.shutdown();

      expect(logs).toEqual({
        events: [],
      });
    });

    it('logs layers without an allocated experiment correctly', async () => {
      response.layer_configs[sha256Hash('layer')] = {
        value: { an_int: 99 },
        rule_id: 'default',
        secondary_exposures: [{ gate: 'secondary_exp' }],
        undelegated_secondary_exposures: [
          { gate: 'undelegated_secondary_exp' },
        ],
        allocated_experiment_name: '',
        explicit_parameters: [],
      };

      await Statsig.initialize('client-key', null, {
        disableDiagnosticsLogging: true,
      });

      const layer = Statsig.getLayer('layer') as unknown as Indexable;
      layer[method]('an_int', 0);
      Statsig.shutdown();

      expect(logs['events'].length).toEqual(1);

      expect(logs['events'][0]).toEqual(
        expect.objectContaining({
          metadata: {
            config: 'layer',
            ruleID: 'default',
            allocatedExperiment: '',
            parameterName: 'an_int',
            isExplicitParameter: 'false',
            reason: EvaluationReason.Network,
            time: expect.any(Number),
          },
          secondaryExposures: [{ gate: 'undelegated_secondary_exp' }],
        }),
      );
    });

    it('logs explicit and implicit parameters correctly', async () => {
      response.layer_configs[sha256Hash('layer')] = {
        value: { an_int: 99, a_string: 'value' },
        rule_id: 'default',
        secondary_exposures: [{ gate: 'secondary_exp' }],
        undelegated_secondary_exposures: [
          { gate: 'undelegated_secondary_exp' },
        ],
        allocated_experiment_name: 'the_allocated_experiment',
        explicit_parameters: ['an_int'],
      };

      await Statsig.initialize('client-key', null, {
        disableDiagnosticsLogging: true,
      });

      const layer = Statsig.getLayer('layer') as unknown as Indexable;
      layer[method]('an_int', 0);
      layer[method]('a_string', '');
      Statsig.shutdown();

      expect(logs['events'].length).toEqual(2);

      expect(logs['events'][0]).toEqual(
        expect.objectContaining({
          metadata: {
            config: 'layer',
            ruleID: 'default',
            allocatedExperiment: 'the_allocated_experiment',
            parameterName: 'an_int',
            isExplicitParameter: 'true',
            reason: EvaluationReason.Network,
            time: expect.any(Number),
          },
          secondaryExposures: [{ gate: 'secondary_exp' }],
        }),
      );

      expect(logs['events'][1]).toEqual(
        expect.objectContaining({
          metadata: {
            config: 'layer',
            ruleID: 'default',
            allocatedExperiment: '',
            parameterName: 'a_string',
            isExplicitParameter: 'false',
            reason: EvaluationReason.Network,
            time: expect.any(Number),
          },
          secondaryExposures: [{ gate: 'undelegated_secondary_exp' }],
        }),
      );
    });

    it('logs different object types correctly', async () => {
      response.layer_configs[sha256Hash('layer')] = {
        value: {
          a_bool: true,
          an_int: 99,
          a_double: 1.23,
          a_long: 1,
          a_string: 'value',
          an_array: ['a', 'b'],
          an_object: { key: 'value' },
        },
      };

      await Statsig.initialize('client-key', null, {
        disableDiagnosticsLogging: true,
      });

      const layer = Statsig.getLayer('layer') as unknown as Indexable;
      layer[method]('a_bool', false);
      layer[method]('an_int', 0);
      layer[method]('a_double', 0.0);
      layer[method]('a_long', 0);
      layer[method]('a_string', '');
      layer[method]('an_array', []);
      layer[method]('an_object', {});
      Statsig.shutdown();

      expect(logs['events'].length).toEqual(7);

      expect(logs['events'][0]['metadata']['parameterName']).toEqual('a_bool');
      expect(logs['events'][1]['metadata']['parameterName']).toEqual('an_int');
      expect(logs['events'][2]['metadata']['parameterName']).toEqual(
        'a_double',
      );
      expect(logs['events'][3]['metadata']['parameterName']).toEqual('a_long');
      expect(logs['events'][4]['metadata']['parameterName']).toEqual(
        'a_string',
      );
      expect(logs['events'][5]['metadata']['parameterName']).toEqual(
        'an_array',
      );
      expect(logs['events'][6]['metadata']['parameterName']).toEqual(
        'an_object',
      );
    });

    it('does not log when shutdown', async () => {
      response.layer_configs[sha256Hash('layer')] = {
        value: {
          a_bool: true,
        },
      };

      await Statsig.initialize('client-key', null, {
        disableDiagnosticsLogging: true,
      });

      const layer = Statsig.getLayer('layer') as unknown as Indexable;
      Statsig.shutdown();

      layer[method]('a_bool', false);

      expect(logs).toEqual({
        events: [],
      });
    });

    it('logs the correct name and user values', async () => {
      response.layer_configs[sha256Hash('layer')] = {
        value: { an_int: 99 },
      };

      await Statsig.initialize(
        'client-key',
        {
          userID: 'dloomb',
          email: 'dan@loomb.io',
        },
        {
          disableDiagnosticsLogging: true,
        },
      );

      const layer = Statsig.getLayer('layer') as unknown as Indexable;
      layer[method]('an_int', 0);
      Statsig.shutdown();

      expect(logs['events'].length).toEqual(1);

      expect(logs['events'][0]).toEqual(
        expect.objectContaining({
          eventName: 'statsig::layer_exposure',
          user: {
            userID: 'dloomb',
            email: 'dan@loomb.io',
          },
        }),
      );
    });
  });
});

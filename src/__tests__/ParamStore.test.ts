import ParamStore from '../ParamStore';
import { ParamType } from '../ParamStore';
import { EvaluationReason } from '../StatsigStore';

describe('Verify behavior of DynamicConfig', () => {
    const checkGate = (gateName: string) => {
        return gateName === 'on_gate';
    }
    const getLayerParam = (layerName: string, paramName: string) => {
        if (layerName !== 'test_layer') {
            return 777;
        }
        if (paramName === 'my_num') {
            return 4;
        }
        if (paramName === 'my_str') {
            return 'layer_str';
        }
        if (paramName === 'my_bool') {
            return true;
        }
    }
  const store = ParamStore._create(
    'my_parameters',
    {
        static_bool: {
            type: ParamType.STATIC,
            value: true,
        },
        static_str: {
            type: ParamType.STATIC,
            value: 'static_string',
        },
        static_num: {
            type: ParamType.STATIC,
            value: 42,
        },
        dynamic_bool_on: {
            type: ParamType.FEATURE_GATE,
            value: 'on_gate',
        },
        dynamic_bool_off: {
            type: ParamType.LAYER_PARAM,
            value: 'test_layer',
            reference: 'not_my_bool'
        },
        dynamic_string: {
            type: ParamType.LAYER_PARAM,
            value: 'test_layer',
            reference: 'my_str'
        },
        dynamic_num: {
            type: ParamType.LAYER_PARAM,
            value: 'test_layer',
            reference: 'my_num'
        },
        dynamic_num_fallback: {
            type: ParamType.LAYER_PARAM,
            value: 'anything_else',
            reference: 'my_num'
        },
    },
    {
        my_parameters: {
            static_bool: true,
            static_str: 'fallback_string',
            static_num: 42,
            dynamic_bool_on: true,
            dynamic_bool_off: false,
            dynamic_string: "fallback_dynamic_string",
            dynamic_num: 999,
        },
        my_other_param_store: {}
    },
    {
        reason: EvaluationReason.Network,
        time: Date.now()
    },
    checkGate,
    getLayerParam,
  );

  beforeEach(() => {
    expect.hasAssertions();
  });

  test('Test happy path', () => {
    expect(store.getBool("static_bool")).toBe(true);
    expect(store.getNumber("static_num")).toBe(42);
    expect(store.getBool("dynamic_bool_on")).toBe(true);
    expect(store.getBool("dynamic_bool_off")).toBe(false);
    expect(store.getString("dynamic_string")).toBe("layer_str");
    expect(store.getNumber("dynamic_num")).toBe(4);
    expect(store.getNumber("dynamic_num_fallback")).toBe(777);
  });

  test('Test fallbacks', () => {
    const fallbackStore = ParamStore._create(
        "my_parameters",
        {},
        {
            static_bool: true,
            static_str: 'fallback_string',
            static_num: 42,
            dynamic_bool_on: true,
            dynamic_bool_off: false,
            dynamic_string: "fallback_dynamic_string",
            dynamic_num: 999,
        },
        {
            reason: EvaluationReason.Uninitialized,
            time: Date.now()
        },
        checkGate,
        getLayerParam,
    );

    expect(fallbackStore.getBool("static_bool")).toBe(true);
    expect(fallbackStore.getString("static_str")).toBe('fallback_string');
    expect(fallbackStore.getNumber("static_num")).toBe(42);
    expect(fallbackStore.getBool("dynamic_bool_on")).toBe(true);
    expect(fallbackStore.getBool("dynamic_bool_off")).toBe(false);
    expect(fallbackStore.getString("dynamic_string")).toBe("fallback_dynamic_string");
    expect(fallbackStore.getNumber("dynamic_num")).toBe(999);
  });
});

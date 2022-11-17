import Statsig from '..';

describe('LocalOverrides', () => {
  beforeEach(() => {
    // @ts-ignore
    Statsig.instance = null;
    Statsig.initialize('client-key', null, {
      localMode: true,
    });
  });

  afterEach(() => {
    Statsig.removeGateOverride('overridden_gate');
    Statsig.removeConfigOverride('overridden_config');
    Statsig.removeLayerOverride('overridden_layer');

    Statsig.shutdown();
  });

  describe('gate overrides', () => {
    it('returns overridden gate values', () => {
      Statsig.overrideGate('overridden_gate', true);
      expect(Statsig.checkGate('overridden_gate')).toBe(true);
    });

    it('clears overridden gate values', () => {
      Statsig.overrideGate('overridden_gate', true);
      Statsig.removeGateOverride('overridden_gate');
      expect(Statsig.checkGate('overridden_gate')).toBe(false);
    });

    it('clears all gate overrides', () => {
      Statsig.overrideGate('overridden_gate', true);
      Statsig.overrideGate('another_overridden_gate', true);
      Statsig.overrideConfig('overridden_config', { key: 'value' });
      Statsig.overrideLayer('overridden_layer', { key: 'value' });
      Statsig.removeGateOverride();

      expect(Statsig.checkGate('overridden_gate')).toBe(false);
      expect(Statsig.checkGate('another_overridden_gate')).toBe(false);
      expect(Statsig.getConfig('overridden_config').value).toEqual({
        key: 'value',
      });
      const layer = Statsig.getLayer('overridden_layer');
      expect(layer.getValue('key', null)).toEqual('value');
    });
  });

  describe('config overrides', () => {
    it('returns overridden config values', () => {
      Statsig.overrideConfig('overridden_config', { key: 'value' });
      expect(Statsig.getConfig('overridden_config').value).toEqual({
        key: 'value',
      });
    });

    it('clears overridden config values', () => {
      Statsig.overrideConfig('overridden_config', { key: 'value' });
      Statsig.removeConfigOverride('overridden_config');
      expect(Statsig.getConfig('overridden_config').value).toEqual({});
    });

    it('clears all config overrides', () => {
      Statsig.overrideGate('overridden_gate', true);
      Statsig.overrideConfig('overridden_config', { key: 'value' });
      Statsig.overrideConfig('another_overridden_config', { key: 'value' });
      Statsig.overrideLayer('overridden_layer', { key: 'value' });
      Statsig.removeConfigOverride();

      expect(Statsig.checkGate('overridden_gate')).toBe(true);
      expect(Statsig.getConfig('overridden_config').value).toEqual({});
      expect(Statsig.getConfig('another_overridden_config').value).toEqual({});
      const layer = Statsig.getLayer('overridden_layer');
      expect(layer.getValue('key', null)).toEqual('value');
    });
  });

  describe('layer overrides', () => {
    it('returns overridden layer values', () => {
      Statsig.overrideLayer('overridden_layer', { key: 'value' });
      const layer = Statsig.getLayer('overridden_layer');
      expect(layer.getValue('key', null)).toEqual('value');
    });

    it('clears overridden config values', () => {
      Statsig.overrideLayer('overridden_layer', { key: 'value' });
      Statsig.removeLayerOverride('overridden_layer');
      const layer = Statsig.getLayer('overridden_layer');
      expect(layer.getValue('key', null)).toBeNull();
    });

    it('clears all layer overrides', () => {
      Statsig.overrideGate('overridden_gate', true);
      Statsig.overrideConfig('overridden_config', { key: 'value' });
      Statsig.overrideLayer('overridden_layer', { key: 'value' });
      Statsig.overrideLayer('another_overridden_layer', { key: 'value' });
      Statsig.removeLayerOverride();

      expect(Statsig.checkGate('overridden_gate')).toBe(true);
      expect(Statsig.getConfig('overridden_config').value).toEqual({
        key: 'value',
      });
      const layer = Statsig.getLayer('overridden_layer');
      expect(layer.getValue('key', null)).toBeNull();

      const another_layer = Statsig.getLayer('overridden_layer');
      expect(another_layer.getValue('key', null)).toBeNull();
    });
  });
});

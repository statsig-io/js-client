import ErrorBoundary from '../ErrorBoundary';
import StatsigSDKOptions from '../StatsigSDKOptions';
import Diagnostics, { DiagnosticsImpl, Marker } from '../utils/Diagnostics';

describe('ErrorBoundaryDiagnostics', () => {
  let boundary: ErrorBoundary;
  let requests: Record<string, unknown>[] = [];
  let markers: Marker[] = [];
  let statsigOption = new StatsigSDKOptions({disableLocalStorage: true})

  let diagnosticsImpl: DiagnosticsImpl;
  function setup(disable: boolean = false) {
    Diagnostics.initialize({
      options: new StatsigSDKOptions({disableDiagnosticsLogging: disable}),
    });
    diagnosticsImpl = (Diagnostics as any).instance;
  }

  describe('marker capture on success', () => {
    beforeAll(() => {
      setup();
      jest.spyOn(Math, 'random').mockReturnValue(0.0000001);

      boundary = new ErrorBoundary('client-key', statsigOption);
      boundary.capture(
        'checkGate',
        () => { },
        () => { },
        { configName: 'the_config_name' },
      );

      markers = diagnosticsImpl.markers.api_call;
    });

    it('captures start', () => {
      const marker = markers[0];
      expect(marker).toMatchObject({
        action: 'start',
        key: 'check_gate',
        markerID: 'checkGate_0',
      });
    });

    it('captures end', () => {
      const marker = markers[1];
      expect(marker).toMatchObject({
        action: 'end',
        key: 'check_gate',
        markerID: 'checkGate_0',
        success: true,
        configName: 'the_config_name',
      });
    });

    it('only captured start and end', () => {
      expect(markers).toHaveLength(2);
    });
  });

  describe('marker capture on failure', () => {
    beforeAll(() => {
      setup();
      jest.spyOn(Math, 'random').mockReturnValue(0.0000001);

      const boundary = new ErrorBoundary('client-key', statsigOption);
      boundary.capture(
        'getConfig',
        () => {
          throw new Error('Bad stuff');
        },
        () => { },
        { configName: 'the_config_name' },
      );

      markers = diagnosticsImpl.getMarkers('api_call');
    });

    it('captures start', () => {
      const marker = markers[0];
      expect(marker).toMatchObject({
        action: 'start',
        key: 'get_config',
        markerID: 'getConfig_0',
      });
    });

    it('captures end', () => {
      const marker = markers[1];
      expect(marker).toMatchObject({
        action: 'end',
        key: 'get_config',
        markerID: 'getConfig_0',
        success: false,
        configName: 'the_config_name',
      });
    });

    it('only captured start and end', () => {
      expect(markers).toHaveLength(2);
    });
  });

  describe('sampling', () => {
    beforeEach(() => {
      setup();
    });
    it('disables markers if not 1/10000', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.1);
      new ErrorBoundary('client-key', statsigOption);
      expect(diagnosticsImpl?.maxMarkers?.api_call).toBe(0);
    });

    it('enables markers if 1/10000', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.0000001);
      new ErrorBoundary('client-key', statsigOption);
      expect(diagnosticsImpl?.maxMarkers?.api_call).toBe(30);
    });
  });

  describe('limiting marker capture', () => {
    beforeAll(() => {
      setup();
      jest.spyOn(Math, 'random').mockReturnValue(0.0000001);

      boundary = new ErrorBoundary('client-key',statsigOption);
      for (let i = 0; i < 100; i++) {
        boundary.capture(
          'checkGate',
          () => { },
          () => { },
        );
      }
    });

    it('limits to 30 markers', () => {
      expect(Diagnostics.getMarkerCount('api_call')).toBe(30);
    });
  });

  describe('Disable diagnostics', () => {
    beforeAll(() => {
      setup(true);
      jest.spyOn(Math, 'random').mockReturnValue(0.0000001);

      boundary = new ErrorBoundary('client-key', statsigOption);
      boundary.capture(
        'checkGate',
        () => { },
        () => { },
        { configName: 'the_config_name' },
      );

      markers = diagnosticsImpl.markers.api_call;
    });
    it('Should not log', () => {
      expect(markers.length).toBe(0)
    }) 
  })

});

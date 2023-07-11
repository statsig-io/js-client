import ErrorBoundary from '../ErrorBoundary';
import StatsigSDKOptions from '../StatsigSDKOptions';
import Diagnostics, { DiagnosticsImpl, Marker } from '../utils/Diagnostics';

describe('ErrorBoundaryDiagnostics', () => {
  let boundary: ErrorBoundary;
  let requests: Record<string, unknown>[] = [];
  let markers: Marker[] = [];

  let diagnosticsImpl: DiagnosticsImpl;
  function setup() {
    Diagnostics.initialize({
      options: new StatsigSDKOptions(),
    });
    // @ts-ignore
    diagnosticsImpl = Diagnostics.instance;
  }

  describe('marker capture on success', () => {
    beforeAll(() => {
      setup();
      jest.spyOn(Math, 'random').mockReturnValue(0.0000001);

      boundary = new ErrorBoundary('client-key');
      boundary.capture(
        'checkGate',
        () => {},
        () => {},
      );

      markers = diagnosticsImpl.markers.error_boundary;
    });

    it('captures start', () => {
      const marker = markers[0];
      expect(marker?.action).toEqual('start');
      expect(marker?.key).toEqual('check_gate');
      expect(marker?.markerID).toEqual('checkGate_0');
    });

    it('captures end', () => {
      const marker = markers[1];
      expect(marker?.action).toEqual('end');
      expect(marker?.key).toEqual('check_gate');
      expect(marker?.markerID).toEqual('checkGate_0');
      expect(marker?.success).toBe(true);
    });

    it('only captured start and end', () => {
      expect(markers).toHaveLength(2);
    });
  });

  describe('marker capture on failure', () => {
    beforeAll(() => {
      setup();
      jest.spyOn(Math, 'random').mockReturnValue(0.0000001);

      const boundary = new ErrorBoundary('client-key');
      boundary.capture(
        'getConfig',
        () => {
          throw new Error('Bad stuff');
        },
        () => {},
      );

      markers = diagnosticsImpl.getMarkers('error_boundary');
    });

    it('captures start', () => {
      const marker = markers[0];
      expect(marker?.action).toEqual('start');
      expect(marker?.key).toEqual('get_config');
      expect(marker?.markerID).toEqual('getConfig_0');
    });

    it('captures end', () => {
      const marker = markers[1];
      expect(marker?.action).toEqual('end');
      expect(marker?.key).toEqual('get_config');
      expect(marker?.markerID).toEqual('getConfig_0');
      expect(marker?.success).toBe(false);
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
      new ErrorBoundary('client-key');
      expect(diagnosticsImpl?.maxMarkers?.error_boundary).toBe(0);
    });

    it('enables markers if 1/10000', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.0000001);
      new ErrorBoundary('client-key');
      expect(diagnosticsImpl?.maxMarkers?.error_boundary).toBe(30);
    });
  });

  describe('limiting marker capture', () => {
    beforeAll(() => {
      setup();
      jest.spyOn(Math, 'random').mockReturnValue(0.0000001);

      boundary = new ErrorBoundary('client-key');
      for (let i = 0; i < 100; i++) {
        boundary.capture(
          'checkGate',
          () => {},
          () => {},
        );
      }
    });

    it('limits to 30 markers', () => {
      expect(Diagnostics.getMarkerCount('error_boundary')).toBe(30);
    });
  });
});

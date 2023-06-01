import ErrorBoundary, { ExceptionEndpoint } from '../ErrorBoundary';
import { DiagnosticsKey, DiagnosticsMarkers } from '../utils/Diagnostics';

describe('ErrorBoundaryDiagnostics', () => {
  let boundary: ErrorBoundary;
  let requests: Record<string, unknown>[] = [];
  let diagnostics: DiagnosticsMarkers | null = null;

  (global as any).fetch = jest.fn((url, params) => {
    requests.push({
      url: url.toString(),
      params:
        params && params.body
          ? {
              body: params.body as string,
              headers: (params.headers as object) ?? undefined,
            }
          : { body: '' },
    });
    return Promise.resolve();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('marker capture on success', () => {
    beforeAll(() => {
      jest.spyOn(Math, 'random').mockReturnValue(0.0000001);

      boundary = new ErrorBoundary('client-key');
      boundary.capture(
        '',
        () => {},
        () => {},
        { diagnosticsKey: DiagnosticsKey.CHECK_GATE },
      );

      diagnostics = boundary.getDiagnostics()?.getMarkers() ?? null;
    });

    it('captures start', () => {
      const marker = diagnostics?.markers[0];
      expect(marker?.action).toEqual('start');
      expect(marker?.key).toEqual('check_gate');
      expect(marker?.step).toEqual('check_gate_0');
    });

    it('captures end', () => {
      const marker = diagnostics?.markers[1];
      expect(marker?.action).toEqual('end');
      expect(marker?.key).toEqual('check_gate');
      expect(marker?.step).toEqual('check_gate_0');
      expect(marker?.value).toBe(true);
    });

    it('only captured start and end', () => {
      expect(diagnostics?.markers).toHaveLength(2);
    });
  });

  describe('marker capture on failure', () => {
    beforeAll(() => {
      jest.spyOn(Math, 'random').mockReturnValue(0.0000001);

      boundary = new ErrorBoundary('client-key');
      boundary.capture(
        '',
        () => {
          throw new Error('Bad stuff');
        },
        () => {},
        { diagnosticsKey: DiagnosticsKey.GET_CONFIG },
      );

      diagnostics = boundary.getDiagnostics()?.getMarkers() ?? null;
    });

    it('captures start', () => {
      const marker = diagnostics?.markers[0];
      expect(marker?.action).toEqual('start');
      expect(marker?.key).toEqual('get_config');
      expect(marker?.step).toEqual('get_config_0');
    });

    it('captures end', () => {
      const marker = diagnostics?.markers[1];
      expect(marker?.action).toEqual('end');
      expect(marker?.key).toEqual('get_config');
      expect(marker?.step).toEqual('get_config_0');
      expect(marker?.value).toBe(false);
    });

    it('only captured start and end', () => {
      expect(diagnostics?.markers).toHaveLength(2);
    });
  });

  describe('sampling', () => {
    it('disables diagnostics if not 1/10000', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.1);
      boundary = new ErrorBoundary('client-key');
      expect(boundary.getDiagnostics()).toBeNull();
    });

    it('enables diagnostics if 1/10000', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.0000001);
      boundary = new ErrorBoundary('client-key');
      expect(boundary.getDiagnostics()).toBeDefined();
    });
  });

  describe('disabling diagnostics', () => {
    beforeAll(() => {
      jest.spyOn(Math, 'random').mockReturnValue(0.0000001);
    });

    it('can disable diagnostics', () => {
      boundary = new ErrorBoundary('client-key', true);
      expect(boundary.getDiagnostics()).toBeNull();
    });

    it('can enable diagnostics', () => {
      boundary = new ErrorBoundary('client-key', false);
      expect(boundary.getDiagnostics()).toBeDefined();
    });
  });

  describe('limiting marker capture', () => {
    beforeAll(() => {
      jest.spyOn(Math, 'random').mockReturnValue(0.0000001);

      boundary = new ErrorBoundary('client-key');
      for (let i = 0; i < 100; i++) {
        boundary.capture(
          '',
          () => {},
          () => {},
          { diagnosticsKey: DiagnosticsKey.CHECK_GATE },
        );
      }

      diagnostics = boundary.getDiagnostics()?.getMarkers() ?? null;
    });

    it('limits to 30 markers', () => {
      expect(diagnostics?.markers).toHaveLength(30);
    });
  });
});

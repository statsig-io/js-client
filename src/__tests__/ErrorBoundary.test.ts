import ErrorBoundary, { ExceptionEndpoint } from '../ErrorBoundary';
import {
  StatsigInvalidArgumentError,
  StatsigUninitializedError,
} from '../Errors';

describe('ErrorBoundary', () => {
  let boundary: ErrorBoundary;
  let request = [{ url: '', params: {} }];

  beforeEach(() => {
    boundary = new ErrorBoundary('client-key');
    request = [];

    // @ts-ignore
    global.fetch = jest.fn((url, params) => {
      request.push({ url: url.toString(), params });
      return Promise.resolve();
    });
  });

  it('recovers from error and returns result', () => {
    let called = false;
    const result = boundary.capture(
      () => {
        throw new URIError();
      },
      () => {
        called = true;
        return 'called';
      },
    );

    expect(called).toBe(true);
    expect(result).toEqual('called');
  });

  it('recovers from error and returns result', async () => {
    const result = await boundary.capture(
      () => Promise.reject(Error('bad')),
      () => Promise.resolve('good'),
    );

    expect(result).toEqual('good');
  });

  it('returns successful results when there is no crash', async () => {
    const result = await boundary.capture(
      () => Promise.resolve('success'),
      () => Promise.resolve('failure'),
    );

    expect(result).toEqual('success');
  });

  it('logs errors correctly', () => {
    const err = new URIError();
    boundary.swallow(() => {
      throw err;
    });

    expect(request[0].url).toEqual(ExceptionEndpoint);

    expect(JSON.parse(request[0].params['body'])).toEqual(
      expect.objectContaining({
        exception: 'URIError',
        info: err.stack,
      }),
    );
  });

  it('logs error-ish correctly', () => {
    const err = { 'sort-of-an-error': 'but-not-really' };
    boundary.swallow(() => {
      throw err;
    });

    expect(request[0].url).toEqual(ExceptionEndpoint);
    expect(JSON.parse(request[0].params['body'])).toEqual(
      expect.objectContaining({
        exception: 'No Name',
        info: JSON.stringify(err),
      }),
    );
  });

  it('logs the correct headers', () => {
    boundary.swallow(() => {
      throw new Error();
    });

    expect(request[0].params['headers']).toEqual(
      expect.objectContaining({
        'STATSIG-API-KEY': 'client-key',
        'Content-Type': 'application/json',
        'Content-Length': expect.any(String),
      }),
    );
  });

  it('logs statsig metadata', () => {
    boundary.setStatsigMetadata({ sdkType: 'js-client' });

    boundary.swallow(() => {
      throw new Error();
    });

    expect(JSON.parse(request[0].params['body'])).toEqual(
      expect.objectContaining({
        statsigMetadata: { sdkType: 'js-client' },
      }),
    );
  });

  it('logs the same error only once', () => {
    boundary.swallow(() => {
      throw new Error();
    });

    expect(request.length).toEqual(1);

    boundary.swallow(() => {
      throw new Error();
    });

    expect(request.length).toEqual(1);
  });

  it('does not catch intended errors', () => {
    expect(() => {
      boundary.swallow(() => {
        throw new StatsigUninitializedError('uninit');
      });
    }).toThrow('uninit');

    expect(() => {
      boundary.swallow(() => {
        throw new StatsigInvalidArgumentError('bad arg');
      });
    }).toThrow('bad arg');
  });
});

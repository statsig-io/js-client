import ErrorBoundary, { ExceptionEndpoint } from '../ErrorBoundary';
import {
  StatsigInvalidArgumentError,
  StatsigUninitializedError,
} from '../Errors';
import StatsigSDKOptions from '../StatsigSDKOptions';
import Diagnostics from '../utils/Diagnostics';

type ErrorBoundaryRequest = {
  url: string;
  params: {
    body: string;
    headers?: object;
  };
};

describe('ErrorBoundary', () => {
  let boundary: ErrorBoundary;
  let request: ErrorBoundaryRequest[] = [
    {
      url: '',
      params: {
        body: '',
      },
    },
  ];

  beforeEach(() => {
    Diagnostics.initialize({
      options: new StatsigSDKOptions(),
    });
    boundary = new ErrorBoundary('client-key');
    request = [];

    // @ts-ignore
    global.fetch = jest.fn((url, params) => {
      request.push({
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
  });

  it('recovers from error and returns result', () => {
    let called = false;
    const result = boundary.capture(
      '',
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
      '',
      () => Promise.reject(Error('bad')),
      () => Promise.resolve('good'),
    );

    expect(result).toEqual('good');
  });

  it('returns successful results when there is no crash', async () => {
    const result = await boundary.capture(
      '',
      () => Promise.resolve('success'),
      () => Promise.resolve('failure'),
    );

    expect(result).toEqual('success');
  });

  it('logs errors correctly', () => {
    const err = new URIError();
    boundary.swallow('', () => {
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
    boundary.swallow('', () => {
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

  it('logs tags correctly', () => {
    boundary.swallow('aCustomTag', () => {
      throw new Error();
    });

    expect(request[0].url).toEqual(ExceptionEndpoint);
    expect(JSON.parse(request[0].params['body'])).toEqual(
      expect.objectContaining({
        tag: 'aCustomTag',
      }),
    );
  });

  it('logs the correct headers', () => {
    boundary.swallow('', () => {
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
    const metadata = { sdkType: 'js-client', sdkVersion: '1.2.3' };
    boundary.setStatsigMetadata(metadata);

    boundary.swallow('', () => {
      throw new Error();
    });

    expect(JSON.parse(request[0].params['body'])).toEqual(
      expect.objectContaining({
        statsigMetadata: metadata,
      }),
    );

    expect(request[0].params['headers']).toEqual(
      expect.objectContaining({
        'STATSIG-SDK-TYPE': 'js-client',
        'STATSIG-SDK-VERSION': '1.2.3',
      }),
    );
  });

  it('logs the same error only once', () => {
    boundary.swallow('', () => {
      throw new Error();
    });

    expect(request.length).toEqual(1);

    boundary.swallow('', () => {
      throw new Error();
    });

    expect(request.length).toEqual(1);
  });

  it('does not catch intended errors', () => {
    expect(() => {
      boundary.swallow('', () => {
        throw new StatsigUninitializedError('uninit');
      });
    }).toThrow('uninit');

    expect(() => {
      boundary.swallow('', () => {
        throw new StatsigInvalidArgumentError('bad arg');
      });
    }).toThrow('bad arg');
  });
});

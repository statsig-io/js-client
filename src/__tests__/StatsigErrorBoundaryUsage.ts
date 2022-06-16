/**
 * @jest-environment jsdom
 */

import DynamicConfig from '../DynamicConfig';
import { ExceptionEndpoint } from '../ErrorBoundary';
import Statsig from '../index';
import Layer from '../Layer';
import StatsigClient from '../StatsigClient';

const oneLoggedError = (errorMessage: string, kind = 'TypeError') => {
  return [
    expect.objectContaining({
      url: ExceptionEndpoint,
      params: expect.objectContaining({
        body:
          expect.stringContaining(`"exception":"${TypeError}"`) &&
          expect.stringContaining(errorMessage),
      }),
    }),
  ];
};

describe('Statsig ErrorBoundary Usage', () => {
  let requests: { url: RequestInfo; params: RequestInit }[] = [];
  let client: StatsigClient;
  let shouldRespondWithBadJson = false;

  beforeEach(async () => {
    shouldRespondWithBadJson = false;

    // @ts-ignore
    global.fetch = jest.fn((url, params) => {
      if ((url + '').includes('/v1/initialize') && shouldRespondWithBadJson) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(JSON.parse('{ <-- Unclosed JSON')),
        });
      }

      requests.push({ url, params });
      // @ts-ignore causes initialize to fail
      Statsig.instance.logger = 1;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    client = new StatsigClient('client-key');
    await client.initializeAsync();

    // @ts-ignore
    client.errorBoundary.seen = new Set();
    requests = [];
    // Causes not a function errors
    // @ts-ignore
    client.store = { isLoaded: () => true };
    // @ts-ignore
    client.logger = 1;
  });

  it('recovers from errors and returns default gate value', async () => {
    const result = client.checkGate('a_gate');
    expect(result).toBe(false);
    expect(requests).toEqual(oneLoggedError('store.checkGate'));
  });

  it('recovers from errors and returns default config value', async () => {
    const result = client.getConfig('a_config');
    expect(result instanceof DynamicConfig).toBe(true);
    expect(requests).toEqual(oneLoggedError('store.getConfig'));
  });

  it('recovers from errors and returns default experiment value', async () => {
    const result = client.getExperiment('an_experiment');
    expect(result instanceof DynamicConfig).toBe(true);
    expect(requests).toEqual(oneLoggedError('store.getExperiment'));
  });

  it('recovers from errors and returns default layer value', async () => {
    const result = client.getLayer('a_layer');
    expect(result instanceof Layer).toBe(true);
    expect(requests).toEqual(oneLoggedError('store.getLayer'));
  });

  it('recovers from errors with logEvent', () => {
    client.logEvent('an_event');
    expect(requests).toEqual(oneLoggedError('logger.log'));
  });

  it('recovers from errors with shutdown', () => {
    client.shutdown();
    expect(requests).toEqual(oneLoggedError('logger.flush'));
  });

  it('recovers from errors with overrideGate', () => {
    client.overrideGate('a_gate', true);
    expect(requests).toEqual(oneLoggedError('store.overrideGate'));
  });

  it('recovers from errors with overrideConfig', () => {
    client.overrideConfig('a_config', {});
    expect(requests).toEqual(oneLoggedError('store.overrideConfig'));
  });

  it('recovers from errors with removeOverride', () => {
    client.removeOverride('something');
    expect(requests).toEqual(oneLoggedError('store.removeGateOverride'));
  });

  it('recovers from errors with removeGateOverride', () => {
    client.removeGateOverride('a_gate');
    expect(requests).toEqual(oneLoggedError('store.removeGateOverride'));
  });

  it('recovers from errors with removeConfigOverride', () => {
    client.removeConfigOverride('a_config');
    expect(requests).toEqual(oneLoggedError('store.removeConfigOverride'));
  });

  it('recovers from errors with getOverrides', () => {
    client.getOverrides();
    expect(requests).toEqual(oneLoggedError('store.getAllOverrides'));
  });

  it('recovers from errors with getAllOverrides', () => {
    client.getAllOverrides();
    expect(requests).toEqual(oneLoggedError('store.getAllOverrides'));
  });

  it('recovers from errors with setInitializeValues', () => {
    // @ts-ignore
    client.ready = false;

    client.setInitializeValues({});
    expect(requests).toEqual(oneLoggedError('store.bootstrap'));
    // @ts-ignore
    expect(client.ready).toBeTruthy();
  });

  it('recovers from errors with getStableID', () => {
    // @ts-ignore
    client.identity = 1;

    client.getStableID();
    expect(requests).toEqual(oneLoggedError('identity.getStatsigMetadata'));
  });

  it('recovers from errors with initialize', async () => {
    const localClient = new StatsigClient('client-key');
    // @ts-ignore
    localClient.network = 1;
    await localClient.initializeAsync();
    expect(requests).toEqual(oneLoggedError('network.fetchValues'));
    // @ts-ignore
    expect(localClient.ready).toBeTruthy();
  });

  it('recovers from errors with updateUser', async () => {
    await client.updateUser({ userID: 'jkw' });
    expect(requests).toEqual(oneLoggedError('store.updateUser'));
  });

  it('captures crashes in response', async () => {
    shouldRespondWithBadJson = true;
    const localClient = new StatsigClient('client-key');
    await localClient.initializeAsync();
    expect(requests).toEqual(
      oneLoggedError('Unexpected token < in JSON at position 2', 'SyntaxError'),
    );
  });
});

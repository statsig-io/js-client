/**
 * @jest-environment jsdom
 */

import Statsig from '..';
import StatsigClient from '../StatsigClient';

const MOCK_METADATA = {
  sessionToken: 'a-session-id',
  sdkType: 'js-client',
  sdkVersion: '4.2.0',
};
const ENCODED_INIT_BODY =
  '9JiMipGZiojIoNXYoJCLlVnc0pjIzFGdsVGRzRHclN2YhJCL9JCMuIjL0IiOi42bpNnclZ1akNnIsICduVWasNWLzpmI6ISZwlHVrR2ciwiIklWLu9WazNXZz1SYiojIuV2avRlbvl2czV2cisnOiEGdhRWY0VWTnl2c0FGdzJCL9JiclNXdtEmI6ICRJJXZzVnI7pjIyV2c1Jye';

const USER = {
  userID: 'a-user',
};

describe('StatsigEncoded', () => {
  let body: BodyInit | string | null = null;
  let headers: HeadersInit | null;
  let client: StatsigClient;
  let url: string;

  // @ts-ignore
  global.fetch = jest.fn((endpoint, params) => {
    if (!endpoint.toString().includes('/v1/initialize')) {
      return;
    }
    body = params?.body ?? null;
    headers = params?.headers ?? null;
    url = endpoint as string;
  });

  beforeEach(() => {
    client = new StatsigClient('client-key', USER, {disableCORSBypass: true});
    client.getStatsigMetadata = () => MOCK_METADATA;
    body = null;
  });

  it('encodes initialize calls when encodeIntializeCall is true', async () => {
    Statsig.encodeIntializeCall = true;

    await client.initializeAsync();
    expect(body).toEqual(ENCODED_INIT_BODY);
    expect(headers).toMatchObject({ 'STATSIG-ENCODED': '1' });
  });

  it('does not encode initialize calls when encodeIntializeCall is false', async () => {
    Statsig.encodeIntializeCall = false;

    await client.initializeAsync();
    expect(body).toEqual(
      JSON.stringify({
        user: USER,
        statsigMetadata: MOCK_METADATA,
        acceptsDeltas: true,
        hash: 'djb2',
      }),
    );
    expect(headers).toMatchObject({ 'STATSIG-ENCODED': '0' });
  });

  it('does not encode bodies with non latin characters', async () => {
    Statsig.encodeIntializeCall = true;
    const local = new StatsigClient('client-key', { userID: '大' }, {disableCORSBypass: true});
    local.getStatsigMetadata = () => MOCK_METADATA;
    await local.initializeAsync();
    expect(body).toEqual(
      JSON.stringify({
        user: { userID: '大' },
        statsigMetadata: MOCK_METADATA,
        acceptsDeltas: true,
        hash: 'djb2',
      }),
    );
    expect(headers).toMatchObject({ 'STATSIG-ENCODED': '0' });
  });

  it('does not encode bodies with non latin characters via se url param', async () => {
    Statsig.encodeIntializeCall = true;
    const local = new StatsigClient('client-key', { userID: '大' });
    local.getStatsigMetadata = () => MOCK_METADATA;
    await local.initializeAsync();
    expect(body).toEqual(
      JSON.stringify({
        user: { userID: '大' },
        statsigMetadata: MOCK_METADATA,
        acceptsDeltas: true,
        hash: 'djb2',
      }),
    );
    expect(headers).toMatchObject({ 'Content-Type': 'text/plain' });

    const fullUrl = new URL(url);
    expect(fullUrl.searchParams.get('se')).toEqual(null);
  });

  it('does encode bodies via se url param', async () => {
    Statsig.encodeIntializeCall = true;
    const local = new StatsigClient('client-key', USER);
    local.getStatsigMetadata = () => MOCK_METADATA;
    await local.initializeAsync();
    expect(body).toEqual(ENCODED_INIT_BODY);
    expect(headers).toMatchObject({ 'Content-Type': 'text/plain' });

    const fullUrl = new URL(url);
    // only set the url param if we are encoding
    expect(fullUrl.searchParams.get('se')).toEqual("1");
  });
});

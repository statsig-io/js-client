/**
 * @jest-environment jsdom
 */

import Statsig from '..';
import StatsigClient from '../StatsigClient';

const MOCK_METADATA = {
  sessionID: 'a-session-id',
  sdkType: 'js-client',
  sdkVersion: '4.2.0',
};
const ENCODED_INIT_BODY =
  '==Qf9JCMuIjL0IiOi42bpNnclZ1akNnIsICduVWasNWLzpmI6ISZwlHVrR2ciwiIklWLu9WazNXZz1SYiojIElkbvl2czV2cisnOiEGdhRWY0VWTnl2c0FGdzJCL9JiclNXdtEmI6ICRJJXZzVnI7pjIyV2c1Jye';

const USER = {
  userID: 'a-user',
};

describe('StatsigEncoded', () => {
  let body: BodyInit | string | null = null;
  let client: StatsigClient;

  // @ts-ignore
  global.fetch = jest.fn((url, params) => {
    if (!url.toString().includes('/v1/initialize')) {
      return;
    }
    body = params?.body ?? null;
  });

  beforeEach(() => {
    client = new StatsigClient('client-key', USER);
    client.getStatsigMetadata = () => MOCK_METADATA;
  });

  it('encodes initialize calls when encodeIntializeCall is true', async () => {
    Statsig.encodeIntializeCall = true;

    await client.initializeAsync();
    expect(body).toEqual(ENCODED_INIT_BODY);
  });

  it('does not encode initialize calls when encodeIntializeCall is false', async () => {
    Statsig.encodeIntializeCall = false;

    await client.initializeAsync();
    expect(body).toEqual(
      JSON.stringify({ user: USER, statsigMetadata: MOCK_METADATA }),
    );
  });
});

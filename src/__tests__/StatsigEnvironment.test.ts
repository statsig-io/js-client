/**
 * @jest-environment jsdom
 */

import Statsig from '..';

describe('StatsigEnvironment', () => {
  let requests: { url: string; body: Record<string, any> }[];

  //@ts-ignore
  global.fetch = jest.fn((url, params) => {
    requests.push({
      url: url.toString(),
      body: JSON.parse(params?.body?.toString() ?? '{}'),
    });

    return Promise.resolve({ ok: true, text: () => Promise.resolve('{}') });
  });

  beforeEach(() => {
    requests = [];
    Statsig.encodeIntializeCall = false;
    (Statsig as any).instance = null;
  });

  it('leaves environment blank for single user initialize calls', async () => {
    await Statsig.initialize('client-key', { userID: 'initial_user' });
    const { url, body } = requests[0];

    expect(requests.length).toBe(1);
    expect(url).toContain('/v1/initialize');
    expect(body.user.statsigEnvironment).toBeUndefined();
    expect(body.user.userID).toEqual('initial_user');
  });

  it('applies environment to single user initialize calls', async () => {
    await Statsig.initialize(
      'client-key',
      { userID: 'initial_user' },
      { environment: { tier: 'development' } },
    );
    const { url, body } = requests[0];

    expect(requests.length).toBe(1);
    expect(url).toContain('/v1/initialize');
    expect(body.user.statsigEnvironment).toEqual({
      tier: 'development',
    });
    expect(body.user.userID).toEqual('initial_user');
  });

  it('applies environment to null user initialize calls', async () => {
    await Statsig.initialize('client-key', null, {
      environment: { tier: 'development' },
    });
    const { url, body } = requests[0];

    expect(requests.length).toBe(1);
    expect(url).toContain('/v1/initialize');
    expect(body.user.statsigEnvironment).toEqual({
      tier: 'development',
    });
    expect(body.user.userID).toBeUndefined();
  });

  it('leaves environment blank for prefetched user initialize calls', async () => {
    await Statsig.initialize('client-key', null, {
      prefetchUsers: [{ userID: 'prefetched_user' }],
    });
    const { url, body } = requests[0];

    expect(requests.length).toBe(1);
    expect(url).toContain('/v1/initialize');

    const prefetchedUser: any = Object.values(body.prefetchUsers)[0];
    expect(prefetchedUser.statsigEnvironment).toBeUndefined;
  });

  it('applies environment to prefetched user initialize calls', async () => {
    await Statsig.initialize('client-key', null, {
      environment: { tier: 'development' },
      prefetchUsers: [{ userID: 'prefetched_user' }],
    });
    const { url, body } = requests[0];

    expect(requests.length).toBe(1);
    expect(url).toContain('/v1/initialize');

    const prefetchedUser: any = Object.values(body.prefetchUsers)[0];
    expect(prefetchedUser.userID).toEqual('prefetched_user');
    expect(prefetchedUser.statsigEnvironment).toEqual({
      tier: 'development',
    });
  });

  describe('After Initialized [With Environment]', () => {
    beforeEach(async () => {
      await Statsig.initialize('client-key', null, {
        environment: { tier: 'development' },
      });
      requests = [];
    });

    it('applies environment to explicit prefetched user calls', async () => {
      await Statsig.prefetchUsers([{ userID: 'explicit_prefetch_user' }]);
      const { url, body } = requests[0];

      expect(requests.length).toBe(1);
      expect(url).toContain('/v1/initialize');

      const prefetchedUser: any = Object.values(body.prefetchUsers)[0];
      expect(prefetchedUser.userID).toEqual('explicit_prefetch_user');
      expect(prefetchedUser.statsigEnvironment).toEqual({
        tier: 'development',
      });
    });

    it('applies environment to updateUser calls', async () => {
      await Statsig.updateUser({ userID: 'updated_user' });
      const { url, body } = requests[0];

      expect(requests.length).toBe(1);
      expect(url).toContain('/v1/initialize');
      expect(body.user.statsigEnvironment).toEqual({
        tier: 'development',
      });
      expect(body.user.userID).toEqual('updated_user');
    });
  });

  describe('After Initialized [Without Environment]', () => {
    beforeEach(async () => {
      await Statsig.initialize('client-key', null);
      requests = [];
    });

    it('leaves environment blank for explicit prefetched user calls', async () => {
      await Statsig.prefetchUsers([{ userID: 'explicit_prefetch_user' }]);
      const { url, body } = requests[0];

      expect(requests.length).toBe(1);
      expect(url).toContain('/v1/initialize');

      const prefetchedUser: any = Object.values(body.prefetchUsers)[0];
      expect(prefetchedUser.statsigEnvironment).toBeUndefined();
    });

    it('leaves environment blank for updateUser calls', async () => {
      await Statsig.updateUser({ userID: 'updated_user' });
      const { url, body } = requests[0];

      expect(requests.length).toBe(1);
      expect(url).toContain('/v1/initialize');
      expect(body.user.statsigEnvironment).toBeUndefined();
      expect(body.user.userID).toEqual('updated_user');
    });
  });
});

/**
 * @jest-environment jsdom
 */
import type { StatsigUser } from '../index';
import Statsig, { StatsigOptions } from '../index';
import * as InitRes from './initialize_response.json';

describe('UpdateUserCompletionCallback', () => {
  let user: StatsigUser;
  let response = Promise.resolve({});

  const completionCallbackSpy = jest.fn();

  beforeEach(async () => {
    user = { userID: 'user-123' };
    response = Promise.resolve({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(InitRes)),
    });

    // @ts-ignore
    global.fetch = jest.fn((url) => {
      if (!url.toString().includes('/initialize')) {
        return;
      }

      return response;
    });

    const opts: StatsigOptions = {
      updateUserCompletionCallback: completionCallbackSpy,
    };
    await Statsig.initialize('client-key', user, opts);
    completionCallbackSpy.mockClear();
  });

  it('fires the callback on a successful update', async () => {
    await Statsig.updateUser(user);

    expect(completionCallbackSpy).toHaveBeenCalledWith(
      expect.any(Number),
      true,
      null,
    );
  });

  it('fires the callback on a failed update', async () => {
    response = Promise.resolve({ ok: false });
    await Statsig.updateUser(user);

    expect(completionCallbackSpy).toHaveBeenCalledWith(
      expect.any(Number),
      false,
      'Failed to update user: TypeError: res.text is not a function',
    );
  });

  it('fires the callback when local mode is enabled', async () => {
    (Statsig as any).instance = null;
    await Statsig.initialize('client-key', user, {
      updateUserCompletionCallback: completionCallbackSpy,
      localMode: true,
    });

    await Statsig.updateUser(user);

    expect(completionCallbackSpy).toHaveBeenCalledWith(
      expect.any(Number),
      true,
      null,
    );
  });

  it('fires the callback when user is cached', async () => {
    (Statsig as any).instance = null;
    await Statsig.initialize('client-key', user, {
      updateUserCompletionCallback: completionCallbackSpy,
      fetchMode: 'cache-or-network',
    });

    await Statsig.updateUser(user);

    expect(completionCallbackSpy).toHaveBeenCalledWith(
      expect.any(Number),
      true,
      null,
    );
  });

  it('fires the callback when an unexpected error occurs', async () => {
    (Statsig as any).instance = null;
    await Statsig.initialize('client-key', user, {
      updateUserCompletionCallback: completionCallbackSpy,
      fetchMode: 'cache-or-network',
    });

    (Statsig as any).instance.identity = 1;
    await Statsig.updateUser(user);

    expect(completionCallbackSpy).toHaveBeenCalledWith(
      expect.any(Number),
      false,
      'Failed to update user. An unexpected error occured.',
    );
  });
});

import type { StatsigUser } from '../index';
import Statsig, { StatsigOptions } from '../index';
import * as InitRes from './initialize_response.json';

describe('GateEvaluationCallback', () => {
  let user: StatsigUser;
  let response = Promise.resolve({});
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

  const gateEvaluationCallbackSpy = jest.fn();

  beforeEach(async () => {
    user = { userID: 'user-123' };
    const opts: StatsigOptions = {
      gateEvaluationCallback: gateEvaluationCallbackSpy,
    };
    await Statsig.initialize('client-key', user, opts);
    gateEvaluationCallbackSpy.mockClear();
  });

  it('fires the callback on checkGate', async () => {
    const value = Statsig.checkGate('test_gate');

    expect(gateEvaluationCallbackSpy).toHaveBeenCalledWith('test_gate', value, {
      withExposureLoggingDisabled: false,
    });
  });

  it('fires the callback on checkGateWithExposureLoggingDisabled', async () => {
    const value = Statsig.checkGateWithExposureLoggingDisabled('test_gate');

    expect(gateEvaluationCallbackSpy).toHaveBeenCalledWith('test_gate', value, {
      withExposureLoggingDisabled: true,
    });
  });
});

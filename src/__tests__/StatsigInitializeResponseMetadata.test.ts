/**
 * @jest-environment jsdom
 */
import { StatsigClient } from '../index';


describe('Test Statsig Initialize Response Metadata', () => {
  test('init response from bootstrap', async () => {
    expect.assertions(3);

    global.fetch = jest.fn((url, params) => {
      return new Promise((resolve, reject) => {
        setTimeout(
          () =>
            // @ts-ignore
            resolve({
              ok: true,
              status: 200,
              text: () => Promise.resolve(JSON.stringify({})),
            }),
          100,
        );
      });
    });

    const client = new StatsigClient("client-");

    const res = client.setInitializeValues({});

    expect(res.initDurationMs).toBeLessThanOrEqual(10);
    expect(res.message).toBeNull();
    expect(res.success).toEqual(true);
  });
});

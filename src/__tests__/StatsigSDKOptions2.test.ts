/**
 * @jest-environment jsdom
 */
import Statsig from '../index';
 
describe('Test Statsig Options 2', () => {
  test('init completion callback when the callback throws an error', async () => {
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
    await expect(
      Statsig.initialize(
        'client-key',
        { userID: 'jkw' },
        {
          initCompletionCallback: (_time, _success, _message) => {
            throw new Error('user error');
          },
        },
      ),
    ).rejects.toThrow();
  });
});

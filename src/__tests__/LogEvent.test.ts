/**
 * @jest-environment jsdom
 */

import LogEvent from '../LogEvent';

describe('Verify log event is constructed correctly', () => {
  test('user private attributes are removed in log event and original user is unchanged.', () => {
    expect.assertions(2);
    const user = {
      userID: 123,
      privateAttributes: { secret: 'Statsig is awesome!' },
    };
    const event = new LogEvent('my_event');
    event.setUser(user);
    expect(event.toJsonObject().user.privateAttributes).toBeUndefined();
    expect(user.privateAttributes.secret).toEqual('Statsig is awesome!');
  });
});

/**
 * @jest-environment jsdom
 */

import LogEvent from '../LogEvent';

describe('Verify log event is constructed correctly', () => {
  test('user private attributes are removed in log event and original user is unchanged.', () => {
    expect.assertions(3);
    const user = {
      userID: 123,
      privateAttributes: { secret: 'Statsig is awesome!' },
    };
    const event = new LogEvent('my_event');
    event.setUser(user);
    event.setSecondaryExposures([
      {
        gate: 'dependent_gate_1',
        gateValue: 'true',
        ruleID: 'rule_1',
      },
      {
        gate: 'dependent_gate_2',
        gateValue: 'false',
        ruleID: 'rule_2',
      },
    ]);
    const asJson = event.toJsonObject();
    const eventUser = asJson.user as Record<string, unknown>;
    expect(eventUser.privateAttributes).toBeUndefined();
    expect(user.privateAttributes.secret).toEqual('Statsig is awesome!');
    expect(asJson.secondaryExposures).toEqual([
      {
        gate: 'dependent_gate_1',
        gateValue: 'true',
        ruleID: 'rule_1',
      },
      {
        gate: 'dependent_gate_2',
        gateValue: 'false',
        ruleID: 'rule_2',
      },
    ]);
  });
});

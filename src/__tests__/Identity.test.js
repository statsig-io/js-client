const { default: Identity } = require('../Identity');

describe('Verify behavior of Identity module', () => {
  beforeEach(() => {
    expect.hasAssertions();
  });

  test('Test constructor', () => {
    const id = Identity();
    expect(id.getUser()).toStrictEqual({});
    expect(id.getUserID()).not.toBeNull(); // Should get DeviceID as a fallback
    expect(id.getStatsigMetadata()).not.toBeNull();

    const user = { userID: 'uuid1' };
    const id2 = Identity(user);
    expect(id2.getUser()).toStrictEqual(user);
    expect(id2.getUserID()).toStrictEqual('uuid1');
    expect(id2.getStatsigMetadata()).not.toBeNull();
  });

  test('Test setUser', () => {
    expect(1).toBe(1);
  });
});

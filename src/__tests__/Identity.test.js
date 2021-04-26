import Identity from '../Identity';

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
    const id = Identity({ userID: 'test_user' });
    expect(id.getUser()).toStrictEqual({ userID: 'test_user' });
    const previousSessionID = id.getStatsigMetadata().sessionID;
    id.setUser(null);
    expect(id.getStatsigMetadata().sessionID).not.toStrictEqual(
      previousSessionID,
    );
    expect(id.getUser()).toStrictEqual({});
    id.setUser({ userID: 'test_user2' });
    expect(id.getUser()).toStrictEqual({ userID: 'test_user2' });
    id.setUser({ userID: 'test_user2', locale: 'en_US' });
    expect(id.getUser()).toStrictEqual({
      userID: 'test_user2',
      locale: 'en_US',
    });
  });
});

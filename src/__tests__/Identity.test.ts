import StatsigIdentity from '../StatsigIdentity';

describe('Verify behavior of Identity module', () => {
  beforeEach(() => {
    expect.hasAssertions();
  });

  test('Test constructor', () => {
    const id = new StatsigIdentity(null);
    expect(id.getUser()).toStrictEqual(null);
    expect(id.getStatsigMetadata()).not.toBeNull();

    const user = { userID: 'uuid1' };
    id.updateUser(user);
    expect(id.getUser()).toStrictEqual(user);
  });

  test('Test setUser', () => {
    const id = new StatsigIdentity({ userID: 'test_user' });
    expect(id.getUser()).toStrictEqual({ userID: 'test_user' });
    const previousSessionID = id.getStatsigMetadata().sessionIDX;
    id.updateUser(null);
    expect(id.getStatsigMetadata().sessionIDX).toStrictEqual(previousSessionID);
    expect(id.getUser()).toStrictEqual(null);
    id.updateUser({ userID: 'test_user2' });
    expect(id.getUser()).toStrictEqual({ userID: 'test_user2' });
    id.updateUser({ userID: 'test_user2', locale: 'en_US' });
    expect(id.getUser()).toStrictEqual({
      userID: 'test_user2',
      locale: 'en_US',
    });
  });

  test('React Native StatsigMetadata', () => {
    const id = new StatsigIdentity({});
    id.setSDKPackageInfo({
      sdkType: 'react-native-client',
      sdkVersion: '3.0.0',
    });

    const info = {
      getVersion(): string | null {
        return '1.0.1';
      },
      getSystemVersion(): string | null {
        return '4.0.3';
      },
      getSystemName(): string | null {
        return 'Android';
      },
      getModel(): string | null {
        return 'Pixel 2';
      },
      getDeviceId(): string | null {
        return 'goldfish';
      },
    };
    id.setRNDeviceInfo(info);
    const metadata = id.getStatsigMetadata();
    expect(metadata.sdkType).toEqual('react-native-client');
    expect(metadata.sdkVersion).toEqual('3.0.0');
    expect(metadata.appVersion).toEqual('1.0.1');
    expect(metadata.systemVersion).toEqual('4.0.3');
    expect(metadata.systemName).toEqual('Android');
    expect(metadata.deviceModelName).toEqual('Pixel 2');
    expect(metadata.deviceModel).toEqual('goldfish');
  });

  test('React Native Expo StatsigMetadata', () => {
    const id = new StatsigIdentity(null);
    id.setExpoConstants({
      nativeAppVersion: null,
      nativeBuildVersion: '1.0.1',
    });

    id.setExpoDevice({
      osVersion: '12.3.1',
      osName: 'iOS',
      modelName: 'iPhone XS',
      modelId: 'iPhone7,2',
    });
    const metadata = id.getStatsigMetadata();
    expect(metadata.appVersion).toEqual('1.0.1');
    expect(metadata.systemVersion).toEqual('12.3.1');
    expect(metadata.systemName).toEqual('iOS');
    expect(metadata.deviceModelName).toEqual('iPhone XS');
    expect(metadata.deviceModel).toEqual('iPhone7,2');
  });

  test('Test React Native UUID', () => {
    const RNUUID = {
      v4(): string | number[] {
        return 'uuid_123';
      },
    };
    const id = new StatsigIdentity({ userID: 'test_user' }, null, RNUUID);
    expect(id.getStatsigMetadata().sessionIDX).toEqual('uuid_123');
  });
});

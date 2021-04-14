import * as utils from './utils/core';

export default function Identity(
  initialUser,
  // For react native SDKs only:
  NativeModules = null,
  Platform = null,
  RNDeviceInfo = null,
  ExpoConstants = null,
  ExpoDevice = null,
) {
  const identity = {};
  let user = {};
  let statsigMetadata = {
    sessionID: utils.generateID(),
    sdkType: utils.getSDKType(),
    sdkVersion: utils.getSDKVersion(),
  };

  if (Platform != null && NativeModules != null) {
    // e.g. en_US
    if (Platform.OS?.toLocaleLowerCase() === 'android') {
      statsigMetadata.locale = NativeModules?.I18nManager?.localeIdentifier;
    } else if (Platform.OS?.toLocaleLowerCase() === 'ios') {
      statsigMetadata.locale =
        NativeModules?.SettingsManager?.settings?.AppleLocale ||
        NativeModules?.SettingsManager?.settings?.AppleLanguages[0];
    }
  }

  if (RNDeviceInfo != null) {
    statsigMetadata.appVersion = RNDeviceInfo.getVersion() ?? ''; // e.g. 1.0.1
    statsigMetadata.systemVersion = RNDeviceInfo.getSystemVersion() ?? ''; // Android: "4.0.3"; iOS: "12.3.1"
    statsigMetadata.systemName = RNDeviceInfo.getSystemName() ?? ''; // e.g. Android, iOS, iPadOS
    statsigMetadata.deviceModelName = RNDeviceInfo.getModel() ?? ''; // e.g. Pixel 2, iPhone XS
    statsigMetadata.deviceModel = RNDeviceInfo.getDeviceId() ?? ''; // e.g. iPhone7,2
  } else {
    if (ExpoConstants != null) {
      statsigMetadata.appVersion =
        ExpoConstants.nativeAppVersion ??
        ExpoConstants.nativeBuildVersion ??
        ''; // e.g. 1.0.1
    }
    if (ExpoDevice != null) {
      statsigMetadata.systemVersion = ExpoDevice.osVersion ?? ''; // Android: "4.0.3"; iOS: "12.3.1"
      statsigMetadata.systemName = ExpoDevice.osName ?? ''; // e.g. Android, iOS, iPadOS
      statsigMetadata.deviceModelName = ExpoDevice.modelName ?? ''; // e.g. Pixel 2, iPhone XS
      statsigMetadata.deviceModel = ExpoDevice.modelId ?? ''; // e.g. iPhone7,2
    }
  }

  identity.setStableIDAsync = function () {
    return utils
      .getStableIDAsync()
      .then((data) => {
        statsigMetadata.stableID = data;
        return Promise.resolve();
      })
      .catch(() => {
        return Promise.resolve();
      });
  };

  identity.setUser = function (newUser) {
    user = utils.clone(newUser);
    if (user == null) {
      user = {};
    }
    statsigMetadata.sessionID = utils.generateID();
    return true;
  };

  identity.getUser = function () {
    return utils.clone(user);
  };

  identity.getStatsigMetadata = function () {
    return statsigMetadata ? utils.clone(statsigMetadata) : {};
  };

  identity.getUserID = function () {
    return user.userID ?? statsigMetadata.stableID;
  };

  if (initialUser != null) {
    user = utils.clone(initialUser);
  }

  return identity;
}

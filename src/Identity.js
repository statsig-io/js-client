import * as utils from './utils/core';

export default function Identity(
  initialUser,
  Constants = null,
  Device = null,
  Localization = null,
) {
  const identity = {};
  let user = {};
  let statsigMetadata = {
    sessionID: utils.generateID(),
    sdkType: utils.getSDKType(),
    sdkVersion: utils.getSDKVersion(),
  };

  if (Constants != null) {
    statsigMetadata.appVersion =
      Constants.nativeAppVersion ?? Constants.nativeBuildVersion ?? ''; // e.g. 1.0.1
  }

  if (Device != null) {
    statsigMetadata.manufacturer = Device.manufacturer ?? ''; // e.g. google, xiaomi, Apple
    statsigMetadata.systemVersion = Device.osVersion ?? ''; // Android: "4.0.3"; iOS: "12.3.1"
    statsigMetadata.systemName = Device.osName ?? ''; // e.g. Android, iOS, iPadOS
    statsigMetadata.deviceModelName = Device.modelName ?? ''; // e.g. Pixel 2, iPhone XS
    // iOS only
    statsigMetadata.deviceModel = Device.modelId ?? ''; // e.g. iPhone7,2
  }

  if (Localization != null) {
    statsigMetadata.locale = Localization.locale ?? ''; // e.g. en-US
    statsigMetadata.region = Localization.region ?? ''; // e.g. US
    statsigMetadata.timezone = Localization.timezone ?? ''; // e.g. America/Los_Angeles
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

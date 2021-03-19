import * as utils from './utils/core';

export default function Identity(initialUser) {
  const identity = {};
  let user = {};
  let statsigMetadata = {
    deviceID: utils.getDeviceID(),
    sessionID: utils.getSessionID(),
    sdkType: utils.getSDKType(),
    sdkVersion: utils.getSDKVersion(),
  };

  identity.setUser = function (newUser) {
    if (newUser == null || newUser?.userID === user?.userID) {
      return false;
    }
    user = utils.clone(newUser);
    statsigMetadata.sessionID = utils.getSessionID(true);
    return true;
  };

  identity.getUser = function () {
    return utils.clone(user);
  };

  identity.getStatsigMetadata = function () {
    return statsigMetadata ? utils.clone(statsigMetadata) : {};
  };

  identity.getUserID = function () {
    return user.userID ?? statsigMetadata.deviceID;
  };

  if (initialUser != null) {
    user = utils.clone(initialUser);
  }

  return identity;
}

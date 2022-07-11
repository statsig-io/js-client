import { v4 as uuidv4 } from 'uuid';

import { _SDKPackageInfo } from './StatsigClient';
import { StatsigUser } from './StatsigUser';
import { STATSIG_STABLE_ID_KEY } from './utils/Constants';
import StatsigAsyncStorage from './utils/StatsigAsyncStorage';
import StatsigLocalStorage from './utils/StatsigLocalStorage';

export type DeviceInfo = {
  getVersion(): string | null;
  getSystemVersion(): string | null;
  getSystemName(): string | null;
  getModel(): string | null;
  getDeviceId(): string | null;
};

export type ExpoConstants = {
  nativeAppVersion: string | null;
  nativeBuildVersion: string | null;
};

export type ExpoDevice = {
  osVersion: string | null;
  osName: string | null;
  modelName: string | null;
  modelId: string | null;
};

export type NativeModules = {
  I18nManager?: {
    localeIdentifier: string;
  } | null;
  SettingsManager?: {
    settings: {
      AppleLocale: string | null;
      AppleLanguages: string[];
    } | null;
  } | null;
};

export type Platform = {
  OS?: {
    toLocaleLowerCase: () => string;
  } | null;
};

export type UUID = {
  v4(): string | number[];
};

type StatsigMetadata = {
  sessionID: string;
  sdkType: string;
  sdkVersion: string;
  stableID?: string;
  locale?: string;
  appVersion?: string;
  systemVersion?: string;
  systemName?: string;
  deviceModelName?: string;
  deviceModel?: string;
};

export default class Identity {
  private user: StatsigUser | null;
  private statsigMetadata: StatsigMetadata;
  private platform: Platform | null = null;
  private nativeModules: NativeModules | null = null;
  private reactNativeUUID?: UUID;
  private sdkType: string = 'js-client';
  private sdkVersion: string;

  public constructor(
    user: StatsigUser | null,
    overrideStableID?: string | null,
    reactNativeUUID?: UUID,
  ) {
    this.reactNativeUUID = reactNativeUUID;
    this.user = user;
    this.sdkVersion = require('../package.json')?.version ?? '';
    this.statsigMetadata = {
      sessionID: this.getUUID(),
      sdkType: this.sdkType,
      sdkVersion: this.sdkVersion,
    };

    let stableID = overrideStableID;
    if (!StatsigAsyncStorage.asyncStorage) {
      stableID =
        stableID ??
        StatsigLocalStorage.getItem(STATSIG_STABLE_ID_KEY) ??
        this.getUUID();
      StatsigLocalStorage.setItem(STATSIG_STABLE_ID_KEY, stableID);
    }
    if (stableID) {
      this.statsigMetadata.stableID = stableID;
    }
  }

  public async initAsync(): Promise<Identity> {
    let stableID: string | null | undefined = this.statsigMetadata.stableID;
    if (!stableID) {
      stableID = await StatsigAsyncStorage.getItemAsync(STATSIG_STABLE_ID_KEY);
      stableID = stableID ?? this.getUUID();
    }
    StatsigAsyncStorage.setItemAsync(STATSIG_STABLE_ID_KEY, stableID);
    this.statsigMetadata.stableID = stableID;
    return this;
  }

  public getSDKType(): string {
    return this.sdkType;
  }

  public getSDKVersion(): string {
    return this.sdkVersion;
  }

  public getStatsigMetadata(): Record<string, string> {
    this.statsigMetadata.sdkType = this.sdkType;
    this.statsigMetadata.sdkVersion = this.sdkVersion;
    return this.statsigMetadata;
  }

  public getUser(): StatsigUser | null {
    return this.user;
  }

  public updateUser(user: StatsigUser | null): void {
    this.user = user;
    this.statsigMetadata.sessionID = this.getUUID();
  }

  public setSDKPackageInfo(SDKPackageInfo: _SDKPackageInfo): void {
    this.sdkType = SDKPackageInfo.sdkType;
    this.sdkVersion = SDKPackageInfo.sdkVersion;
  }

  public setPlatform(platform: Platform): void {
    this.platform = platform;
    this.updateMetadataFromNativeModules();
  }

  public setNativeModules(nativeModules: NativeModules): void {
    this.nativeModules = nativeModules;
    this.updateMetadataFromNativeModules();
  }

  private updateMetadataFromNativeModules(): void {
    if (this.platform == null || this.nativeModules == null) {
      return;
    }

    if (this.platform.OS?.toLocaleLowerCase() === 'android') {
      this.statsigMetadata.locale =
        this.nativeModules.I18nManager?.localeIdentifier;
    } else if (this.platform.OS?.toLocaleLowerCase() === 'ios') {
      this.statsigMetadata.locale =
        this.nativeModules.SettingsManager?.settings?.AppleLocale ||
        this.nativeModules.SettingsManager?.settings?.AppleLanguages[0];
    }
  }

  private getUUID(): string {
    return (this.reactNativeUUID?.v4() as string) ?? uuidv4();
  }

  public setRNDeviceInfo(deviceInfo: DeviceInfo): void {
    this.statsigMetadata.appVersion = deviceInfo.getVersion() ?? ''; // e.g. 1.0.1
    this.statsigMetadata.systemVersion = deviceInfo.getSystemVersion() ?? ''; // Android: "4.0.3"; iOS: "12.3.1"
    this.statsigMetadata.systemName = deviceInfo.getSystemName() ?? ''; // e.g. Android, iOS, iPadOS
    this.statsigMetadata.deviceModelName = deviceInfo.getModel() ?? ''; // e.g. Pixel 2, iPhone XS
    this.statsigMetadata.deviceModel = deviceInfo.getDeviceId() ?? ''; // e.g. iPhone7,2
  }

  public setExpoConstants(expoConstants: ExpoConstants): void {
    this.statsigMetadata.appVersion =
      expoConstants.nativeAppVersion ?? expoConstants.nativeBuildVersion ?? ''; // e.g. 1.0.1
  }

  public setExpoDevice(expoDevice: ExpoDevice): void {
    this.statsigMetadata.systemVersion = expoDevice.osVersion ?? ''; // Android: "4.0.3"; iOS: "12.3.1"
    this.statsigMetadata.systemName = expoDevice.osName ?? ''; // e.g. Android, iOS, iPadOS
    this.statsigMetadata.deviceModelName = expoDevice.modelName ?? ''; // e.g. Pixel 2, iPhone XS
    this.statsigMetadata.deviceModel = expoDevice.modelId ?? ''; // e.g. iPhone7,2
  }
}

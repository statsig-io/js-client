import { v4 as uuidv4 } from 'uuid';
import { _SDKPackageInfo } from './StatsigClient';
import { StatsigUser } from './StatsigUser';
import StatsigAsyncStorage from './utils/StatsigAsyncLocalStorage';
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

type StatsigMetadata = {
  sessionID: string;
  sdkType: string;
  sdkVersion: string;
  stableID: string;
  locale?: string;
  appVersion?: string;
  systemVersion?: string;
  systemName?: string;
  deviceModelName?: string;
  deviceModel?: string;
};

const STATSIG_STABLE_ID_KEY = 'STATSIG_LOCAL_STORAGE_STABLE_ID';

export default class Identity {
  private user: StatsigUser | null;
  private statsigMetadata: StatsigMetadata;
  private platform: Platform | null = null;
  private nativeModules: NativeModules | null = null;

  public constructor() {
    this.user = null;
    this.statsigMetadata = {
      sessionID: uuidv4(),
      sdkType: 'js-client',
      sdkVersion: require('../package.json')?.version ?? '',
      stableID: '',
    };
  }

  public async initAsync(): Promise<Identity> {
    if (StatsigAsyncStorage.asyncStorage) {
      let stableID = await StatsigAsyncStorage.getItemAsync(STATSIG_STABLE_ID_KEY);
      if (stableID === null) {
        stableID = uuidv4();
        StatsigAsyncStorage.setItemAsync(STATSIG_STABLE_ID_KEY, stableID);
      }
      this.statsigMetadata.stableID = stableID
    }
    return this;
  }

  public init(): string {
    let stableID = StatsigLocalStorage.getItem(STATSIG_STABLE_ID_KEY);
    if (stableID == null) {
      stableID = uuidv4();
      StatsigLocalStorage.setItem(STATSIG_STABLE_ID_KEY, stableID);
    }
    this.statsigMetadata.stableID = stableID
    return stableID;
  }

  public getStatsigMetadata(): Record<string, string> {
    return this.statsigMetadata;
  }

  public getUser(): StatsigUser | null {
    return this.user;
  }

  public setUser(user: StatsigUser | null): void {
    this.user = user;
  }

  public updateUser(user: StatsigUser | null): void {
    this.user = user;
    this.statsigMetadata.sessionID = uuidv4();
  }

  public setSDKPackageInfo(SDKPackageInfo: _SDKPackageInfo): void {
    this.statsigMetadata.sdkType = SDKPackageInfo.sdkType;
    this.statsigMetadata.sdkVersion = SDKPackageInfo.sdkVersion;
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

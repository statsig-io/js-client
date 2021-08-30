export type AsyncStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export default class StatsigAsyncStorage {
  public static asyncStorage: AsyncStorage;
  public static getItemAsync(key: string): Promise<string | null> {
    if (StatsigAsyncStorage.asyncStorage) {
      return StatsigAsyncStorage.asyncStorage.getItem(key) ?? null;
    }
    return Promise.resolve(null);
  }

  public static setItemAsync(key: string, value: string): Promise<void> {
    if (StatsigAsyncStorage.asyncStorage) {
      return StatsigAsyncStorage.asyncStorage.setItem(key, value);
    }
    return Promise.resolve();
  }

  public static removeItemAsync(key: string): Promise<void> {
    if (StatsigAsyncStorage.asyncStorage) {
      return StatsigAsyncStorage.asyncStorage.removeItem(key);
    }
    return Promise.resolve();
  }
}

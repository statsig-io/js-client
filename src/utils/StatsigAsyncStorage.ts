export type AsyncStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export default class StatsigAsyncStorage {
  public static asyncStorage: AsyncStorage;
  public static async getItemAsync(key: string): Promise<string | null> {
    if (StatsigAsyncStorage.asyncStorage) {
      const result = await StatsigAsyncStorage.asyncStorage.getItem(key);
      return result ?? null;
    }
    return Promise.resolve(null);
  }

  public static async setItemAsync(key: string, value: string): Promise<void> {
    if (StatsigAsyncStorage.asyncStorage) {
      return StatsigAsyncStorage.asyncStorage.setItem(key, value);
    }
    return Promise.resolve();
  }

  public static async removeItemAsync(key: string): Promise<void> {
    if (StatsigAsyncStorage.asyncStorage) {
      return StatsigAsyncStorage.asyncStorage.removeItem(key);
    }
    return Promise.resolve();
  }
}

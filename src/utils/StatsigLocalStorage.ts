export default class StatsigLocalStorage {
  private static fallbackSessionCache: Record<string, string> = {};
  public static getItem(key: string): string | null {
    if (
      typeof Storage !== 'undefined' &&
      typeof window !== 'undefined' &&
      window != null &&
      window.localStorage != null
    ) {
      return window.localStorage.getItem(key);
    } else {
      return this.fallbackSessionCache[key];
    }
  }

  public static setItem(key: string, value: string): void {
    if (
      typeof Storage !== 'undefined' &&
      typeof window !== 'undefined' &&
      window != null &&
      window.localStorage != null
    ) {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {}
    } else {
      this.fallbackSessionCache[key] = value;
    }
  }

  public static removeItem(key: string): void {
    if (
      typeof Storage !== 'undefined' &&
      typeof window !== 'undefined' &&
      window != null &&
      window.localStorage != null
    ) {
      window.localStorage.removeItem(key);
    } else {
      delete this.fallbackSessionCache[key];
    }
  }
}

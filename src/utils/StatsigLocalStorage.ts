import { LOCAL_STORAGE_KEYS } from './Constants';

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

  public static cleanup(): void {
    if (
      typeof Storage !== 'undefined' &&
      typeof window !== 'undefined' &&
      window != null &&
      window.localStorage != null
    ) {
      try {
        for (var key in window.localStorage) {
          if (typeof window.localStorage[key] !== 'string') {
            continue;
          }
          if (key == null || key in LOCAL_STORAGE_KEYS) {
            continue;
          }
          if (key.substring(0, 21) !== 'STATSIG_LOCAL_STORAGE') {
            continue;
          }
          window.localStorage.removeItem(key);
        }
      } catch (e) {}
    }
  }
}

import { LOCAL_STORAGE_KEYS } from './Constants';

export default class StatsigLocalStorage {
  public static disabled: boolean = false;
  private static fallbackSessionCache: Record<string, string> = {};
  public static getItem(key: string): string | null {
    if (!this.disabled) {
      try {
        if (
          typeof Storage !== 'undefined' &&
          typeof window !== 'undefined' &&
          window != null &&
          window.localStorage != null
        ) {
          return window.localStorage.getItem(key);
        }
      } catch (e) {}
    }

    return this.fallbackSessionCache[key] ?? null;
  }

  public static setItem(key: string, value: string): void {
    if (!this.disabled) {
      try {
        if (
          typeof Storage !== 'undefined' &&
          typeof window !== 'undefined' &&
          window != null &&
          window.localStorage != null
        ) {
          window.localStorage.setItem(key, value);
          return;
        }
      } catch (e) {}
    }

    this.fallbackSessionCache[key] = value;
  }

  public static removeItem(key: string): void {
    if (!this.disabled) {
      try {
        if (
          typeof Storage !== 'undefined' &&
          typeof window !== 'undefined' &&
          window != null &&
          window.localStorage != null
        ) {
          window.localStorage.removeItem(key);
          return;
        }
      } catch (e) {}
    }

    delete this.fallbackSessionCache[key];
  }

  public static cleanup(): void {
    try {
      if (
        typeof Storage !== 'undefined' &&
        typeof window !== 'undefined' &&
        window != null &&
        window.localStorage != null
      ) {
        for (var key in window.localStorage) {
          if (typeof window.localStorage[key] !== 'string') {
            continue;
          }
          if (key == null) {
            continue;
          }
          // if local storage is disabled on a subsequent session on this device,
          // lets delete everything we already have stored in local storage
          if (!this.disabled && key in LOCAL_STORAGE_KEYS) {
            continue;
          }
          if (
            !this.disabled &&
            key.substring(0, 21) !== 'STATSIG_LOCAL_STORAGE'
          ) {
            continue;
          }
          window.localStorage.removeItem(key);
        }
      }
    } catch (e) {}
  }
}

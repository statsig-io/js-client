import { LOCAL_STORAGE_KEYS, STORAGE_PREFIX } from './Constants';

export default class StatsigLocalStorage {
  public static disabled = false;
  private static fallbackSessionCache: Record<string, string> = {};
  public static getItem(key: string): string | null {
    try {
      if (this.isStorageAccessible()) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      // noop
    }

    return this.fallbackSessionCache[key] ?? null;
  }

  public static setItem(key: string, value: string): void {
    try {
      if (this.isStorageAccessible()) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      // noop
    }
    this.fallbackSessionCache[key] = value;
  }

  public static removeItem(key: string): void {
    try {
      if (this.isStorageAccessible()) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      // noop
    }

    delete this.fallbackSessionCache[key];
  }

  public static cleanup(): void {
    try {
      if (
        this.isStorageAccessible(true) // clean up all storage keys if this session sets disabled
      ) {
        for (const key in window.localStorage) {
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
            key.substring(0, STORAGE_PREFIX.length) !== STORAGE_PREFIX
          ) {
            continue;
          }
          window.localStorage.removeItem(key);
        }
      }
    } catch (e) {
      // noop
    }
  }

  private static canAccessStorageAccessible: boolean | null = null;
  private static isStorageAccessible(ignoreDisabledOption = false): boolean {
    if (this.canAccessStorageAccessible == null) {
      this.canAccessStorageAccessible =
        typeof Storage !== 'undefined' &&
        typeof window !== 'undefined' &&
        window != null &&
        window.localStorage != null;
    }

    const canAccess = this.canAccessStorageAccessible;

    if (ignoreDisabledOption) {
      return canAccess;
    }
    return !this.disabled && canAccess;
  }
}

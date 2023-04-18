import { INTERNAL_STORE_KEY } from "../utils/Constants";

export default class LocalStorageThrowingMock {
  constructor() {}

  clear(): void {
    for (var key in this) {
      if (key in ['getItem', 'setItem', 'removeItem']) {
        continue;
      }
      this.removeItem(key);
    }
  }

  getItem(key: string): string | null {
    // @ts-ignore
    return this[key] ? String(this[key]) : null;
  }

  setItem(key: string, value: string): void {
    if (key === INTERNAL_STORE_KEY) {
      throw new Error("localStorage is full");
    }
    // @ts-ignore
    this[key] = String(value);
  }

  removeItem(key: string): void {
    // @ts-ignore
    delete this[key];
  }
}

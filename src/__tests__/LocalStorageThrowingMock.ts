import { INTERNAL_STORE_KEY } from "../utils/Constants";

export default class LocalStorageThrowingMock {
  constructor() {}

  clear(): void {
    for (var key in this) {
      if (key in ['getItem', 'setItem', 'removeItem', 'clear']) {
        continue;
      }
      this.removeItem(key);
    }
  }

  getItem(key: string): string | null {
    // @ts-ignore
    console.log("getItem", key, this[key]);
    // @ts-ignore
    return this[key] ? String(this[key]) : null;
  }

  setItem(key: string, value: string): void {
    console.log("setItem", key);
    if (key === INTERNAL_STORE_KEY) {
      console.log("localStorage is full");
      throw new Error("localStorage is full");
    } else {
      console.log("no match", key);
    }
    // @ts-ignore
    this[key] = String(value);
  }

  removeItem(key: string): void {
    
    if (key in ['getItem', 'setItem', 'removeItem', 'clear']) {
      return;
    }
    console.log("removeItem", key);
    // @ts-ignore
    delete this[key];
  }
}

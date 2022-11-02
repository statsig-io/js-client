export default class LocalStorageMock {
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
    // @ts-ignore
    this[key] = String(value);
  }

  removeItem(key: string): void {
    // @ts-ignore
    delete this[key];
  }
}

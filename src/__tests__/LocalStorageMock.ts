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
    return this[key] || null;
  }

  setItem(key: string, value: string): void {
    this[key] = String(value);
  }

  removeItem(key: string): void {
    delete this[key];
  }
}

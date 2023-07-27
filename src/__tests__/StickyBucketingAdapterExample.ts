import { StickyBucketingStorageAdapter } from "../StatsigSDKOptions";

export default class StickyBucketingAdapterExample implements StickyBucketingStorageAdapter {
  public store: Record<string, string>;
  public constructor() {
    this.store = {};
  }
  get(key: string): string {
    return this.store[key];
  }
  set(key: string, value: string) {
    this.store[key] = value;
  }
  remove(key: string) {
    delete this.store[key]
  }
}
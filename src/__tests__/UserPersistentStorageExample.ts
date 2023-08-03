import { UserPersistentStorageInterface } from '../StatsigSDKOptions';

export default class UserPersistentStorageExample
  implements UserPersistentStorageInterface
{
  public store: Record<string, string>;
  public constructor() {
    this.store = {};
  }
  load(userID: string): string {
    return this.store[userID];
  }
  save(userID: string, data: string) {
    const dataParsed = JSON.parse(data) as {
      experiments: Record<string, unknown>;
    };
    if (Object.keys(dataParsed.experiments).length === 0) {
      delete this.store[userID];
    } else {
      this.store[userID] = data;
    }
  }
}

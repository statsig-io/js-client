import {
  UserPersistentStorageData,
  UserPersistentStorageInterface,
} from '../StatsigSDKOptions';

export default class UserPersistentStorageExample
  implements UserPersistentStorageInterface
{
  public store: Record<string, UserPersistentStorageData>;
  public constructor() {
    this.store = {};
  }
  load(userID: string): UserPersistentStorageData {
    return this.store[userID] ?? {experiments: {}};
  }
  save(userID: string, data: UserPersistentStorageData) {
    if (Object.keys(data.experiments).length === 0) {
      delete this.store[userID]
    } else {
      this.store[userID] = data;
    }
  }
}

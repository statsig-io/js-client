import { StatsigUser } from '../StatsigUser';

export default abstract class BootstrapValidator {
  static isValid(
    user: StatsigUser | null,
    values: Record<string, unknown>,
  ): boolean {
    try {
      const evaluatedKeys = values['evaluated_keys'];
      if (!evaluatedKeys || typeof evaluatedKeys !== 'object') {
        return true;
      }

      const keys = BootstrapValidator.copyObject(evaluatedKeys);
      const userCopy = BootstrapValidator.copyObject(
        {
          userID: user?.userID,
          customIDs: user?.customIDs,
        }
      );

      return BootstrapValidator.validate(keys, user == null ? null : userCopy) && BootstrapValidator.validate(user == null ? null : userCopy, keys);
    } catch (error) {
      // This is best-effort. If we fail, return true.
    }

    return true;
  }

  private static validate(one: object | null, two: object | null): boolean {
    if (one == null) {
      return two == null;
    } else if (two == null) {
      return false;
    }
    for (let [key, value] of Object.entries(one)) {
      if (key === 'stableID') {
        continue;
      }
      // @ts-ignore
      if (typeof value !== typeof two[key]) {
        // @ts-ignore
        return false;
      }
      if (typeof value === 'string') {
        // @ts-ignore
        if (value !== two[key]) {
          return false;
        }
      } else if (typeof value === 'object') {
        // @ts-ignore
        return this.validate(value, two[key]);
      } else {
        // unexpected
        return false;
      }
    }
    return true;
  }

  private static copyObject<T>(obj: T | null): T | null {
    if (obj == null) {
      return null;
    }
    const copy = JSON.parse(JSON.stringify(obj));
    delete copy.stableID;
    if (copy.customIDs) {
      delete copy.customIDs['stableID'];
      if (Object.keys(copy.customIDs).length === 0) {
        delete copy.customIDs;
      }
    }
    
    if (Object.keys(copy).length === 0) {
      return null;
    }
    return copy;
  }
}

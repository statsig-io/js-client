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
      const evaluatedKeysRecord = evaluatedKeys as Record<string, unknown>;
      const keys = BootstrapValidator.copyObject({
          userID: evaluatedKeysRecord?.userID,
          customIDs: evaluatedKeysRecord?.customIDs,
      });

      const userToCompare = user == null ? null : BootstrapValidator.copyObject(
        {
          userID: user?.userID,
          customIDs: user?.customIDs,
        }
      );

      return BootstrapValidator.validate(keys, userToCompare) && BootstrapValidator.validate(userToCompare, keys);
    } catch (error) {
      // This is best-effort. If we fail, return true.
    }

    return true;
  }

  private static validate(
    one: Record<string, unknown> | null,
    two: Record<string, unknown> | null
  ): boolean {
    if (one == null) {
      return two == null;
    } else if (two == null) {
      return false;
    }
    for (let [key, value] of Object.entries(one)) {
      if (key === 'stableID') {
        continue;
      }
      if (typeof value !== typeof two[key]) {
        return false;
      }
      if (typeof value === 'string') {
        if (value !== two[key]) {
          return false;
        }
      } else if (typeof value === 'object') {
          return this.validate(
            value as Record<string, unknown>,
            two[key] as Record<string, unknown>
          );
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

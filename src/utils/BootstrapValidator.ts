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
      const evaluatedKeysRecord = this.copyObject(
        evaluatedKeys as Record<string, unknown>,
      );

      const userToCompare = user == null ? null : this.copyObject(user);

      return (
        BootstrapValidator.validate(evaluatedKeysRecord, userToCompare) &&
        BootstrapValidator.validate(userToCompare, evaluatedKeysRecord)
      );
    } catch (error) {
      // This is best-effort. If we fail, return true.
    }

    return true;
  }

  private static validate(
    one: Record<string, unknown> | null,
    two: Record<string, unknown> | null,
  ): boolean {
    if (one == null) {
      return two == null;
    } else if (two == null) {
      return false;
    }

    for (const [key, value] of Object.entries(one)) {
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
          two[key] as Record<string, unknown>,
        );
      } else {
        // unexpected
        return false;
      }
    }
    return true;
  }

  private static copyObject(
    obj?: Record<string, unknown>,
  ): Record<string, unknown> | null {
    if (obj == null) {
      return null;
    }

    const copy: Record<string, unknown> = {};
    if (obj?.userID) {
      copy['userID'] = obj?.userID;
    }

    if (obj?.customIDs) {
      const customIDs: Record<string, unknown> = {
        ...(obj.customIDs as Record<string, unknown>),
      };
      delete customIDs['stableID'];
      if (Object.keys(customIDs).length !== 0) {
        copy['customIDs'] = customIDs;
      }
    }

    return copy;
  }
}

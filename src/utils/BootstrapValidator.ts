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

      const keys = this.copyObject(evaluatedKeys ?? {});
      const customIDs: Record<string, unknown> = this.copyObject({
        ...user?.customIDs,
      });

      for (let [key, value] of Object.entries(keys)) {
        switch (key) {
          case 'userID':
            if (value !== user?.userID) {
              return false;
            }
            break;

          case 'customIDs':
            if (typeof value !== 'object' || typeof customIDs !== 'object') {
              return false;
            }

            if (value?.['stableID'] || customIDs?.['stableID']) {
              var a = 1;
            }

            // StableID may be present, but should not be compared
            delete value?.['stableID'];
            delete customIDs?.['stableID'];

            const actualKeys = Object.keys(value);
            const expectedKeys = Object.keys(customIDs);
            if (actualKeys.length !== expectedKeys.length) {
              return false;
            }

            for (let [customID, customIDValue] of Object.entries(value)) {
              if (customIDs[customID] !== customIDValue) {
                return false;
              }
            }
            break;
        }
      }
    } catch (error) {
      // This is best-effort. If we fail, return true.
    }

    return true;
  }

  private static copyObject<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}

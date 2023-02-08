
import ConfigEvaluation from './ConfigEvaluation';
import { ConfigCondition, ConfigRule, ConfigSpec } from './ConfigSpec';
import { LocalEvaluationDetails } from './LocalEvaluationDetails';
import { StatsigUser } from './StatsigUser';

const CONDITION_SEGMENT_COUNT = 10 * 1000;
const USER_BUCKET_COUNT = 1000;

export default class Evaluator {
  private specs: Record<string, ConfigSpec>;

  public constructor(specs: Record<string, unknown>) {
    this.specs = {};
    for (const spec in specs) {
      try {
        const rawSpec: Record<string, unknown> = specs[spec] as Record<string, unknown>;
        const parsedSpec = new ConfigSpec(rawSpec);
        this.specs[spec] = parsedSpec;
      } catch (e) { }
    }
  }

  public async getConfig(user: StatsigUser, configName: string): Promise<ConfigEvaluation> {
    return await this._evalConfig(user, this.specs[configName]);
  }


  async _evalConfig(user: StatsigUser, config: ConfigSpec | null): Promise<ConfigEvaluation> {
    if (!config) {
      return new ConfigEvaluation(false).withEvaluationDetails(
        LocalEvaluationDetails.make('Unrecognized'),
      );
    }

    const evaulation = await this._eval(user, config);
    return evaulation.withEvaluationDetails(
      LocalEvaluationDetails.make('Network'),
    );
  }

  async _eval(user: StatsigUser, config: ConfigSpec): Promise<ConfigEvaluation> {
    if (!config.enabled) {
      return new ConfigEvaluation(
        false,
        'disabled',
        [],
        config.defaultValue as Record<string, unknown>,
      );
    }

    let secondary_exposures: Record<string, string>[] = [];
    for (let i = 0; i < config.rules.length; i++) {
      let rule = config.rules[i];
      const ruleResult = await this._evalRule(user, rule);
      if (ruleResult.fetch_from_server) {
        return ConfigEvaluation.fetchFromServer();
      }

      secondary_exposures = secondary_exposures.concat(
        ruleResult.secondary_exposures,
      );

      if (ruleResult.value === true) {
        const pass = await this._evalPassPercent(user, rule, config);
        const evaluation = new ConfigEvaluation(
          pass,
          ruleResult.rule_id,
          secondary_exposures,
          pass
            ? ruleResult.json_value
            : (config.defaultValue as Record<string, unknown>),
          config.explicitParameters,
          ruleResult.config_delegate,
        );
        evaluation.setIsExperimentGroup(ruleResult.is_experiment_group);
        return evaluation;
      }
    }

    return new ConfigEvaluation(
      false,
      'default',
      secondary_exposures,
      config.defaultValue as Record<string, unknown>,
      config.explicitParameters,
    );
  }

  async _evalPassPercent(user: StatsigUser, rule: ConfigRule, config: ConfigSpec) {
    const hash = await computeUserHash(
      config.salt +
      '.' +
      (rule.salt ?? rule.id) +
      '.' +
      (this._getUnitID(user, rule.idType) ?? ''),
    );
    return (
      Number(hash % BigInt(CONDITION_SEGMENT_COUNT)) < rule.passPercentage * 100
    );
  }

  _getUnitID(user: StatsigUser, idType: string) {
    if (typeof idType === 'string' && idType.toLowerCase() !== 'userid') {
      return (
        user?.customIDs?.[idType] ?? user?.customIDs?.[idType.toLowerCase()]
      );
    }
    return user?.userID;
  }

  async _evalRule(user: StatsigUser, rule: ConfigRule) {
    let secondaryExposures: Record<string, string>[] = [];
    let pass = true;

    for (const condition of rule.conditions) {
      const result = await this._evalCondition(user, condition);
      if (result.fetchFromServer) {
        return ConfigEvaluation.fetchFromServer();
      }

      if (!result.passes) {
        pass = false;
      }

      if (result.exposures) {
        secondaryExposures = secondaryExposures.concat(result.exposures);
      }
    }

    const evaluation = new ConfigEvaluation(
      pass,
      rule.id,
      secondaryExposures,
      rule.returnValue as Record<string, unknown>,
    );
    evaluation.setIsExperimentGroup(rule.isExperimentGroup ?? false);
    return evaluation;
  }

  async _evalCondition(
    user: StatsigUser,
    condition: ConfigCondition,
  ): Promise<{ passes: boolean; fetchFromServer?: boolean; exposures?: any[] }> {
    let value = null;
    let field = condition.field;
    let target = condition.targetValue;
    let idType = condition.idType;
    switch (condition.type.toLowerCase()) {
      case 'public':
        return { passes: true };
      case 'fail_gate':
      case 'pass_gate':
        const gateResult = await this._evalConfig(user, this.specs[target as string]);
        if (gateResult?.fetch_from_server) {
          return { passes: false, fetchFromServer: true };
        }
        value = gateResult?.value;

        let allExposures = gateResult?.secondary_exposures ?? [];
        allExposures.push({
          gate: String(target),
          gateValue: String(value),
          ruleID: gateResult?.rule_id ?? '',
        });

        return {
          passes:
            condition.type.toLowerCase() === 'fail_gate' ? !value : !!value,
          exposures: allExposures,
        };
      case 'ip_based':
        // this would apply to things like 'country', 'region', etc.
        value = getFromUser(user, field) ?? { passes: false, fetchFromServer: true };
        break;
      case 'ua_based':
        // this would apply to things like 'os', 'browser', etc.
        value = getFromUser(user, field) ?? { passes: false, fetchFromServer: true };
        break;
      case 'user_field':
        value = getFromUser(user, field);
        break;
      case 'environment_field':
        // unsupported
        return { passes: false, fetchFromServer: true };
        break;
      case 'current_time':
        value = Date.now();
        break;
      case 'user_bucket':
        const salt = condition.additionalValues?.salt;
        const userHash = await computeUserHash(
          salt + '.' + this._getUnitID(user, idType) ?? '',
        );
        value = Number(userHash % BigInt(USER_BUCKET_COUNT));
        break;
      case 'unit_id':
        value = this._getUnitID(user, idType);
        break;
      default:
        return { passes: false, fetchFromServer: true };
    }

    const op = condition.operator?.toLowerCase();
    let evalResult = false;
    switch (op) {
      // numerical
      case 'gt':
        evalResult = numberCompare((a: number, b: number) => a > b)(
          value,
          target,
        );
        break;
      case 'gte':
        evalResult = numberCompare((a: number, b: number) => a >= b)(
          value,
          target,
        );
        break;
      case 'lt':
        evalResult = numberCompare((a: number, b: number) => a < b)(
          value,
          target,
        );
        break;
      case 'lte':
        evalResult = numberCompare((a: number, b: number) => a <= b)(
          value,
          target,
        );
        break;

      // version
      case 'version_gt':
        evalResult = versionCompareHelper((result) => result > 0)(
          value,
          target as string,
        );
        break;
      case 'version_gte':
        evalResult = versionCompareHelper((result) => result >= 0)(
          value,
          target as string,
        );
        break;
      case 'version_lt':
        evalResult = versionCompareHelper((result) => result < 0)(
          value,
          target as string,
        );
        break;
      case 'version_lte':
        evalResult = versionCompareHelper((result) => result <= 0)(
          value,
          target as string,
        );
        break;
      case 'version_eq':
        evalResult = versionCompareHelper((result) => result === 0)(
          value,
          target as string,
        );
        break;
      case 'version_neq':
        evalResult = versionCompareHelper((result) => result !== 0)(
          value,
          target as string,
        );
        break;

      // array
      case 'any':
        evalResult = arrayAny(
          value,
          target,
          stringCompare(true, (a, b) => a === b),
        );
        break;
      case 'none':
        evalResult = !arrayAny(
          value,
          target,
          stringCompare(true, (a, b) => a === b),
        );
        break;
      case 'any_case_sensitive':
        evalResult = arrayAny(
          value,
          target,
          stringCompare(false, (a, b) => a === b),
        );
        break;
      case 'none_case_sensitive':
        evalResult = !arrayAny(
          value,
          target,
          stringCompare(false, (a, b) => a === b),
        );
        break;

      // string
      case 'str_starts_with_any':
        evalResult = arrayAny(
          value,
          target,
          stringCompare(true, (a, b) => a.startsWith(b)),
        );
        break;
      case 'str_ends_with_any':
        evalResult = arrayAny(
          value,
          target,
          stringCompare(true, (a, b) => a.endsWith(b)),
        );
        break;
      case 'str_contains_any':
        evalResult = arrayAny(
          value,
          target,
          stringCompare(true, (a, b) => a.includes(b)),
        );
        break;
      case 'str_contains_none':
        evalResult = !arrayAny(
          value,
          target,
          stringCompare(true, (a, b) => a.includes(b)),
        );
        break;
      case 'str_matches':
        try {
          if (String(value).length < 1000) {
            evalResult = new RegExp(target as string).test(String(value));
          } else {
            evalResult = false;
          }
        } catch (e) {
          evalResult = false;
        }
        break;
      // strictly equals
      case 'eq':
        evalResult = value == target;
        break;
      case 'neq':
        evalResult = value != target;
        break;

      // dates
      case 'before':
        evalResult = dateCompare((a, b) => a < b)(value, target as string);
        break;
      case 'after':
        evalResult = dateCompare((a, b) => a > b)(value, target as string);
        break;
      case 'on':
        evalResult = dateCompare((a, b) => {
          a?.setHours(0, 0, 0, 0);
          b?.setHours(0, 0, 0, 0);
          return a?.getTime() === b?.getTime();
        })(value, target as string);
        break;
      case 'in_segment_list':
      case 'not_in_segment_list':
      // unsupported
      default:
        return { passes: false, fetchFromServer: true };
    }
    return { passes: evalResult };
  }
}


async function computeUserHash(userHash: string) {
  if (typeof window === 'undefined' || typeof window.crypto === 'undefined') {
    return BigInt(0);
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(userHash);

  const hash = await crypto.subtle.digest("SHA-256", data)
  const buffer = (new Uint8Array(hash)).buffer;
  const view = new DataView(buffer);
  const bigInt = view.getBigUint64(0, false);
  return bigInt;
}

async function getHashedName(name: string) {
  const hash = await crypto.subtle.digest("SHA-256", (new TextEncoder()).encode(name))
  return btoa((new TextDecoder("utf-8")).decode(hash));
}

function getFromUser(user: StatsigUser, field: string): any | null {
  if (typeof user !== 'object') {
    return null;
  }
  const indexableUser = user as { [field: string]: unknown };

  return (
    indexableUser[field] ??
    indexableUser[field.toLowerCase()] ??
    user?.custom?.[field] ??
    user?.custom?.[field.toLowerCase()] ??
    user?.privateAttributes?.[field] ??
    user?.privateAttributes?.[field.toLowerCase()]
  );
}

function numberCompare(
  fn: (a: number, b: number) => boolean,
): (a: unknown, b: unknown) => boolean {
  return (a: unknown, b: unknown) => {
    if (a == null || b == null) {
      return false;
    }
    const numA = Number(a);
    const numB = Number(b);
    if (isNaN(numA) || isNaN(numB)) {
      return false;
    }
    return fn(numA, numB);
  };
}

function versionCompareHelper(
  fn: (res: number) => boolean,
): (a: string, b: string) => boolean {
  return (a: string, b: string) => {
    const comparison = versionCompare(a, b);
    if (comparison == null) {
      return false;
    }
    return fn(comparison);
  };
}

// Compare two version strings without the extensions.
// returns -1, 0, or 1 if first is smaller than, equal to, or larger than second.
// returns false if any of the version strings is not valid.
function versionCompare(first: string, second: string): number | null {
  if (typeof first !== 'string' || typeof second !== 'string') {
    return null;
  }
  const version1 = removeVersionExtension(first);
  const version2 = removeVersionExtension(second);
  if (version1.length === 0 || version2.length === 0) {
    return null;
  }

  const parts1 = version1.split('.');
  const parts2 = version2.split('.');
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    if (parts1[i] === undefined) {
      parts1[i] = '0';
    }
    if (parts2[i] === undefined) {
      parts2[i] = '0';
    }
    const n1 = Number(parts1[i]);
    const n2 = Number(parts2[i]);
    if (
      typeof n1 !== 'number' ||
      typeof n2 !== 'number' ||
      isNaN(n1) ||
      isNaN(n2)
    ) {
      return null;
    }
    if (n1 < n2) {
      return -1;
    } else if (n1 > n2) {
      return 1;
    }
  }
  return 0;
}

function removeVersionExtension(version: string): string {
  const hyphenIndex = version.indexOf('-');
  if (hyphenIndex >= 0) {
    return version.substr(0, hyphenIndex);
  }
  return version;
}

function stringCompare(
  ignoreCase: boolean,
  fn: (a: string, b: string) => boolean,
): (a: string, b: string) => boolean {
  return (a: string, b: string): boolean => {
    if (a == null || b == null) {
      return false;
    }
    return ignoreCase
      ? fn(String(a).toLowerCase(), String(b).toLowerCase())
      : fn(String(a), String(b));
  };
}

function dateCompare(
  fn: (a: Date, b: Date) => boolean,
): (a: string, b: string) => boolean {
  return (a: string, b: string): boolean => {
    if (a == null || b == null) {
      return false;
    }
    try {
      // Try to parse into date as a string first, if not, try unixtime
      let dateA = new Date(a);
      if (isNaN(dateA.getTime())) {
        dateA = new Date(Number(a));
      }

      let dateB = new Date(b);
      if (isNaN(dateB.getTime())) {
        dateB = new Date(Number(b));
      }
      return (
        !isNaN(dateA.getTime()) && !isNaN(dateB.getTime()) && fn(dateA, dateB)
      );
    } catch (e) {
      // malformatted input, returning false
      return false;
    }
  };
}

function arrayAny(
  value: any,
  array: unknown,
  fn: (value: any, otherValue: any) => boolean,
): boolean {
  if (!Array.isArray(array)) {
    return false;
  }
  for (let i = 0; i < array.length; i++) {
    if (fn(value, array[i])) {
      return true;
    }
  }
  return false;
}

export default class DynamicConfig {
  private name: string;
  public value: Record<string, any>;
  private ruleID: string;
  public constructor(
    configName: string,
    configValue: Record<string, any> = {},
    ruleID = '',
  ) {
    this.name = configName;
    this.value = JSON.parse(JSON.stringify(configValue));
    this.ruleID = ruleID;
  }

  public get<T>(key: string, defaultValue: T): T {
    const val = this.getValue(key, defaultValue);
    if (defaultValue != null) {
      if (Array.isArray(defaultValue)) {
        if (Array.isArray(val)) {
          // @ts-ignore
          return val;
        }
        return defaultValue;
      } else if (typeof val !== typeof defaultValue) {
        return defaultValue;
      }
    }
    return val as unknown as T;
  }

  public getValue(
    key?: string,
    defaultValue?: any | null,
  ): boolean | number | string | object | Array<any> | null {
    if (key == null) {
      return this.value;
    }
    if (defaultValue == null) {
      defaultValue = null;
    }
    if (this.value[key] == null) {
      return defaultValue;
    }
    return this.value[key];
  }

  public getRuleID(): string {
    return this.ruleID;
  }

  public getName(): string {
    return this.name;
  }
}

import * as utils from './utils/core';

function DynamicConfig(configName, value, groupName) {
  /**
   * A class for fetching the json data configured for a DynamicConfig in the statsig console
   * @namespace DynamicConfig
   */
  if (typeof configName !== 'string' || configName.length === 0) {
    configName = '';
  }
  if (value == null) {
    value = {};
  }
  this.name = configName;
  this.value = utils.clone(value);
  this._groupName = groupName;
}

DynamicConfig.prototype.normalizeDefault = function (
  defaultValue,
  expectedType,
) {
  if (defaultValue == null) {
    console.warn(
      'Please provide a valid default value to be used when offline.',
    );
  }
  if (typeof defaultValue !== expectedType) {
    console.warn(
      'Expected type of ' +
        expectedType +
        ' but got ' +
        typeof defaultValue +
        ' for the default value.',
    );
    if (expectedType === 'string') return '';
    if (expectedType === 'number') return 0;
    if (expectedType === 'boolean') return false;
    if (expectedType === 'object') return {};
  }
  return defaultValue;
};

/**
 * Returns the boolean value of the given parameter, or the defaultValue if not found.
 * @param {string} name - The name of the parameter to check
 * @param {boolean} [defaultValue=false] - The default value of the parameter to return in cases where the parameter is not found or is not the correct type.
 * @returns {boolean}
 * @memberof DynamicConfig
 */
DynamicConfig.prototype.getBool = function (name, defaultValue) {
  defaultValue = this.normalizeDefault(defaultValue, 'boolean');
  if (!name || this.value[name] == null) {
    console.warn(
      'name does not exist on the DynamicConfig, returning the default value.',
    );
    return defaultValue;
  }

  const val = utils.getBoolValue(this.value[name]);
  if (val == null) {
    console.warn(name + ' is not a boolean. Returning the default value.');
    return defaultValue;
  }
  return val;
};

/**
 * Returns the string value of the given parameter, or the defaultValue if not found.
 * @param {string} name - The name of the parameter to check
 * @param {string} [defaultValue=''] - The default value of the parameter to return in cases where the parameter is not found or is not the correct type.
 * @returns {string}
 * @memberof DynamicConfig
 */
DynamicConfig.prototype.getString = function (name, defaultValue) {
  defaultValue = this.normalizeDefault(defaultValue, 'string');
  if (!name || this.value[name] == null) {
    console.warn(
      'name does not exist on the DynamicConfig, returning the default value.',
    );
    return defaultValue;
  }

  let val = this.value[name];
  if (typeof val === 'number' || typeof val === 'boolean') {
    console.warn(
      name + ' is not a string, converting and returning it as a string.',
    );
    val = val.toString();
  } else if (typeof val === 'object') {
    console.warn(
      name + ' is an object, not string. Returning the default value.',
    );
    return defaultValue;
  }
  return val;
};

/**
 * Returns the number value of the given parameter, or the defaultValue if not found.
 * @param {string} name - The name of the parameter to check
 * @param {number} [defaultValue=0] - The default value of the parameter to return in cases where the parameter is not found or is not the correct type.
 * @returns {number}
 * @memberof DynamicConfig
 */
DynamicConfig.prototype.getNumber = function (name, defaultValue) {
  defaultValue = this.normalizeDefault(defaultValue, 'number');
  if (!name || this.value[name] == null) {
    console.warn(
      'name does not exist on the DynamicConfig, returning the default value.',
    );
    return defaultValue;
  }

  const val = utils.getNumericValue(this.value[name]);
  if (val == null) {
    console.warn(name + ' is not a number. Returning the default value.');
    return defaultValue;
  }
  return val;
};

/**
 * Returns the object value of the given parameter as another DynamicConfig, or a DynamicConfig representing the defaultValue if not found.
 * @param {string} name - The name of the parameter to check
 * @param {object} [defaultValue={}] - The default value of the parameter to return in cases where the parameter is not found or is not the correct type.
 * @returns {DynamicConfig}
 * @memberof DynamicConfig
 */
DynamicConfig.prototype.getObject = function (name, defaultValue) {
  defaultValue = this.normalizeDefault(defaultValue, 'object');
  if (!name || this.value[name] == null) {
    console.warn(
      'name does not exist on the DynamicConfig, returning the default value.',
    );
    return new DynamicConfig(name, defaultValue, 'statsig::invalid_config');
  }

  const val = this.value[name];
  if (typeof val !== 'object') {
    console.warn(name + ' is not an object. Returning the default value.');
    return new DynamicConfig(name, defaultValue, 'statsig::invalid_config');
  }
  return new DynamicConfig(name, val, this._groupName);
};

/**
 * Returns the raw value of the DynamicConfig
 * @returns {any}
 * @memberof DynamicConfig
 */
DynamicConfig.prototype.getRawValue = function () {
  return this.value;
};

/**
 * @ignore
 */
DynamicConfig.prototype.getGroupName = function () {
  return this._groupName;
};

export default DynamicConfig;

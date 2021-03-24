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

DynamicConfig.prototype.validateDefault = function (
  defaultValue,
  expectedType,
) {
  if (defaultValue == null) {
    throw new Error(
      'You must provide a valid default value to check config parameters',
    );
  }
  const givenType = Array.isArray(defaultValue) ? 'array' : typeof defaultValue;
  if (givenType !== expectedType) {
    throw new Error(
      'Expected type of ' +
        expectedType +
        ' but got ' +
        givenType +
        ' for the default value.',
    );
  }
  return defaultValue;
};

/**
 * Returns the boolean value of the given parameter, or the defaultValue if not found.
 * @param {string} name - The name of the parameter to check
 * @param {boolean} [defaultValue=false] - The default value of the parameter to return in cases where the parameter is not found or is not the correct type.
 * @returns {boolean}
 * @throws Error if the defaultValue is null or not a boolean
 * @memberof DynamicConfig
 */
DynamicConfig.prototype.getBool = function (name, defaultValue = false) {
  defaultValue = this.validateDefault(defaultValue, 'boolean');
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
 * @throws Error if the defaultValue is null or not a string
 * @memberof DynamicConfig
 */
DynamicConfig.prototype.getString = function (name, defaultValue = '') {
  defaultValue = this.validateDefault(defaultValue, 'string');
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
 * @throws Error if the defaultValue is null or not a number
 * @memberof DynamicConfig
 */
DynamicConfig.prototype.getNumber = function (name, defaultValue = 0) {
  defaultValue = this.validateDefault(defaultValue, 'number');
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
 * Returns the Array value of the given parameter, or the defaultValue if not found.
 * @param {string} name - The name of the parameter to check
 * @param {Array<any>} [defaultValue=[]] - The default value of the parameter to return in cases where the parameter is not found or is not the correct type.
 * @returns {Array<any>}
 * @throws Error if the defaultValue is null or not an Array
 * @memberof DynamicConfig
 */
DynamicConfig.prototype.getArray = function (name, defaultValue = []) {
  defaultValue = this.validateDefault(defaultValue, 'array');
  if (!name || this.value[name] == null) {
    console.warn(
      'name does not exist on the DynamicConfig, returning the default value.',
    );
    return defaultValue;
  }

  const val = this.value[name];
  if (val == null || !Array.isArray(val)) {
    console.warn(name + ' is not an array. Returning the default value.');
    return defaultValue;
  }
  return val;
};

/**
 * Returns the object value of the given parameter as another DynamicConfig, or a DynamicConfig representing the defaultValue if not found.
 * @param {string} name - The name of the parameter to check
 * @param {object} [defaultValue={}] - The default value of the parameter to return in cases where the parameter is not found or is not the correct type.
 * @returns {DynamicConfig}
 * @throws Error if the defaultValue is null or not an object
 * @memberof DynamicConfig
 */
DynamicConfig.prototype.getObject = function (name, defaultValue = {}) {
  defaultValue = this.validateDefault(defaultValue, 'object');
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

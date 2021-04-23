const typedefs = require('./typedefs');

const DEFAULT_API = 'https://api.statsig.com/v1';

/**
 *
 * @param {typedefs.StatsigOptions} inputOptions
 * @returns {typedefs.StatsigOptions}
 */
export default function StatsigOptions(inputOptions) {
  if (inputOptions == null) {
    inputOptions = {};
  }

  const statsigOptions = {
    api: getString('api', DEFAULT_API),
    disableCurrentPageLogging: getBool('disableCurrentPageLogging'),
  };

  function getString(key, defaultValue) {
    const str = inputOptions[key];
    if (str == null || typeof str !== 'string') {
      return defaultValue;
    }
    return str;
  }

  function getBool(key) {
    return inputOptions[key] === true;
  }

  return statsigOptions;
}

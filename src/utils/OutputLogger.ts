/* eslint-disable @typescript-eslint/no-explicit-any */
import { LoggerInterface, LogLevel } from '../StatsigSDKOptions';

let _logger: LoggerInterface = console;
let _logLevel: LogLevel = LogLevel.WARN;
export default abstract class OutputLogger {
  private static readonly LOG_PREFIX = '[Statsig]';

  static getLogger(): LoggerInterface {
    return _logger;
  }

  static debug(message: string, ...optionalParams: any[]) {
    if (_logLevel !== LogLevel.NONE) {
      _logger.debug &&
        _logger.debug(`${this.LOG_PREFIX} ${message}`, ...optionalParams);
    }
  }

  static info(message: string, ...optionalParams: any[]) {
    if (_logLevel === LogLevel.INFO) {
      _logger.info(`${this.LOG_PREFIX} ${message}`, ...optionalParams);
    }
  }

  static warn(message: string, ...optionalParams: any[]) {
    if (_logLevel === LogLevel.WARN) {
      _logger.warn(`${this.LOG_PREFIX} ${message}`, ...optionalParams);
    }
  }

  static error(message: string, ...optionalParams: any[]) {
    if (_logLevel === LogLevel.ERROR) {
      _logger.error(`${this.LOG_PREFIX} ${message}`, ...optionalParams);
    }
  }

  static setLogger(logger: LoggerInterface) {
    _logger = logger;
  }

  static setLogLevel(logLevel: LogLevel) {
    _logLevel = logLevel;
  }

  static resetLogger() {
    _logger = console;
    _logLevel = LogLevel.WARN;
  }
}

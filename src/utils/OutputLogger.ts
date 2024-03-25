/* eslint-disable @typescript-eslint/no-explicit-any */
import { LoggerInterface, LogLevel } from '../StatsigSDKOptions';

let _logger: LoggerInterface = console;
let _logLevel: LogLevel = LogLevel.WARN;
export default abstract class OutputLogger {
    static getLogger(): LoggerInterface {
        return _logger;

    }

    static debug(message?: any, ...optionalParams: any[]) {
        if (_logLevel !== LogLevel.NONE) {
            _logger.debug && _logger.debug(message, ...optionalParams);
        }
    }

    static info(message?: any, ...optionalParams: any[]) {
        if (_logLevel === LogLevel.INFO) {
          _logger.info(message, ...optionalParams);
        }
    }
    
    static warn(message?: any, ...optionalParams: any[]) {
        if (_logLevel === LogLevel.WARN) {
            _logger.warn(message, ...optionalParams);
        }
    }

    static error(message?: any, ...optionalParams: any[]) {
        if (_logLevel === LogLevel.ERROR) {
            _logger.error(message, ...optionalParams);
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

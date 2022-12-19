import { LogLevel } from '../StatsigSDKOptions';

export default class ConsoleLogger {
  private logLevel: LogLevel;
  public constructor(level: LogLevel) {
    this.logLevel = level;
  }

  public info(message: string) {
    if (this.logLevel === LogLevel.NONE) {
      return;
    }
    console.log(message);
  }

  public error(message: string) {
    if (this.logLevel !== LogLevel.DEBUG) {
      return;
    }
    console.error(message);
  }
}

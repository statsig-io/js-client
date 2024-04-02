
import StatsigClient from "../StatsigClient";
import { LogLevel, LoggerInterface } from "../StatsigSDKOptions"

const LogLevels = [LogLevel.INFO, LogLevel.ERROR];
const MAX_VALUE_SIZE = 64;

describe('Output logger Interface', () => {
    it.each(LogLevels)(
        'calls to logger with log level %s',
        async (level) => {
            const infos: unknown[] = [];
            const warnings: unknown[] = [];
            const errors: unknown[] = [];
            
            const customLogger: LoggerInterface = {
                info: (message?: any, ...optionalParams: any[]) => {
                    infos.push(message);
                },
                warn: (message?: any, ...optionalParams: any[]) => {
                    warnings.push(message);
                },
                error: (message?: any, ...optionalParams: any[]) => {
                    errors.push(message);
                },
            };
            
            const secretKey = 'client-key';
            const user = { userID: 'test-id' };
            const client = new StatsigClient(secretKey, user, {
                logger: customLogger,
                logLevel: level,
            });
            
            client.logEvent('');
            if (level === LogLevel.ERROR) {
                expect(errors).toContainEqual(
                    '[Statsig] Event not logged. No valid eventName passed.',
                );
            }

            client.logEvent('a'.repeat(100));
            if (level == LogLevel.INFO) {
                expect(infos).toContainEqual(
                    '[Statsig] eventName is too long, trimming to ' + MAX_VALUE_SIZE + ' characters.',
                );
            }
        }
    )
})
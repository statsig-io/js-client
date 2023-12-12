import ErrorBoundary from '../ErrorBoundary';
import { StatsigSDKKeyMismatchError } from '../Errors';
import { djb2Hash } from './Hashing';

export function verifySDKKeyUsed(
  json: Record<string, unknown>,
  sdkKey: string,
  errorBoundary: ErrorBoundary,
): boolean {
  const hashedSDKKeyUsed = json?.hashed_sdk_key_used;
  if (hashedSDKKeyUsed != null && hashedSDKKeyUsed !== djb2Hash(sdkKey ?? '')) {
    errorBoundary.logError(
      'fetchAndSaveValues:eventually',
      new StatsigSDKKeyMismatchError(
        'The SDK key provided does not match the one used to generate values.',
      ),
    );
    return false;
  }
  return true;
}

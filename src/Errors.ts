export class StatsigUninitializedError extends Error {
  constructor(message?: string) {
    super(message ?? 'Call and wait for initialize() to finish first.');
    Object.setPrototypeOf(this, StatsigUninitializedError.prototype);
  }
}

export class StatsigInvalidArgumentError extends Error {
  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, StatsigInvalidArgumentError.prototype);
  }
}

export class StatsigSDKKeyMismatchError extends Error {
  constructor(message?: string) {
    super(message);

    Object.setPrototypeOf(this, StatsigSDKKeyMismatchError.prototype);
  }
}

export class StatsigInitializationTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(
      `The initialization timeout of ${timeoutMs}ms has been hit before the network request has completed.`,
    );

    Object.setPrototypeOf(this, StatsigInitializationTimeoutError.prototype);
  }
}

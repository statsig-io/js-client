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

export class StatsigSDKNetworkTimeoutError extends Error {
  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, StatsigSDKNetworkTimeoutError.prototype);
  }
}

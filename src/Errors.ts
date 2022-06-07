export class StatsigUninitializedError extends Error {
  constructor(message?: string) {
    super(message ?? 'Call and wait for initialize() to finish first.');
  }
}

export class StatsigInvalidArgumentError extends Error {}

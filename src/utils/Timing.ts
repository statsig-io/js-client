export function now(opts = { withPrecision: false }): number {
  if (typeof performance === 'undefined' || !performance) {
    return Date.now();
  }

  if (!opts.withPrecision) {
    return performance.now() | 0;
  }

  return performance.now();
}

export function difference(time: number): number {
  return now() - time;
}

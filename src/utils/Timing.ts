export function now(): number {
  if (typeof performance === 'undefined' || !performance) {
    return Date.now();
  }
  return performance.now();
}

export function difference(time: number): number {
  return now() - time;
}

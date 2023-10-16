export enum EvaluationReason {
  Network = 'Network',
  Bootstrap = 'Bootstrap',
  InvalidBootstrap = 'InvalidBootstrap',
  Cache = 'Cache',
  Prefetch = 'Prefetch',
  Sticky = 'Sticky',
  LocalOverride = 'LocalOverride',
  Unrecognized = 'Unrecognized',
  Uninitialized = 'Uninitialized',
  Error = 'Error',
  NetworkNotModified = 'NetworkNotModified',
  BootstrapStableIDMismatch = 'BootstrapStableIDMismatch',
}

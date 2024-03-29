export const OVERRIDES_STORE_KEY =
  'STATSIG_LOCAL_STORAGE_INTERNAL_STORE_OVERRIDES_V3';

export const STICKY_DEVICE_EXPERIMENTS_KEY =
  'STATSIG_LOCAL_STORAGE_STICKY_DEVICE_EXPERIMENTS';

// V4 change: values are now cached on a specific user ID
// We store values for up to 10 different user IDs at a time.
export const INTERNAL_STORE_KEY = 'STATSIG_LOCAL_STORAGE_INTERNAL_STORE_V4';

export const STATSIG_STABLE_ID_KEY = 'STATSIG_LOCAL_STORAGE_STABLE_ID';

export const STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY =
  'STATSIG_LOCAL_STORAGE_LOGGING_REQUEST';

export const LOCAL_STORAGE_KEYS: Record<string, boolean> = {
  STATSIG_LOCAL_STORAGE_STABLE_ID: true,
  STATSIG_LOCAL_STORAGE_INTERNAL_STORE_V4: true,
  STATSIG_LOCAL_STORAGE_STICKY_DEVICE_EXPERIMENTS: true,
  STATSIG_LOCAL_STORAGE_INTERNAL_STORE_OVERRIDES_V3: true,
  STATSIG_LOCAL_STORAGE_LOGGING_REQUEST: true,
};

export const STORAGE_PREFIX = 'STATSIG_LOCAL_STORAGE';

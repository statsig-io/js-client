import { djb2HashForObject } from './utils/Hashing';

export type StatsigUser = {
  userID?: string | number;
  email?: string;
  ip?: string;
  userAgent?: string;
  country?: string;
  locale?: string;
  appVersion?: string;
  custom?: Record<
    string,
    string | number | boolean | Array<string> | undefined
  >;
  privateAttributes?: Record<
    string,
    string | number | boolean | Array<string> | undefined
  >;
  customIDs?: Record<string, string>;
};

export function getUserHashWithoutStableID(user: StatsigUser): string {
  const { customIDs, ...rest } = user;
  const copyCustomIDs = { ...customIDs };
  delete copyCustomIDs.stableID;
  return djb2HashForObject({ ...rest, customIDs: copyCustomIDs });
}

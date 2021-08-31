export type StatsigUser = {
  userID?: string | number;
  email?: string;
  ip?: string;
  userAgent?: string;
  country?: string;
  locale?: string;
  appVersion?: string;
  custom?: Record<string, string | number | boolean | Array<string>>;
  privateAttributes?: Record<string, string | number | boolean | Array<string>>;
};

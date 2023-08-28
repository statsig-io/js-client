import { sha256 } from 'js-sha256';
import { StatsigUser } from '../StatsigUser';
import { Base64 } from './Base64';

const hashLookupTable: Record<string, string> = {};

export function fasthash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const character = value.charCodeAt(i);
    hash = (hash << 5) - hash + character;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

export type UserCacheKey = {
  v1: string;
  v2: string;
};

// Keeping this around to prevent busting existing caches
// This is just the same as djb2Hash but it can have negative values
export function memoizedUserCacheKeyHash(value: string): string {
  const seen = hashLookupTable[value];
  if (seen) {
    return seen;
  }

  const hash = String(fasthash(value));
  hashLookupTable[value] = hash;
  return hash;
}

export function djb2Hash(value: string): string {
  return String(fasthash(value) >>> 0);
}

export function sha256Hash(value: string): string {
  const seen = hashLookupTable[value];
  if (seen) {
    return seen;
  }

  const buffer = sha256.create().update(value).arrayBuffer();
  const hash = Base64.encodeArrayBuffer(buffer);
  hashLookupTable[value] = hash;
  return hash;
}

export function djb2HashForObject(
  object: Record<string, unknown> | null,
): string {
  return djb2Hash(JSON.stringify(getSortedObject(object)));
}

export function getSortedObject(
  object: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (object == null) {
    return null;
  }
  const keys = Object.keys(object).sort();
  const sortedObject: Record<string, unknown> = {};
  keys.forEach((key) => {
    let value = object[key];
    if (value instanceof Object) {
      value = getSortedObject(value as Record<string, unknown>);
    }

    sortedObject[key] = value;
  });
  return sortedObject;
}

export function getUserCacheKey(
  stableID: string,
  user: StatsigUser | null,
): UserCacheKey {
  const parts = [`userID:${String(user?.userID ?? '')}`];

  const customIDs = user?.customIDs;
  if (customIDs != null) {
    for (const type of Object.keys(customIDs).sort()) {
      parts.push(`${type}:${customIDs[type]}`);
    }
  }

  const v2 = memoizedUserCacheKeyHash(parts.join(';'));

  parts.splice(1, 0, `stableID:${stableID}`);
  const v1 = memoizedUserCacheKeyHash(parts.join(';'));

  return {
    v1,
    v2,
  };
}

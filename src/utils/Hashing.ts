import { sha256 } from 'js-sha256';
import { StatsigUser } from '../StatsigUser';
import { Base64 } from './Base64';

const hashLookupTable: Record<string, string> = {};

function fasthash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    let character = value.charCodeAt(i);
    hash = (hash << 5) - hash + character;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

// Keeping this around to prevent busting existing caches
// This is just the same as djb2Hash but it can have negative values
export function userCacheKeyHash(value: string): string {
  return String(fasthash(value));
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

export function getUserCacheKey(user: StatsigUser | null): string {
  let key = `userID:${String(user?.userID ?? '')}`;

  const customIDs = user?.customIDs;
  if (customIDs != null) {
    for (const [type, value] of Object.entries(customIDs)) {
      key += `;${type}:${value}`;
    }
  }

  const seen = hashLookupTable[key];
  if (seen) {
    return seen;
  }

  const hash = userCacheKeyHash(key);
  hashLookupTable[key] = hash;
  return hash;
}

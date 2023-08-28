import { StatsigUser } from '../StatsigUser';
import { Base64 } from './Base64';
import { sha256create } from './js-sha256';

const hashLookupTable: Record<string, string> = {};

export function SimpleHash(value: string): string {
  var hash = 0;
  for (var i = 0; i < value.length; i++) {
    var character = value.charCodeAt(i);
    hash = (hash << 5) - hash + character;
    hash = hash & hash; // Convert to 32bit integer
  }
  return String(hash);
}

export function getHashValue(value: string): string {
  const seen = hashLookupTable[value];
  if (seen) {
    return seen;
  }

  const buffer = sha256create().update(value).arrayBuffer();
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

  const hash = SimpleHash(key);
  hashLookupTable[key] = hash;
  return hash;
}

import { sha256 } from 'js-sha256';
import { StatsigUser } from '../StatsigUser';
import { Base64 } from './Base64';

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
  let buffer = sha256.create().update(value).arrayBuffer();
  return Base64.encodeArrayBuffer(buffer);
}

export function getUserCacheKey(
  stableId: string,
  user: StatsigUser | null,
): string {
  let key = `userID:${String(user?.userID ?? '')};stableID:${stableId}`;

  const customIDs = user?.customIDs;
  if (customIDs != null) {
    for (const [type, value] of Object.entries(customIDs)) {
      key += `;${type}:${value}`;
    }
  }

  return SimpleHash(key);
}

import { StatsigUser } from '../StatsigUser';
import { Base64 } from './Base64';
import { sha256create } from './js-sha256';

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
  let buffer = sha256create().update(value).arrayBuffer();
  return Base64.encodeArrayBuffer(buffer);
}

export function getUserCacheKey(user: StatsigUser | null): string {
  let key = `userID:${String(user?.userID ?? '')}`;

  const customIDs = user?.customIDs;
  if (customIDs != null) {
    for (const [type, value] of Object.entries(customIDs)) {
      key += `;${type}:${value}`;
    }
  }

  return SimpleHash(key);
}

import { fasthash, getUserCacheKey } from '../Hashing';

describe('Hashing', () => {
  describe('getUserCacheKey', () => {
    let v1: string;
    let v2: string;
    let v3: string;

    beforeAll(() => {
      const key = getUserCacheKey(
        'stable_id',
        {
          userID: 'user_id',
          customIDs: { k1: 'v1', k2: 'v2' },
        },
        'client-key',
      );
      v1 = key.v1;
      v2 = key.v2;
      v3 = key.v3;
    });

    it('gets v1 of a user cache key', () => {
      const expected = String(
        fasthash(`userID:user_id;stableID:stable_id;k1:v1;k2:v2`),
      );
      expect(v1).toEqual(expected);
    });

    it('gets v2 of a user cache key', () => {
      const expected = String(fasthash(`userID:user_id;k1:v1;k2:v2`));
      expect(v2).toEqual(expected);
    });

    it('gets v3 of a user cache key', () => {
      const expected = String(
        fasthash(`userID:user_id;k1:v1;k2:v2;sdkKey:client-key`),
      );
      expect(v3).toEqual(expected);
    });
  });
});

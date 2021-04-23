import { clone, getStableIDAsync, getNumericValue } from '../core';
import storage from '../storage';

describe('Verify behavior of core utility functions', () => {
  beforeEach(() => {
    expect.hasAssertions();
  });

  test('Test stable ID is the same across multiple gets', () => {
    expect.assertions(3);
    storage.init();
    return storage
      .getItemAsync('STATSIG_LOCAL_STORAGE_STABLE_ID')
      .then((localData) => {
        expect(localData).toBeNull();
        return getStableIDAsync().then((data) => {
          expect(data).not.toBeNull();
          return getStableIDAsync().then((data2) => {
            expect(data).toStrictEqual(data2);
          });
        });
      });
  });

  test('Test setting stable ID', () => {
    storage.init();
    return storage
      .setItemAsync('STATSIG_LOCAL_STORAGE_STABLE_ID', '123')
      .then(() => {
        return getStableIDAsync().then((data) => {
          expect(data).toStrictEqual('123');
        });
      });
  });

  test('Test clone', () => {
    expect(clone()).toBeNull();
    expect(clone({})).toStrictEqual({});
    expect(clone(null)).toBeNull();
    expect(clone({ test: 123 })).toStrictEqual({ test: 123 });
  });

  test('Test getNumericValue', () => {
    expect(getNumericValue(null)).toBeNull();
    expect(getNumericValue(10)).toStrictEqual(10);
    expect(getNumericValue({})).toBeNull();
    expect(getNumericValue('20')).toStrictEqual(20);
    expect(getNumericValue(10.0)).toStrictEqual(10.0);
    expect(getNumericValue(false)).toStrictEqual(0);
    expect(getNumericValue(true)).toStrictEqual(1);
    expect(getNumericValue('13.1')).toStrictEqual(13.1);
  });
});

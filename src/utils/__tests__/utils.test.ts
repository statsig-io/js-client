/**
 * @jest-environment jsdom
 */

import StatsigLocalStorage from '../StatsigLocalStorage';
import StatsigAsyncLocalStorage from '../StatsigAsyncLocalStorage';

describe('Verify behavior of core utility functions', () => {
  beforeEach(() => {
    expect.hasAssertions();
  });

  test('Test local storage is the same across multiple gets', () => {
    expect.assertions(3);
    expect(
      StatsigLocalStorage.getItem('STATSIG_LOCAL_STORAGE_STABLE_ID'),
    ).toBeNull();
    StatsigLocalStorage.setItem('STATSIG_LOCAL_STORAGE_STABLE_ID', '123');
    expect(
      StatsigLocalStorage.getItem('STATSIG_LOCAL_STORAGE_STABLE_ID'),
    ).toEqual('123');
    StatsigLocalStorage.setItem('UNRELATED_ITEM', 'ABC');
    expect(
      StatsigLocalStorage.getItem('STATSIG_LOCAL_STORAGE_STABLE_ID'),
    ).toEqual('123');
  });

  test('Test async storage doesnt work when not provided', () => {
    expect.assertions(1);
    return StatsigAsyncLocalStorage.setItemAsync('123', 'ABC').then(() => {
      StatsigAsyncLocalStorage.getItemAsync('123').then((result) => {
        expect(result).toBeNull();
      });
    });
  });

  test('Test async storage is the same across multiple gets', () => {
    expect.assertions(3);
    const store: Record<string, string> = {};
    StatsigAsyncLocalStorage.asyncStorage = {
      getItem(key: string): Promise<string | null> {
        return Promise.resolve(store[key] ?? null);
      },
      setItem(key: string, value: string): Promise<void> {
        store[key] = value;
        return Promise.resolve();
      },
      removeItem(key: string): Promise<void> {
        delete store[key];
        return Promise.resolve();
      },
    };
    return StatsigAsyncLocalStorage.setItemAsync('123', 'ABC').then(() => {
      StatsigAsyncLocalStorage.getItemAsync('123').then((result) => {
        expect(result).toEqual('ABC');
        StatsigAsyncLocalStorage.getItemAsync('123').then((result) => {
          expect(result).toEqual('ABC');
        });
        StatsigAsyncLocalStorage.removeItemAsync('123').then((result) => {
          StatsigAsyncLocalStorage.getItemAsync('123').then((result) => {
            expect(result).toBeNull();
          });
        });
      });
    });
  });
});

/**
 * @jest-environment jsdom
 */

import { StatsigUser } from '..';
import { djb2Hash, djb2HashForObject, getSortedObject } from '../utils/Hashing';

describe('Verify User Object Hash Works', () => {
  const userA: StatsigUser = {
    userID: 'user-a',
    email: 'user-a@statsig.io',
    ip: '1.2.3.4',
    country: 'US',
    locale: 'en_US',
    appVersion: '3.2.1',
    custom: { isVerified: true, hasPaid: false },
    privateAttributes: { age: 34, secret: 'shhh' },
    customIDs: { workID: 'employee-a', projectID: 'project-a' },
  };

  const userA2: StatsigUser = {
    userID: 'user-a',
    email: 'user-a@statsig.io',
    ip: '1.2.3.4',
    country: 'US',
    locale: 'en_US',
    appVersion: '3.2.1',
    custom: { hasPaid: false, isVerified: true },
    privateAttributes: { secret: 'shhh', age: 34 },
    customIDs: { projectID: 'project-a', workID: 'employee-a' },
  };

  const userA3: StatsigUser = {
    appVersion: '3.2.1',
    userID: 'user-a',
    country: 'US',
    email: 'user-a@statsig.io',
    locale: 'en_US',
    ip: '1.2.3.4',
    custom: { isVerified: true, hasPaid: false },
    privateAttributes: { age: 34, secret: 'shhh' },
    customIDs: { workID: 'employee-a', projectID: 'project-a' },
  };

  const userB: StatsigUser = {
    userID: 'user-b',
    email: 'user-b@statsig.io',
    ip: '5.6.7.8',
    country: 'NZ',
    locale: 'en_NZ',
    appVersion: '8.7.6',
    custom: { hasPaid: true, isVerified: false },
    privateAttributes: { secret: 'booo', age: 29 },
    customIDs: { workID: 'employee-b', projectID: 'project-b' },
  };

  test.each([
    { user1: userA, user2: userA2, isSame: true },
    { user1: userA, user2: userA3, isSame: true },
    { user1: userA3, user2: userA2, isSame: true },
    { user1: userA, user2: userB, isSame: false },
    { user1: userA2, user2: userB, isSame: false },
    { user1: userA3, user2: userB, isSame: false },
  ])('hash works as expected', async (data) => {
    const hash1 = djb2HashForObject(data.user1);
    const hash2 = djb2HashForObject(data.user2);
    expect(hash1 === hash2).toEqual(data.isSame);
  });
});

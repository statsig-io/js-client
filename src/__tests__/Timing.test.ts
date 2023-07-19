/**
 * @jest-environment jsdom
 */

import { now } from '../utils/Timing';

describe('Timing', () => {
  beforeAll(() => {
    performance.now = () => 123.456;
  });

  it('gets time with floating point numbers', () => {
    expect(now({ withPrecision: true })).toBe(123.456);
  });

  it('gets time with whole numbers', () => {
    expect(now()).toBe(123);
  });
});

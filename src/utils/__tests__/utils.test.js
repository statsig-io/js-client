import { clone, getBoolValue, getStableID, getNumericValue } from '../core';
import { localRemove, localGet, localSet } from '../storage';

describe('Verify behavior of core utility functions', () => {
  beforeEach(() => {
    expect.hasAssertions();
  });

  test('Test Device ID and storage APIs', () => {
    expect(localGet('statsig_stable_id')).toBeNull();
    const deviceID = getStableID();
    expect(deviceID).not.toBeNull();
    expect(getStableID()).toStrictEqual(deviceID);
    localRemove('statsig_stable_id');
    let otherDeviceID = getStableID();
    expect(otherDeviceID).not.toBeNull();
    expect(otherDeviceID).not.toStrictEqual(deviceID);

    localSet('statsig_stable_id', '123');
    expect(getStableID()).toStrictEqual('123');
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

  test('Test getBoolValue', () => {
    expect(getBoolValue(null)).toBeNull();
    expect(getBoolValue()).toBeNull();
    expect(getBoolValue(10)).toBeNull();
    expect(getBoolValue({})).toBeNull();
    expect(getBoolValue('20')).toBeNull();
    expect(getBoolValue(10.0)).toBeNull();
    expect(getBoolValue(false)).toStrictEqual(false);
    expect(getBoolValue(true)).toStrictEqual(true);
    expect(getBoolValue('true')).toStrictEqual(true);
    expect(getBoolValue('false 123')).toBeNull();
    expect(getBoolValue('false')).toStrictEqual(false);
  });
});

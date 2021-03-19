import {
  clone,
  getBoolValue,
  getDeviceID,
  getNumericValue,
  getSessionID,
} from '../core';
import {
  localRemove,
  localGet,
  localSet,
  sessionGet,
  sessionSet,
} from '../storage';

describe('Verify behavior of core utility functions', () => {
  beforeEach(() => {
    expect.hasAssertions();
  });

  test('Test Device ID and storage APIs', () => {
    expect(localGet('STATSIG_KEY_DEVICE_ID')).toBeNull();
    const deviceID = getDeviceID();
    expect(deviceID).not.toBeNull();
    expect(getDeviceID()).toStrictEqual(deviceID);
    localRemove('STATSIG_KEY_DEVICE_ID');
    let otherDeviceID = getDeviceID();
    expect(otherDeviceID).not.toBeNull();
    expect(otherDeviceID).not.toStrictEqual(deviceID);

    localSet('STATSIG_KEY_DEVICE_ID', '123');
    expect(getDeviceID()).toStrictEqual('123');
  });

  test('Test Session ID and storage APIs', () => {
    expect(sessionGet('STATSIG_KEY_SESSION_ID')).toBeNull();
    const sessionID = getSessionID();
    expect(sessionID).not.toBeNull();
    expect(getSessionID()).toStrictEqual(sessionID);
    localRemove('STATSIG_KEY_SESSION_ID');
    let otherSessionID = getSessionID();
    expect(otherSessionID).not.toBeNull();
    // Session ID is not affected by localRemove
    expect(otherSessionID).toStrictEqual(sessionID);

    sessionSet('STATSIG_KEY_SESSION_ID', '123');
    expect(getSessionID()).toStrictEqual('123');
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

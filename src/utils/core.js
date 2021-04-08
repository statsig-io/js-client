import { v4 as uuidv4 } from 'uuid';
import localStorage from './storage';

const STATSIG_STABLE_ID_KEY = 'STATSIG_LOCAL_STORAGE_STABLE_ID';

export function getSDKVersion() {
  return require('../../package.json')?.version ?? '';
}

export function getSDKType() {
  return 'statsig-js-client-sdk';
}

export function generateID() {
  return uuidv4();
}

export function getStableIDAsync() {
  return localStorage
    .getItemAsync(STATSIG_STABLE_ID_KEY)
    .then((data) => {
      if (data) {
        return Promise.resolve(data);
      }
      throw new Error('No stable ID found in local storage.');
    })
    .catch(() => {
      const newStableID = generateID();
      return localStorage
        .setItemAsync(STATSIG_STABLE_ID_KEY, newStableID)
        .then(() => {
          return Promise.resolve(newStableID);
        })
        .catch(() => {
          return Promise.resolve(newStableID);
        });
    });
}

export function clone(obj) {
  if (obj == null) {
    return null;
  }
  return JSON.parse(JSON.stringify(obj));
}

// Return null if num can be parsed to a number, otherwise return null
export function getNumericValue(num) {
  if (num == null) {
    return null;
  }
  const n = Number(num);
  if (typeof n === 'number' && !isNaN(n) && isFinite(n) && num != null) {
    return n;
  }
  return null;
}

// Return the boolean value of the input if it can be casted into a boolean, null otherwise
export function getBoolValue(val) {
  if (val == null) {
    return null;
  } else if (val.toString().toLowerCase() === 'true') {
    return true;
  } else if (val.toString().toLowerCase() === 'false') {
    return false;
  }
  return null;
}

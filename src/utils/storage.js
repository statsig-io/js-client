export function localGet(key) {
  if (
    typeof Storage === 'undefined' ||
    typeof window === 'undefined' ||
    !window.localStorage
  ) {
    return;
  }
  return window.localStorage.getItem(key);
}

export function localSet(key, value) {
  if (
    typeof Storage === 'undefined' ||
    typeof window === 'undefined' ||
    !window.localStorage
  ) {
    return;
  }
  window.localStorage.setItem(key, value);
}

export function localRemove(key) {
  if (
    typeof Storage === 'undefined' ||
    typeof window === 'undefined' ||
    !window.localStorage
  ) {
    return;
  }
  window.localStorage.removeItem(key);
}

export function sessionGet(key) {
  if (
    typeof Storage === 'undefined' ||
    typeof window === 'undefined' ||
    !window.sessionStorage
  ) {
    return;
  }
  return window.sessionStorage.getItem(key);
}

export function sessionSet(key, value) {
  if (
    typeof Storage === 'undefined' ||
    typeof window === 'undefined' ||
    !window.sessionStorage
  ) {
    return;
  }
  window.sessionStorage.setItem(key, value);
}

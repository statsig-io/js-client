const storage = {
  init: function (asyncStorage = null) {
    try {
      if (
        !storage.local &&
        typeof Storage !== 'undefined' &&
        window != null &&
        window.localStorage != null
      ) {
        storage.local = window.localStorage;
      }

      if (
        !storage.async &&
        asyncStorage != null &&
        typeof asyncStorage.getItem === 'function' &&
        typeof asyncStorage.setItem === 'function' &&
        typeof asyncStorage.removeItem === 'function'
      ) {
        storage.async = asyncStorage;
      }
    } catch (e) {}
  },

  canUseSyncAPI: function () {
    return storage.local != null;
  },

  getNullableItem: function (key) {
    if (storage.local) {
      return storage.local.getItem(key) ?? null;
    }
    return null;
  },

  setItem: function (key, value) {
    if (storage.local) {
      return storage.local.setItem(key, value);
    }
  },

  removeItem: function (key) {
    if (storage.local) {
      storage.local.removeItem(key);
    }
  },

  getItemAsync: function (key) {
    try {
      if (storage.local) {
        return Promise.resolve(storage.local.getItem(key));
      }
      if (storage.async) {
        return storage.async.getItem(key);
      }
    } catch (e) {}
    return Promise.resolve();
  },

  setItemAsync: function (key, value) {
    try {
      if (storage.local) {
        storage.local.setItem(key, value);
        return Promise.resolve();
      }
      if (storage.async) {
        return storage.async.setItem(key, value);
      }
    } catch (e) {}
    return Promise.resolve();
  },

  // should always resolve - fire and forget
  removeItemAsync: function (key) {
    try {
      if (storage.local) {
        storage.local.removeItem(key);
        return Promise.resolve();
      }
      if (storage.async) {
        return storage.async.removeItem(key).catch(() => {
          return Promise.resolve();
        });
      }
    } catch (e) {}
    return Promise.resolve();
  },
};

export default storage;

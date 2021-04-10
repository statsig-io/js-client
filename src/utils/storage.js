const storage = {
  init: function (asyncStorage = null) {
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
  },

  getItemAsync: function (key) {
    if (storage.local) {
      return Promise.resolve(storage.local.getItem(key));
    }
    if (storage.async) {
      return storage.async.getItem(key);
    }
    return Promise.resolve();
  },

  setItemAsync: function (key, value) {
    if (storage.local) {
      storage.local.setItem(key, value);
      return Promise.resolve();
    }
    if (storage.async) {
      return storage.async.setItem(key, value);
    }
    return Promise.resolve();
  },

  // should always resolve - fire and forget
  removeItemAsync: function (key) {
    if (storage.local) {
      storage.local.removeItem(key);
      return Promise.resolve();
    }
    if (storage.async) {
      return storage.async.removeItem(key).catch(() => {
        return Promise.resolve();
      });
    }
    return Promise.resolve();
  },
};

export default storage;

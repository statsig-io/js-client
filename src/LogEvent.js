class LogEvent {
  constructor(eventName, disableCurrentPageLogging = false) {
    if (eventName == null || typeof eventName !== 'string') {
      console.error('EventName needs to be a string.');
      eventName = '';
    }
    this.time = Date.now();
    this.eventName = eventName;
    this.statsigMetadata = {};

    if (
      disableCurrentPageLogging === false &&
      window != null &&
      window.location != null &&
      window.location.href != null
    ) {
      // https://stackoverflow.com/questions/6257463/how-to-get-the-url-without-any-parameters-in-javascript
      const parts = window.location.href.split(/[?#]/);
      if (parts?.length > 0) {
        this.addStatsigMetadata('currentPage', parts[0]);
      }
    }
  }

  setValue(value) {
    if (typeof value === 'object') {
      this.value = JSON.stringify(value);
    } else if (typeof value === 'number') {
      this.value = value;
    } else {
      this.value = value.toString();
    }
  }

  setMetadata(metadata) {
    if (metadata != null && typeof metadata !== 'object') {
      console.warn('Metadata is not set because it needs to be an object.');
      return;
    }
    this.metadata = metadata;
  }

  setUser(user) {
    this.user = user;
  }

  addStatsigMetadata(key, value) {
    if (key == null) {
      return;
    }
    this.statsigMetadata[key] = value;
  }

  validate() {
    return typeof this.eventName === 'string' && this.eventName.length > 0;
  }

  toObject() {
    return {
      eventName: this.eventName,
      metadata: this.metadata,
      statsigMetadata: this.statsigMetadata,
      time: this.time,
      user: this.user,
      value: this.value,
    };
  }
}

export default LogEvent;

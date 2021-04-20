class LogEvent {
  constructor(eventName) {
    if (eventName == null || typeof eventName !== 'string') {
      console.error('EventName needs to be a string.');
      eventName = '';
    }
    this.time = Date.now();
    this.eventName = eventName;
    this.statsigMetadata = {};
  }

  setValue(value) {
    if (
      value != null &&
      typeof value !== 'string' &&
      typeof value !== 'number'
    ) {
      console.warn(
        'Value is not set because it needs to be of type string or number.',
      );
      return;
    }
    this.value = value;
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

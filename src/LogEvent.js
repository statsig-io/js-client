class LogEvent {
  constructor(eventName) {
    if (eventName == null || typeof eventName !== 'string') {
      console.error('EventName needs to be a string.');
      eventName = '';
    }
    this.time = Date.now();
    this.eventName = eventName;
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

  validate() {
    return typeof this.eventName === 'string' && this.eventName.length > 0;
  }

  toObject() {
    return {
      time: this.time,
      eventName: this.eventName,
      value: this.value,
      metadata: this.metadata,
      user: this.user,
    };
  }
}

export default LogEvent;

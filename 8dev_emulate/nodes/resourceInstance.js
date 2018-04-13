const EventEmitter = require('events');

class Resource extends EventEmitter {
  constructor(description) {
    super();

    this.identifier = description.identifier;
    this.type = description.type;
    this._value = description.value; // eslint-disable-line no-underscore-dangle
    this.handle = description.handle;
    this.permissions = description.permissions;
    this.notifyOnChange = description.notifyOnChange;
    this.valueSetIterator = description.handle === undefined ? undefined : setInterval(() => {
      this.value = description.handle();
    }, 100);
  }

  get value() { return this._value; } // eslint-disable-line no-underscore-dangle

  set value(value) {
    // TODO: throw exception if value type is incorrect

    if (this._value !== value) { // eslint-disable-line no-underscore-dangle
      this._value = value; // eslint-disable-line no-underscore-dangle
      this.emit('change', value);
    }
  }

  writeValue(value, force) {
    if (this.permissions.indexOf('W') > -1 || force) {
      this.value = value;
      return '2.04';
    }
    return '4.05';
  }

  execute(force) {
    if (this.permissions.indexOf('E') > -1 || force) {
      this.value();
      return '2.04';
    }
    return '4.05';
  }

  addObservationHandle(handle) {
    if (typeof handle === 'function') {
      this.observationHandle = handle;
      return true;
    }

    return false;
  }

  deleteObservationHandle() {
    if (typeof this.observationHandle === 'function') {
      this.observationHandle = undefined;
      return true;
    }

    return false;
  }
}

module.exports = {
  Resource,
};

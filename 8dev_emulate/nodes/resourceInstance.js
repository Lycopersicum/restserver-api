'use strict';

const EventEmitter = require('events');
const { Lwm2m } = require('../../index.js');
const RESOURCE_TYPE = Lwm2m.TLV.RESOURCE_TYPE;

function hexBuffer(hexadecimalString) {
  let hexString = '';
  if (hexadecimalString.length % 2 === 1) {
    hexString += '0';
  }
  hexString += hexadecimalString;
  return Buffer.from(hexString, 'hex');
}

class Resource extends EventEmitter {
  constructor(description) {
    super();

    this.identifier = description.identifier;
    this.type = description.type;
    this._value = description.value;
    this.handle = description.handle;
    this.permissions = description.permissions;
    this.notifyOnChange = description.notifyOnChange;
    this.valueSetIterator = description.handle === undefined ? undefined : setInterval(() => {
      this.value = description.handle();
    }, 100);
  }

  get value() { return this._value; }

  set value(value) {
    // TODO: throw exception if value type is incorrect

    if (this._value != value) {
      this._value = value;
      this.emit('change', value);
    }
  }

  readValue(callback) {
    if (this.permissions.indexOf('R') > -1) {
      this.value;
      return '2.05';
    }
    return '4.05';
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

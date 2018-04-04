'use strict';

const EventEmitter = require('events');
const RESOURCE_TYPE = {
  NONE: 0,
  BOOLEAN: 1,
  INTEGER: 2,
  FLOAT: 3,
  STRING: 4,
  OPAQUE: 5,
};

function hexBuffer(hexadecimalString) {
  let hexString = '';
  if (hexadecimalString.length % 2 === 1) {
    hexString += '0';
  }
  hexString += hexadecimalString;
  return Buffer.from(hexString, 'hex');
}

class Resource extends EventEmitter {
  constructor(type, value) {
    super();

    this.type = type;
    this._value = value;
  }
}

class ResourceInstance extends EventEmitter {
  constructor(identifier, permissions, type, value = undefined, handler = undefined, notifyOnChange = false) {
    super();

    this.identifier = identifier;
    this.type = type;
    this._value = value;
    this.handler = handler;
    this.permissions = permissions;
    this.notifyOnChange = notifyOnChange;
    this.valueSetIterator = handler === undefined ? undefined : setInterval(() => {
      this.value = handler();
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

  deleteResource(force) {
    if (this.permissions.indexOf('D') > -1 || force) {
      return '2.02';
    }
    return '4.05';
  }

  executeResource(force) {
    if (this.permissions.indexOf('E') > -1 || force) {
      this.value();
      return '2.04';
    }
    return '4.05';
  }

  addObservationHandler(handler) {
    this.observationHandler = handler;
  }

  deleteObservationHandler() {
    this.observationHandler = undefined;
  }

  getLength() {
    switch (this.type) {
      case RESOURCE_TYPE.NONE:
        return 0;
      case RESOURCE_TYPE.INTEGER:
        if (this.value === 0) {
          return 0;
        } else if (this.value >> 7 === 0) { // eslint-disable-line no-bitwise
          return 1;
        } else if (this.value >> 15 === 0) { // eslint-disable-line no-bitwise
          return 2;
        } else if (this.value >> 31 === 0) { // eslint-disable-line no-bitwise
          return 4;
        }
        return 8;
      case RESOURCE_TYPE.FLOAT:
        // TODO: Add checking for double variables.
        return 4;
      case RESOURCE_TYPE.BOOLEAN:
        return 1;
      case RESOURCE_TYPE.STRING:
        return this.value.length;
      case RESOURCE_TYPE.OPAQUE:
        return this.value.length;
      default:
        // Failed to specify type!
        return this.value.length;
    }
  }

  getTypeByte() {
    const valueLength = this.getLength();
    const lengthBits = valueLength.toString(2).length;
    let typeByteInteger = 0;

    this.typeByte = {
      identifierType: 3, // It is Resource
      identifierLength: (this.identifier.toString(2).length <= 8) ? 0 : 1,
      valueLength,
    };

    if (lengthBits <= 3) {
      this.typeByte.lengthType = 0;
    } else {
      this.typeByte.lengthType = Math.ceil(lengthBits / 8);
    }

    typeByteInteger += this.typeByte.identifierType << 6; // eslint-disable-line no-bitwise
    typeByteInteger += this.typeByte.identifierLength << 5; // eslint-disable-line no-bitwise
    typeByteInteger += this.typeByte.lengthType << 3; // eslint-disable-line no-bitwise
    typeByteInteger += this.typeByte.valueLength;

    return Buffer.from(typeByteInteger.toString(16), 'hex');
  }

  getIdentifierBytes() {
    const hexResourceID = this.identifier.toString(16);
    return hexBuffer(hexResourceID);
  }

  getLengthBytes() {
    const valueLength = this.getLength();
    const hexLengthBytes = (valueLength > 7) ? valueLength.toString(16) : '';
    return hexBuffer(hexLengthBytes);
  }

  getValueBytes() {
    let valueBuffer;
    let hexBool;
    switch (this.type) {
      case RESOURCE_TYPE.NONE: {
        valueBuffer = Buffer.from('', 'hex');
        break;
      }
      case RESOURCE_TYPE.INTEGER: {
        if (this.value >> 7 === 1) { // eslint-disable-line no-bitwise
          valueBuffer = hexBuffer(`00${this.value.toString(16)}`);
          break;
        } else if (this.value >> 15 === 1) { // eslint-disable-line no-bitwise
          valueBuffer = hexBuffer(`0000${this.value.toString(16)}`);
          break;
        } else if (this.value >> 15 === 1) { // eslint-disable-line no-bitwise
          valueBuffer = hexBuffer(`00000000${this.value.toString(16)}`);
          break;
        }
        valueBuffer = hexBuffer(this.value.toString(16));
        break;
      }
      case RESOURCE_TYPE.FLOAT: {
        valueBuffer = Buffer.alloc(4);
        valueBuffer.writeFloatBE(this.value);
        break;
      }
      case RESOURCE_TYPE.BOOLEAN: {
        hexBool = this.value ? '01' : '00';
        valueBuffer = Buffer.from(hexBool, 'hex');
        break;
      }
      case RESOURCE_TYPE.STRING: {
        valueBuffer = Buffer.from(this.value, 'ascii');
        break;
      }
      case RESOURCE_TYPE.OPAQUE: {
        valueBuffer = this.value;
        break;
      }
      default: {
        // Failed to specify type!
        valueBuffer = Buffer.from(this.value.toString(16), 'hex');
      }
    }
    return valueBuffer;
  }

  getTLVBuffer(callback) {
    if (this.permissions.indexOf('R') > -1) {
      const buffer = Buffer.concat([
        this.getTypeByte(),
        this.getIdentifierBytes(),
        this.getLengthBytes(),
        this.getValueBytes(),
      ]);
      callback(buffer);
      return '2.05';
    }
    return '4.05';
  }
}

module.exports = {
  RESOURCE_TYPE,
  ResourceInstance,
};

'use strict';

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

class ResourceInstance {
  constructor(identifier, permissions, type, value = undefined, handler = undefined) {
    this.identifier = identifier;
    this.type = type;
    this.value = value;
    this.handler = handler;
    this.permissions = permissions;
  }

  readValue(callback) {
    if (this.permissions.indexOf('R') > -1) {
      callback(this.getValue());
      return '2.05';
    }
    return '4.05';
  }

  getValue() {
    if (typeof this.handler === 'function') {
      this.value = this.handler();
    }
    return this.value;
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

  getLength() {
    switch (this.type) {
      case RESOURCE_TYPE.NONE:
        return 0;
      case RESOURCE_TYPE.INTEGER:
        if (this.getValue() === 0) {
          return 0;
        } else if (this.getValue() < (2 ** 7)) {
          return 1;
        } else if (this.getValue() < (2 ** 15)) {
          return 2;
        } else if (this.getValue() < (2 ** 31)) {
          return 4;
        }
        return 8;
      case RESOURCE_TYPE.FLOAT:
        // TODO: Add checking for double variables.
        return 4;
      case RESOURCE_TYPE.BOOLEAN:
        return 1;
      case RESOURCE_TYPE.STRING:
        return this.getValue().length;
      case RESOURCE_TYPE.OPAQUE:
        return this.getValue().length;
      default:
        // Failed to specify type!
        return this.getValue().length;
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
    typeByteInteger += this.typeByte.identifierType * (2 ** 6);
    typeByteInteger += this.typeByte.identifierLength * (2 ** 5);
    typeByteInteger += this.typeByte.lengthType * (2 ** 3);
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
    const value = this.getValue();
    let valueBuffer;
    let hexBool;
    switch (this.type) {
      case RESOURCE_TYPE.NONE: {
        valueBuffer = Buffer.from('', 'hex');
        break;
      }
      case RESOURCE_TYPE.INTEGER: {
        if (2 ** 7 <= value && value < 2 ** 8) {
          valueBuffer = hexBuffer(`00${value.toString(16)}`);
          break;
        } else if (2 ** 15 <= value && value < 2 ** 16) {
          valueBuffer = hexBuffer(`0000${value.toString(16)}`);
          break;
        } else if (2 ** 31 <= value && value < 2 ** 32) {
          valueBuffer = hexBuffer(`00000000${value.toString(16)}`);
          break;
        }
        valueBuffer = hexBuffer(value.toString(16));
        break;
      }
      case RESOURCE_TYPE.FLOAT: {
        valueBuffer = Buffer.alloc(4);
        valueBuffer.writeFloatBE(value);
        break;
      }
      case RESOURCE_TYPE.BOOLEAN: {
        hexBool = value ? '01' : '00';
        valueBuffer = Buffer.from(hexBool, 'hex');
        break;
      }
      case RESOURCE_TYPE.STRING: {
        valueBuffer = Buffer.from(value, 'ascii');
        break;
      }
      case RESOURCE_TYPE.OPAQUE: {
        valueBuffer = value;
        break;
      }
      default: {
        // Failed to specify type!
        valueBuffer = Buffer.from(value.toString(16), 'hex');
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

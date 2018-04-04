'use strict';

const INSTANCE_TYPE = {
  OBJECT: 0,
  MULTIPLE_RESOURCE: 1,
  RESOURCE_INSTANCE: 2,
  RESOURCE: 3,
};

const RESOURCE_TYPE = {
  NONE: 0,
  BOOLEAN: 1,
  INTEGER: 2,
  FLOAT: 3,
  STRING: 4,
  OPAQUE: 5,
};

function binaryToInteger(binaryData) {
  return parseInt(binaryData.toString('hex'), 16);
}

function binaryToBitString(binaryData) {
  return binaryToInteger(binaryData).toString(2);
}

function hexBuffer(hexadecimalString) {
  let hexString = '';
  if (hexadecimalString.length % 2 === 1) {
    hexString += '0';
  }
  hexString += hexadecimalString;
  return Buffer.from(hexString, 'hex');
}

class LwM2MInstance {
  constructor(payload, node) {
    this.node = node;
    let binaryData = payload;
    const identifierAndLength = this.readType(binaryData);
    binaryData = binaryData.slice(1);
    this.identifier = binaryToInteger(binaryData.slice(0, identifierAndLength[0]));
    binaryData = binaryData.slice(identifierAndLength[0]);
    this.readLength(binaryData, identifierAndLength[1]);
    binaryData = binaryData.slice(identifierAndLength[1]);
    this.leftoverData = this.readValue(binaryData).slice(this.valueLength);
  }

  readType(binaryData) {
    let typeByte = (binaryToBitString(binaryData.slice(0, 1))).split('');
    typeByte = Array(8 - typeByte.length).fill('0').concat(typeByte);
    this.type = parseInt(typeByte[0] + typeByte[1], 2);
    const identifierLength = parseInt(typeByte[2], 2) + 1;
    const lengthType = parseInt((typeByte[3] + typeByte[4]), 2);
    const valueLength = parseInt((typeByte[5] + typeByte[6] + typeByte[7]), 2);
    if (lengthType === 0) {
      this.valueLength = valueLength;
    }
    return [identifierLength, lengthType];
  }

  readIdentifier(binaryData, identifierLength) {
    this.identifier = binaryToInteger(binaryData.slice(0, identifierLength));
  }

  readLength(binaryData, lengthType) {
    if (lengthType !== 0) {
      this.valueLength = binaryToInteger(binaryData.slice(0, lengthType));
    }
  }

  readValue(binaryData) {
    switch (this.type) {
      case INSTANCE_TYPE.OBJECT: {
        this.valueObject = new LwM2MInstance(binaryData.slice(0, this.valueLength));
        break;
      }
      case INSTANCE_TYPE.MULTIPLE_RESOURCE: {
        // TODO: Add multiple resource instance support (Type 1 and 2)
        // this contains one of multiple resource values
        break;
      }
      case INSTANCE_TYPE.RESOURCE_INSTANCE: {
        // TODO: Add multiple resource instance support (Type 1 and 2)
        // this contains multiple resources
        break;
      }
      case INSTANCE_TYPE.RESOURCE: {
        this.binaryValue = binaryData.slice(0, this.valueLength);
        break;
      }
      default: {
        this.binaryValue = null;
      }
    }
    return binaryData.slice(this.valueLength);
  }

  getType() {
    return this.type;
  }

  getIdentifier() {
    return this.identifier;
  }

  getValue(resourceType) {
    switch (resourceType) {
      case RESOURCE_TYPE.INTEGER:
        return this.getIntegerValue();
      case RESOURCE_TYPE.FLOAT:
        return this.getFloatValue();
      case RESOURCE_TYPE.STRING:
        return this.getStringValue();
      case RESOURCE_TYPE.BOOLEAN:
        return this.getBooleanValue();
      case RESOURCE_TYPE.OPAQUE:
        return this.getBinaryValue();
      default:
        return this.value;
    }
  }

  getResource(resourceId) {
  // TODO: Change resources inside objects to list, like in parseTLV method
    if ((this.valueObject.getType() === 3) &&
        (this.valueObject.getIdentifier() === resourceId)) {
      return this.valueObject;
    } else if ((this.getType() === 3) &&
        (this.getIdentifier() === resourceId)) {
      return this;
    }
    return null;
  }

  getBinaryValue() {
    return binaryToBitString(this.binaryValue);
  }

  getBooleanValue() {
    return this.getBinaryValue() !== '0';
  }

  getIntegerValue() {
    switch (this.valueLength) {
      case 0:
        return 0;
      case 1:
        return this.binaryValue.readInt8();
      case 2:
        return this.binaryValue.readInt16BE();
      case 4:
        return this.binaryValue.readInt32BE();
      default:
        if (this.node !== undefined) {
          this.node.error({ payload: 'Incorrect integer value length.' });
        }
        return undefined;
    }
  }

  getFloatValue() {
    switch (this.valueLength) {
      case 4:
        return this.binaryValue.readFloatBE();
      case 8:
        return this.binaryValue.readDoubleBE();
      default:
        if (this.node !== undefined) {
          this.node.error({ payload: 'Incorrect float value length.' });
        }
        return undefined;
    }
  }

  getStringValue() {
    return this.binaryValue.toString('ascii');
  }

  getLeftovers() {
    return this.leftoverData;
  }
}

class ResourceInstance {
  constructor(identifier, value, type) {
    this.identifier = identifier;
    this.value = value;
    this.type = type;
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

  getTLVBuffer() {
    return Buffer.concat([
      this.getTypeByte(),
      this.getIdentifierBytes(),
      this.getLengthBytes(),
      this.getValueBytes(),
    ]);
  }
}

function decodeTLV(binaryData, node) {
  const objectsList = [];
  let object = new LwM2MInstance(binaryData, node);
  objectsList.push(object);
  while (object.getLeftovers().length !== 0) {
    object = new LwM2MInstance(object.getLeftovers(), node);
    objectsList.push(object);
  }
  return objectsList;
}

function encodeResourceTLV(identifier, value, resourceType) {
  const resource = new ResourceInstance(identifier, value, resourceType);
  return resource.getTLVBuffer();
}

module.exports = {
  decodeTLV,
  encodeResourceTLV,
  LwM2MInstance,
  RESOURCE_TYPE,
  INSTANCE_TYPE,
};

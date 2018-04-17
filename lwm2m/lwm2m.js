const TYPE = {
  OBJECT_INSTANCE: 0b00,
  MULTIPLE_RESOURCE: 0b10,
  RESOURCE_INSTANCE: 0b01,
  RESOURCE: 0b11,
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

function changeBufferSize(buffer, start, end = buffer.length) {
  const bufferArray = [];
  let index = start;

  if (!(buffer instanceof Buffer)) {
    throw Error('Given argument is not a buffer');
  }

  if (start < 0) {
    throw Error('Wanted buffer start is negative number');
  }

  if (buffer.length < end) {
    throw Error('Buffer length is smaller than wanted buffer end');
  }

  if (start > end) {
    throw Error('Wanted buffer start is larger number than end');
  }

  while (index < end) {
    bufferArray.push(buffer[index]);
    index += 1;
  }

  return Buffer.from(bufferArray);
}

function getDictionaryByValue(dictionaryList, keyName, value) {
  return dictionaryList.find(dictionary => (dictionary[keyName] === value));
}

function encodeResourceValue(resource) {
  const buffer = Buffer.alloc(4); // Variable is used only in float conversion

  if (typeof (resource.type) !== 'number') {
    throw Error(`Unrecognised resource type type (${typeof (resource.type)})`);
  }

  switch (resource.type) {
    case RESOURCE_TYPE.NONE:
      if (typeof (resource.value) !== 'number') {
        throw Error(`Unrecognised value type (${typeof (resource.value)})`);
      }

      return Buffer.from([]);

    case RESOURCE_TYPE.INTEGER:
      if (typeof (resource.value) !== 'number') {
        throw Error(`Cannot encode ${typeof (resource.value)} as integer`);
      }

      if (resource.value >> 7 === 1) { // eslint-disable-line no-bitwise
        return hexBuffer(`00${resource.value.toString(16)}`);
      } else if (resource.value >> 15 === 1) { // eslint-disable-line no-bitwise
        return hexBuffer(`0000${resource.value.toString(16)}`);
      } else if (resource.value >> 15 === 1) { // eslint-disable-line no-bitwise
        return hexBuffer(`00000000${resource.value.toString(16)}`);
      }
      return hexBuffer(resource.value.toString(16));

    case RESOURCE_TYPE.FLOAT: {
      if (typeof (resource.value) !== 'number') {
        throw Error(`Cannot encode ${typeof (resource.value)} as float`);
      }

      buffer.writeFloatBE(resource.value);
      return buffer;
    }

    case RESOURCE_TYPE.BOOLEAN:
      if (typeof (resource.value) !== 'boolean') {
        throw Error(`Cannot encode ${typeof (resource.value)} as boolean`);
      }

      return resource.value ? Buffer.from([1]) : Buffer.from([0]);

    case RESOURCE_TYPE.STRING:
      if (typeof (resource.value) !== 'string') {
        throw Error(`Cannot encode ${typeof (resource.value)} as string`);
      }

      return Buffer.from(resource.value, 'ascii');

    case RESOURCE_TYPE.OPAQUE:
      if (!(resource.value instanceof Buffer)) {
        throw Error(`Cannot encode ${typeof (resource.value)} as Buffer`);
      }

      return resource.value;

    default:
      throw Error(`Unrecognised resource type (${resource.type})`);
  }
}

function decodeResourceValue(buffer, resource) {
  switch (resource.type) {
    case RESOURCE_TYPE.INTEGER:
      switch (buffer.length) {
        case 0:
          return 0;

        case 1:
          return buffer.readInt8();

        case 2:
          return buffer.readInt16BE();

        case 4:
          return buffer.readInt32BE();

        default:
          throw Error(`Incorrect integer value length (${buffer.length})`);
      }

    case RESOURCE_TYPE.FLOAT:
      switch (buffer.length) {
        case 4:
          return buffer.readFloatBE();

        case 8:
          return buffer.readDoubleBE();

        default:
          throw Error(`Incorrect float value length (${buffer.length})`);
      }

    case RESOURCE_TYPE.STRING:
      return buffer.toString('ascii');

    case RESOURCE_TYPE.BOOLEAN:
      return binaryToBitString(buffer) !== '0';

    case RESOURCE_TYPE.OPAQUE:
      return binaryToBitString(buffer);

    default:
      throw Error(`Unrecognised resource type (${resource.type})`);
  }
}

function encodeTLV(object) {
  let identifierBuffer;
  let lengthBuffer;
  let typeByte = 0;

  if (!(object.value instanceof Buffer)) {
    throw Error('Encodable object value is not a buffer');
  }

  if (typeof (object.identifier) !== 'number') {
    throw Error('Encodable object identifier is not a number');
  }

  typeByte += object.type << 6; // eslint-disable-line no-bitwise

  if (object.identifier >= (1 << 8)) { // eslint-disable-line no-bitwise
    typeByte += 1 << 5; // eslint-disable-line no-bitwise
    identifierBuffer = Buffer.from([
      object.identifier / (1 << 8), // eslint-disable-line no-bitwise
      object.identifier % (1 << 8), // eslint-disable-line no-bitwise
    ]);
  } else {
    identifierBuffer = Buffer.from([object.identifier]);
  }

  if (object.value.length >= (1 << 16)) { // eslint-disable-line no-bitwise
    typeByte += 3 << 3; // eslint-disable-line no-bitwise

    lengthBuffer = Buffer.from([
      object.value.length / (1 << 16), // eslint-disable-line no-bitwise
      object.value.length / (1 << 8), // eslint-disable-line no-bitwise
      object.value.length % (1 << 8), // eslint-disable-line no-bitwise
    ]);
  } else if (object.value.length >= (1 << 8)) { // eslint-disable-line no-bitwise
    typeByte += 2 << 3; // eslint-disable-line no-bitwise

    lengthBuffer = Buffer.from([
      object.value.length / (1 << 8), // eslint-disable-line no-bitwise
      object.value.length % (1 << 8), // eslint-disable-line no-bitwise
    ]);
  } else if (object.value.length >= (1 << 3)) { // eslint-disable-line no-bitwise
    typeByte += 1 << 3; // eslint-disable-line no-bitwise

    lengthBuffer = Buffer.from([object.value.length]);
  } else {
    typeByte += object.value.length;

    lengthBuffer = Buffer.from([]);
  }

  return Buffer.concat([
    Buffer.from([typeByte]),
    identifierBuffer,
    lengthBuffer,
    object.value,
  ]);
}

function encodeResourceInstanceTLV(resourceInstance) {
  return encodeTLV({
    type: TYPE.RESOURCE_INSTANCE,
    identifier: resourceInstance.identifier,
    value: encodeResourceValue(resourceInstance),
  });
}

function encodeMultipleResourcesTLV(resources) {
  const resourceInstancesBuffers = [];

  for (let index = 0; index < resources.value.length; index += 1) {
    resourceInstancesBuffers.push(encodeResourceInstanceTLV({
      type: resources.type,
      identifier: index,
      value: resources.value[index],
    }));
  }

  return encodeTLV({
    type: TYPE.MULTIPLE_RESOURCE,
    identifier: resources.identifier,
    value: Buffer.concat(resourceInstancesBuffers),
  });
}

function encodeResourceTLV(resource) {
  if (resource.value instanceof Array) {
    return encodeMultipleResourcesTLV(resource);
  }

  return encodeTLV({
    type: TYPE.RESOURCE,
    identifier: resource.identifier,
    value: encodeResourceValue(resource),
  });
}

function encodeObjectInstanceTLV(objectInstance) {
  const resourcesBuffers = [];

  for (let index = 0; index < objectInstance.resources.length; index += 1) {
    resourcesBuffers.push(encodeResourceTLV(objectInstance.resources[index]));
  }

  return encodeTLV({
    type: TYPE.OBJECT_INSTANCE,
    identifier: objectInstance.identifier,
    value: Buffer.concat(resourcesBuffers),
  });
}

function encodeObjectTLV(object) {
  const objectInstancesBuffers = [];

  for (let index = 0; index < object.objectInstances.length; index += 1) {
    objectInstancesBuffers.push(encodeObjectInstanceTLV(object.objectInstances[index]));
  }

  return Buffer.concat(objectInstancesBuffers);
}

function decodeTLV(buffer) {
  let i;
  let valueIdentifier;
  let index = 1;
  let valueLength = 0;

  if (!(buffer instanceof Buffer)) {
    throw Error('Given argument is not a buffer');
  }

  if (buffer.length < 2) {
    throw Error('Given buffer is too short to store tlv data');
  }

  valueIdentifier = buffer[index];
  index += 1;

  i = index;
  if ((index + (buffer[0] >> 5) & 0b1) > 0) { // eslint-disable-line no-bitwise
    if (buffer[i] === undefined) {
      throw Error('Given buffer is corrupted (missing data)');
    }

    valueIdentifier = (valueIdentifier << 8) + buffer[i]; // eslint-disable-line no-bitwise
    i += 1;
  }

  index = i;

  if ((buffer[0] >> 3) & 0b11 > 0) { // eslint-disable-line no-bitwise
    while (i < (index + ((buffer[0] >> 3) & 0b11))) { // eslint-disable-line no-bitwise
      if (buffer[i] === undefined) {
        throw Error('Given buffer is corrupted (missing data)');
      }

      valueLength = (valueLength << 8) + buffer[i]; // eslint-disable-line no-bitwise
      i += 1;
    }
  } else {
    valueLength = buffer[0] & 0b111; // eslint-disable-line no-bitwise
  }
  index = i;

  return {
    type: buffer[0] >> 6, // eslint-disable-line no-bitwise
    identifier: valueIdentifier,
    value: changeBufferSize(buffer, index, index + valueLength),
    tlvSize: index + valueLength,
  };
}

function decodeResourceInstanceTLV(buffer, resources) {
  const decodedResourceInstance = decodeTLV(buffer);

  if (decodedResourceInstance.type !== TYPE.RESOURCE_INSTANCE) {
    throw Error('Decoded resource TLV type is not resource instance');
  }

  return {
    type: resources.type,
    identifier: decodedResourceInstance.identifier,
    value: decodeResourceValue(decodedResourceInstance.value, resources),
    tlvSize: decodedResourceInstance.tlvSize,
  };
}

function decodeResourceInstanceValue(buffer, resourceInstance) {
  const decodedResourceInstance = decodeTLV(buffer);

  if (decodedResourceInstance.type !== TYPE.RESOURCE_INSTANCE) {
    throw Error('Decoded resource TLV type is not resource instance');
  }

  return {
    value: decodeResourceValue(decodedResourceInstance.value, resourceInstance),
    tlvSize: decodedResourceInstance.tlvSize,
  };
}

function decodeMultipleResourceInstancesTLV(buffer, resources) {
  const decodedResourceValues = [];
  let decodedResourceInstance;
  let index = 0;

  while (index < buffer.length) {
    decodedResourceInstance = decodeResourceInstanceValue(
      changeBufferSize(buffer, index),
      resources
    );
    decodedResourceValues.push(decodedResourceInstance.value);
    index += decodedResourceInstance.tlvSize;
  }

  return {
    identifier: resources.identifier,
    type: resources.type,
    value: decodedResourceValues,
  };
}

function decodeResourceTLV(buffer, resource) {
  const decodedResource = decodeTLV(buffer);
  let resourceValue;

  if (resource.identifier !== decodedResource.identifier) {
    throw Error('Decoded resource TLV identifier and description identifiers do not match');
  }

  if (decodedResource.type === TYPE.RESOURCE) {
    resourceValue = decodeResourceValue(decodedResource.value, resource);
  } else if (decodedResource.type === TYPE.MULTIPLE_RESOURCE) {
    resourceValue = decodeMultipleResourceInstancesTLV(decodedResource.value, resource).value;
  } else {
    throw Error('TLV type is not resource or multiple resource');
  }

  return {
    identifier: resource.identifier,
    type: resource.type,
    value: resourceValue,
    tlvSize: decodedResource.tlvSize,
  };
}

function decodeObjectInstanceTLV(buffer, objectInstance) {
  const decodedObjectInstance = decodeTLV(buffer);
  const decodedResources = [];
  let remainingBuffer;
  let resourceIdentifier;
  let resourceDescription;
  let decodedResource;
  let index = 0;

  while (index < decodedObjectInstance.value.length) {
    remainingBuffer = changeBufferSize(decodedObjectInstance.value, index);
    resourceIdentifier = decodeTLV(remainingBuffer).identifier;

    resourceDescription = getDictionaryByValue(objectInstance.resources, 'identifier', resourceIdentifier);

    if (resourceDescription === undefined) {
      throw Error(`No resource description found (x/${objectInstance.identifier}/${resourceIdentifier})`);
    }

    decodedResource = decodeResourceTLV(remainingBuffer, resourceDescription);
    decodedResources.push(decodedResource);
    index += decodedResource.tlvSize;
  }

  return {
    identifier: objectInstance.identifier,
    resources: decodedResources,
  };
}


function decodeObjectTLV(buffer, object) {
  const decodedObjectInstances = [];
  let remainingBuffer;
  let objectInstanceIdentifier;
  let objectInstanceDescription;
  let decodedObjectInstance;
  let index = 0;

  while (index < buffer.length) {
    remainingBuffer = changeBufferSize(buffer, index);
    objectInstanceIdentifier = decodeTLV(remainingBuffer).identifier;

    objectInstanceDescription = getDictionaryByValue(object.objectInstances, 'identifier', objectInstanceIdentifier);

    if (objectInstanceDescription === undefined) {
      throw Error(`No object instance description found (/${object.identifier}/${objectInstanceIdentifier})`);
    }

    decodedObjectInstance = decodeObjectInstanceTLV(remainingBuffer, objectInstanceDescription);
    decodedObjectInstances.push(decodedObjectInstance);
    index += decodedObjectInstance.tlvSize;
  }

  return {
    identifier: object.identifier,
    objectInstances: decodedObjectInstances,
  };
}

module.exports = {
  TYPE,
  RESOURCE_TYPE,
  getDictionaryByValue,
  encodeTLV,
  decodeTLV,
  encodeResourceValue,
  decodeResourceValue,
  encodeResourceTLV,
  decodeResourceTLV,
  decodeResourceInstanceTLV,
  encodeObjectInstanceTLV,
  decodeObjectInstanceTLV,
  encodeObjectTLV,
  decodeObjectTLV,
};

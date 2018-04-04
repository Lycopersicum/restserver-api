'use strict';

const { INSTANCE_TYPE, parseTLV } = require('./lwm2m.js');
// const lwm2m = require('./lwm2m.js');
const { RESOURCE_TYPE, ResourceInstance } = require('./resourceInstance.js');

class ObjectInstance {
  constructor(objectID, instanceID, hidden = false) {
    this.objectID = objectID;
    this.instanceId = instanceID;
    this.hidden = hidden;
    this.resources = {};
  }

  addResource(identifier, permissions, type, value, handler, notifyOnChange) {
    // TODO: Add implementation for multiple instance resources.
    this.resources[`${identifier}`] = new ResourceInstance(identifier, permissions, type, value, handler, notifyOnChange);
  }

  writeResource(identifier, value, force = false) {
    return this.resources[identifier].writeValue(value, force);
  }

  deleteResource(identifier, force = false) {
    return this.resources[identifier].deleteResource(force);
  }

  executeResource(identifier, force = false) {
    return this.resources[identifier].executeResource(force);
  }

  getResourceValue(identifier, callback) {
    if (typeof callback !== 'function') {
      return this.resources[identifier].value;
    }
    callback(this.resources[identifier].value);
  }

  observeResource(identifier, handler) {
    this.resources[identifier].addObservationHandler(handler);
  }

  unobserveResource(identifier) {
    this.resources[identifier].deleteObservationHandler();
  }

  getResourceTLV(identifier, callback) {
    return this.resources[identifier].getTLVBuffer(callback);
  }

  getAllResourcesTLV() {
    // TODO: Review and change iterating through dictionary (not array anymore)
    const allBuffers = [];
    for (let iterator = 0; iterator < this.resources.length; iterator += 1) {
      allBuffers.push(this.resources[iterator].getTLV());
    }
    return Buffer.concat(allBuffers);
  }

  writeFromTLV(payload) {
    // const resourcesList = lwm2m.parseTLV(payload);
    const resourcesList = parseTLV(payload);
    let value;

    // if (resourcesList[0].getType() === lwm2m.TYPE_RESOURCE) {
    if (resourcesList[0].getType() === INSTANCE_TYPE.RESOURCE) {
      if (this.resources[`${resourcesList[0].getIdentifier()}`] === undefined) {
        return '4.04';
      }

      switch (this.resources[`${resourcesList[0].getIdentifier()}`].type) {
        case RESOURCE_TYPE.NONE: {
          if (resourcesList[0].valueLength !== 0) {
            return '4.00';
          }
          value = undefined;
          break;
        }

        case RESOURCE_TYPE.BOOLEAN: {
          value = resourcesList[0].getBooleanValue();
          break;
        }

        case RESOURCE_TYPE.INTEGER: {
          value = resourcesList[0].getIntegerValue();
          break;
        }

        case RESOURCE_TYPE.FLOAT: {
          value = resourcesList[0].getFloatValue();
          break;
        }

        case RESOURCE_TYPE.STRING: {
          value = resourcesList[0].getStringValue();
          break;
        }

        case RESOURCE_TYPE.OPAQUE: {
          value = resourcesList[0].binaryValue;
          break;
        }

        default: {
          return '5.00';
        }
      }
      return this.writeResource(`${resourcesList[0].getIdentifier()}`, value)
    }
  }
}

module.exports = ObjectInstance;

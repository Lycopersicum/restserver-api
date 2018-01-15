'use strict';

const { ResourceInstance } = require('./resourceInstance.js');

class ObjectInstance {
  constructor(objectID, instanceID) {
    this.objectID = objectID;
    this.instanceId = instanceID;
    this.resources = {};
  }

  addResource(identifier, permissions, type, value, handler) {
    // TODO: Add implementation for multiple instance resources.
    this.resources[`${identifier}`] = new ResourceInstance(identifier, permissions, type, value, handler);
  }

  deleteResource(identifier, force = false) {
    if (
      force === true
      || this.resources[identifier].deleteResource() === true
    ) {
      delete this.resources[identifier];
      return '2.02';
    }
    return '4.05';
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
}

module.exports = ObjectInstance;

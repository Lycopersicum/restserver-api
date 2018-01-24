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

  writeResource(identifier, value, force = false) {
    return this.resources[identifier].writeValue(value, force);
  }

  deleteResource(identifier, force = false) {
    return this.resources[identifier].deleteResource(force);
  }

  getResourceValue(identifier, callback) {
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
}

module.exports = ObjectInstance;

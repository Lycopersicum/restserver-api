'use strict';

const Lwm2m = require('../../lwm2m/index.js');
const { Resource } = require('./resourceInstance.js');
const getDictionaryByValue = Lwm2m.TLV.getDictionaryByValue;

class ObjectInstance {
  constructor(description) {
    this.identifier = description.identifier;
    this.hidden = description.hidden === undefined ? false : description.hidden;
    this.resources = [];
  }

  getResource(identifier) {
    return getDictionaryByValue(this.resources, 'identifier', identifier);
  }

  createResource(description) {
    console.log('Adding new resource', description.identifier);
    let resource = this.getResource(description.identifier);

    if (resource === undefined) {
      resource = new Resource(description);
      this.resources.push(resource);

      return resource;
    }

    if (resource.value instanceof Array) {
      resource.value.push(description.value);
    } else {
      console.log('Changed from resource to multiple resources', description.identifier);
      resource.value = [resource.value, description.value];
    }

    return resource;
  }

  writeResource(identifier, value, force = false) {
    const resource = getResource(identifier);

    return resource.writeValue(value, force);
  }

  deleteResource(identifier, force = false) {
    const resource = getResource(identifier);

    return resource.deleteResource(force);
  }

  executeResource(identifier, force = false) {
    const resource = getResource(identifier);

    return resource.executeResource(force);
  }

  getResourceValue(identifier, callback) {
    const resource = getResource(identifier);

    return resource.value;
  }

  observeResource(identifier, handler) {
    const resource = getResource(identifier);

    return resource.addObservationHandler(handler);
  }

  unobserveResource(identifier) {
    const resource = getResource(identifier);

    return resource.deleteObservationHandler();
  }
}

module.exports = {
  ObjectInstance,
};

const { TLV } = require('../../lwm2m/index.js');
const { Resource } = require('./resourceInstance.js');

const { getDictionaryByValue } = TLV;

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
    let resource = this.getResource(description.identifier);

    if (resource === undefined) {
      resource = new Resource(description);
      this.resources.push(resource);

      return resource;
    }

    if (resource.value instanceof Array) {
      resource.value.push(description.value);
    } else {
      resource.value = [resource.value, description.value];
    }

    return resource;
  }
}

module.exports = {
  ObjectInstance,
};

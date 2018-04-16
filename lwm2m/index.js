const lwm2m = require('./lwm2m.js');

module.exports.TLV = {
  TYPE: lwm2m.TYPE,
  RESOURCE_TYPE: lwm2m.RESOURCE_TYPE,
  getDictionaryByValue: lwm2m.getDictionaryByValue,
  encode: lwm2m.encodeTLV,
  decode: lwm2m.decodeTLV,
  encodeResource: lwm2m.encodeResourceTLV,
  decodeResource: lwm2m.decodeResourceTLV,
  decodeResourceInstance: lwm2m.decodeResourceInstanceTLV,
  encodeResourceValue: lwm2m.encodeResourceValue,
  decodeResourceValue: lwm2m.decodeResourceValue,
  encodeObjectInstance: lwm2m.encodeObjectInstanceTLV,
  decodeObjectInstance: lwm2m.decodeObjectInstanceTLV,
  encodeObject: lwm2m.encodeObjectTLV,
  decodeObject: lwm2m.decodeObjectTLV,
};

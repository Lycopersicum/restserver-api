const lwm2m = require('./lwm2m.js');

module.exports.TLV = {
  TYPE: lwm2m.TYPE,
  RESOURCE_TYPE: lwm2m.RESOURCE_TYPE,
  encode: lwm2m.encodeTLV,
  decode: lwm2m.decodeTLV,
  encodeResource: lwm2m.encodeResourceTLV,
  decodeResource: lwm2m.decodeResourceTLV,
  encodeResourceValue: lwm2m.encodeResourceValue,
  decodeResourceValue: lwm2m.decodeResourceValue,
  encodeObjectInstance: lwm2m.encodeObjectInstanceTLV,
  decodeObjectInstance: lwm2m.decodeObjectInstanceTLV,
  encodeObject: lwm2m.encodeObjectTLV,
  decodeObject: lwm2m.decodeObjectTLV,
};

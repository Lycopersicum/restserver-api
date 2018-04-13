'use strict';

const api = require('./8dev_restapi.js');
const emulate = require('./8dev_emulate/nodes/index.js');
const lwm2m = require('./lwm2m/index.js');

module.exports.Service = api.Service;
module.exports.Device = api.Device;
module.exports.Emulate = emulate;
module.exports.Lwm2m = lwm2m;

const client = require('./clientNodeInstance.js');
const resource = require('./resourceInstance.js');

module.exports.Client = client;
module.exports.Resource = resource.ResourceInstance;
module.exports.RESOURCE_TYPE = resource.RESOURCE_TYPE;

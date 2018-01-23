'use strict';

const coap = require('coap');
const ObjectInstance = require('./objectInstance.js');
const { RESOURCE_TYPE } = require('./resourceInstance.js');

const DATE = new Date();
const LWM2M_VERSION = '1.0';
coap.registerFormat('application/vnd.oma.lwm2m+tlv', 11542);

class ClientNodeInstance {
  constructor(lifetime, manufacturer, model, queueMode, endpointClientName, serverURI, clientPort) {
    this.objects = {};
    this.observedResources = {};
    this.updatesPath = '';
    this.registrationPath = '/rd';
    this.listeningPort = clientPort;
    this.endpointClientName = endpointClientName;

    this.coapServer = coap.createServer({ type: 'udp6' }, (req, res) => {
      this.requestListener(req, res);
    });
    this.coapServer.listen(clientPort);
    this.coapAgent = new coap.Agent({ type: 'udp6', socket: this.coapServer._sock });
    this.requestOptions = {
      host: serverURI,
      port: 5555,
      pathname: this.registrationPath,
      method: 'POST',
      confirmable: 'true',
      agent: this.coapAgent,
    };

    this.initiateSecurityObject(serverURI);
    this.initiateServerObject(lifetime, queueMode);
    this.initiateAccessControlObject();
    this.initiateDeviceObject(manufacturer, model, queueMode);
    this.initiateConnectivityMonitoringObject();
    this.initiateFirmwareObject();
    this.initiateLocationObject();
    this.initiateConnectivityStatisticsObject();
  }

  createObject(objectID, instanceID) {
    this.objects[`${objectID}/${instanceID}`] = new ObjectInstance(objectID, instanceID);
  }

  addResource(objectID, instanceID, resourceID, access, type, handler) {
    this.objects[`${objectID}/${instanceID}`].addResource(resourceID, access, type, handler);
  }

  getObjectInstancesList() {
    const objectInstancesList = [];
    for (const key in this.objects) {
      if (Object.prototype.hasOwnProperty.call(this.objects, key)) {
        objectInstancesList.push(`<${key}>`);
      }
    }
    return objectInstancesList;
  }

  initiateSecurityObject(serverURI, clientPSK = null, publicKey = null, serverRPK = null, secretKey = null) {
    this.createObject(0, 0);
    // LwM2M Server URI
    this.objects['0/0'].addResource(0, 'RW', RESOURCE_TYPE.STRING, serverURI);
    // Bootstrap Server
    this.objects['0/0'].addResource(1, 'RW', RESOURCE_TYPE.BOOLEAN, false);
    // Security Mode (0-4). 3 if NoSec, 0 if PSK
    this.objects['0/0'].addResource(2, 'RW', RESOURCE_TYPE.INTEGER, clientPSK === null ? 3 : 0);
    // Public Key or Identity
    this.objects['0/0'].addResource(3, 'RW', RESOURCE_TYPE.OPAQUE, publicKey);
    // Server Public Key
    this.objects['0/0'].addResource(4, 'RW', RESOURCE_TYPE.OPAQUE, serverRPK);
    // Secret Key
    this.objects['0/0'].addResource(5, 'R', RESOURCE_TYPE.OPAQUE, secretKey);
  }

  initiateServerObject(lifetime, queueMode) {
    let bindingMode = 'U';
    bindingMode += queueMode ? 'Q' : '';
    this.createObject(1, 0);
    // Short Server ID
    this.objects['1/0'].addResource(0, 'R', RESOURCE_TYPE.INTEGER, 1);
    // Lifetime
    this.objects['1/0'].addResource(1, 'RW', RESOURCE_TYPE.INTEGER, lifetime);
    // Default Minimum Period
    this.objects['1/0'].addResource(2, 'RW', RESOURCE_TYPE.INTEGER, 0);
    // Default Maximum Period
    this.objects['1/0'].addResource(3, 'RW', RESOURCE_TYPE.INTEGER, 0);
    // Notification Storing When Disabled or Offline
    this.objects['1/0'].addResource(6, 'RW', RESOURCE_TYPE.BOOLEAN, true);
    // Binding
    this.objects['1/0'].addResource(7, 'RW', RESOURCE_TYPE.STRING, bindingMode);
    // Registration Update Trigger
    this.objects['1/0'].addResource(8, 'E', RESOURCE_TYPE.NONE, null, () => {
      this.update();
    });
    //* update()*/);
  }

  initiateAccessControlObject() {
    // TODO: Add mandatory Resources to Access Control Object
    this.createObject(2, 0);
  }

  initiateDeviceObject(manufacturer, model, queueMode) {
    let bindingMode = 'U';
    bindingMode += queueMode ? 'Q' : '';
    this.createObject(3, 0);
    this.objects['3/0'].addResource(0, 'R', RESOURCE_TYPE.STRING, manufacturer);
    this.objects['3/0'].addResource(1, 'R', RESOURCE_TYPE.STRING, model);
    this.objects['3/0'].addResource(16, 'R', RESOURCE_TYPE.STRING, bindingMode);
  }
  initiateConnectivityMonitoringObject() {
    this.createObject(4, 0);
  }
  initiateFirmwareObject() {
    this.createObject(5, 0);
  }
  initiateLocationObject() {
    this.createObject(6, 0);
  }
  initiateConnectivityStatisticsObject() {
    this.createObject(7, 0);
  }

  requestGet(response, addressArray) {
    const objectInstance = addressArray.slice(0, 2).join('/');
    switch (addressArray.length) {
      case 1: {
        // TODO: Add handlers for objects reading
        response.statusCode = '4.06';
        break;
      } 
      case 2: {
        // TODO: Add handlers for object instances reading
        response.statusCode = '4.06';
        break;
      } 
      case 3: {
        // TODO: Add handlers for resources reading
        if (this.objects[objectInstance] instanceof ObjectInstance) {
          response.statusCode = this.objects[objectInstance].getResourceTLV(addressArray[2], (buffer) => {
            response.write(buffer);
          });
        } else {
          response.statusCode = '4.04';
        }
        break;
      } 
      case 4: {
        // TODO: Add handlers for resource instances reading
        response.statusCode = '4.00';
        break;
      }
      default: {
        response.statusCode = '4.00';
      }
    }
    response.end();
  }

  requestPut(response, addressArray) {
    // TODO: Add handlers for resource writing
    response.end()
  }

  requestPost(response, addressArray) {
    // TODO: Add handlers for resource execution
    response.end()
  }

  requestDelete(response, addressArray) {
    // TODO: Add handlers for resource deletion
    response.end()
  }

  getQueryString() {
    return [
      `ep=${this.endpointClientName}`,
      `lt=${this.objects['1/0'].resources['1'].getValue()}`,
      `lwm2m=${LWM2M_VERSION}`,
      `b=${this.objects['1/0'].resources['7'].getValue()}`,
      `et=${this.objects['3/0'].resources['1'].getValue()}`,
    ].join('&');
  }

  update(callback, updateLifetime = false, updateBinding = false) {
    const updateOptions = Object.assign({}, this.requestOptions);
    let queryString = '';
    updateOptions.pathname = this.updatesPath;

    if (updateLifetime) {
      queryString += `lt=${this.objects['1/0'].resources['1'].getValue()}`;
    }

    if (updateBinding) {
      queryString += `b=${this.objects['1/0'].resources['7'].getValue()}`;
    }

    if (queryString !== '') {
      updateOptions.query = queryString;
    }

    const request = coap.request(updateOptions);
    request.on('response', (response) => {
      switch (response.code) {
        case '2.04': {
          if (typeof callback === 'function') {
            callback();
          };
          break;
        }
        case '4.04': {
          // TODO: Decide if to add registering in case of unregistered device.
          this.stopUpdates();
          break;
        }
        default: {
          this.stopUpdates();
        }
      }
    });
    request.end();
  }

  startUpdates() {
    const that = this;
    this.coapServer.listen(that.listeningPort, () => {
      that.updatesIterator = setInterval(() => {
        that.update(() => {});
      }, 10000);
    });
  }

  stopUpdates() {
    if (this.updatesIterator) {
      clearInterval(this.updatesIterator);
      this.updatesIterator = null;
    }
  }

  startObservation(addressArray, response) {
    const observationTime = new Date().getTime()
    const objectInstance = addressArray.slice(0, 2).join('/');
    let observeResources = [];

    response.statusCode = '2.05';

    switch (addressArray.length) {
      case 1: {
        // TODO: Add handlers for objects observation
        break;
      } 
      case 2: {
        // TODO: Add handlers for object instances observation
        break;
      } 
      case 3: {
        observeResources.push({
          'resource': this.objects[objectInstance].resources[addressArray[2]],
          });
        break;
      }
      case 4: {
        // TODO: Add handlers for resource instances observation
        break;
      }
      default: {
        // TODO: Handle bad observation requests
      }
    }

    for (let i = 0; i < observeResources.length; i += 1) {
      observeResources[i].resource.addObservationHandler((buffer) => {
        let currentTime = (new Date().getTime()) - observationTime;
        response.setOption('Observe', currentTime);
        response.write(buffer);
      });
    }
  }

  stopObservation(addressArray) {
    const objectInstance = addressArray.slice(0, 2).join('/');
    let unobserveResources = [];
    switch (addressArray.length) {
      case 1: {
        // TODO: Add handlers for objects observation
        break;
      } 
      case 2: {
        // TODO: Add handlers for object instances observation
        break;
      } 
      case 3: {
        // TODO: Add handlers for resources observation
        unobserveResources.push(this.objects[objcestInstance].resources[addressArray[2]])
        delete this.observedResources[addressArray.join('/')];
        break;
      } 
      case 4: {
        // TODO: Add handlers for resource instances observation
        break;
      }
      default: {
        // TODO: Handle bad observation requests
      }
    }
    for (let i = 0; i < unobserveResources.length; i += 1) {
      resource.observe('value', (changes) => {
        return resource.value;
      });
    }
  }

  register(callback) {
    const messageBody = this.getObjectInstancesList().join(',');
    const registrationOptions = Object.assign({}, this.requestOptions);
    registrationOptions.query = this.getQueryString();
    const request = coap.request(registrationOptions);

    this.stopUpdates();

    request.on('response', (response) => {
      switch (response.code) {
        case '2.01': {
          for (let i = 0; i < response.options.length; i += 1) {
            if (response.options[i].name === 'Location-Path') {
              this.updatesPath += `/${response.options[i].value}`;
            }
          }
          this.startUpdates();
          callback(response);
          break;
        }
        default: {
          // TODO: Decide what to do if registration fails.
        }
      }
    });
    request.end(messageBody);
  }

  deregister(callback) {
    if (this.updatesPath !== '') {
      const deregistrationOptions = Object.assign({}, this.requestOptions);
      deregistrationOptions.method = 'DELETE';
      deregistrationOptions.pathname = this.updatesPath;

      this.stopUpdates();

      const request = coap.request(deregistrationOptions);

      request.on('response', (response) => {
        switch (response.code) {
          case '2.02': {
            this.updatesPath = '';
            break;
          }
          default: {
            // TODO: Decide what to do if deregistration fails.
          }
        }
        if (callback && typeof callback === 'function') {
          callback();
        }
      });
      request.end();
    }
    if (callback && typeof callback === 'function') {
      callback();
    }
  }

  requestListener(request, response) {
    const addressArray = [];
    let observation;
    for (let i = 0; i < request.options.length; i += 1) {
      if (request.options[i].name === 'Uri-Path') {
        addressArray.push(request.options[i].value.toString());
      }
    }
    switch (request.headers['Observe']) {
      case 0: {
        this.startObservation(addressArray, response);
        response.setOption('Observe', 0);
        // break;
        return;
      }
      case 1: {
        // TODO: Implement end of observation
        this.stopObservation(addressArray);
        break;
      }
      default: {
      }
    }

    switch (request.method) {
      case 'GET': {
        this.requestGet(response, addressArray);
        break;
      }
      case 'PUT': {
        this.requestPut(response, addressArray);
        break;
      }
      case 'POST': {
        this.requestPost(response, addressArray);
        break;
      }
      case 'DELETE': {
        this.requestDelete(response, addressArray);
        break;
      }
      default: {
        // TODO: Implement switch statement default case
      }
    }
  }
}

module.exports = ClientNodeInstance;

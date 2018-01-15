'use strict';

const coap = require('coap');
const ObjectInstance = require('./objectInstance.js');
const { RESOURCE_TYPE } = require('./resourceInstance.js');

const LWM2M_VERSION = '1.0';
coap.registerFormat('application/vnd.oma.lwm2m+tlv', 11542);

class ClientNodeInstance {
  constructor(lifetime, manufacturer, model, queueMode, endpointClientName, serverURI, clientPort) {
    this.objects = {};
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
    this.initiateServerObject(lifetime);
    this.initiateAccessControlObject();
    this.initiateDeviceObject(manufacturer, model, queueMode);
    this.initiateConnectivityMonitoringObject();
    this.initiateFirmwareObject();
    this.initiateLocationObject();
    this.initiateConnectivityStatisticsObject();
  }

  createObject(objectID, instanceID) {
    this.objects[`/${objectID}/${instanceID}`] = new ObjectInstance(objectID, instanceID);
  }

  addResource(objectID, instanceID, resourceID, access, type, handler) {
    this.objects[`/${objectID}/${instanceID}`].addResource(resourceID, access, type, handler);
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
    this.objects['/0/0'].addResource(0, 'RW', RESOURCE_TYPE.STRING, serverURI);
    // Bootstrap Server
    this.objects['/0/0'].addResource(1, 'RW', RESOURCE_TYPE.BOOLEAN, false);
    // Security Mode (0-4). 3 if NoSec, 0 if PSK
    this.objects['/0/0'].addResource(2, 'RW', RESOURCE_TYPE.INTEGER, clientPSK === null ? 3 : 0);
    // Public Key or Identity
    this.objects['/0/0'].addResource(3, 'RW', RESOURCE_TYPE.OPAQUE, publicKey);
    // Server Public Key
    this.objects['/0/0'].addResource(4, 'RW', RESOURCE_TYPE.OPAQUE, serverRPK);
    // Secret Key
    this.objects['/0/0'].addResource(5, 'R', RESOURCE_TYPE.OPAQUE, secretKey);
  }

  initiateServerObject(lifetime, queueMode) {
    let bindingMode = 'U';
    bindingMode += queueMode ? 'Q' : '';
    this.createObject(1, 0);
    // Short Server ID
    this.objects['/1/0'].addResource(0, 'R', RESOURCE_TYPE.INTEGER, 1);
    // Lifetime
    this.objects['/1/0'].addResource(1, 'RW', RESOURCE_TYPE.INTEGER, lifetime);
    // Default Minimum Period
    this.objects['/1/0'].addResource(2, 'RW', RESOURCE_TYPE.INTEGER, 0);
    // Default Maximum Period
    this.objects['/1/0'].addResource(3, 'RW', RESOURCE_TYPE.INTEGER, 0);
    // Notification Storing When Disabled or Offline
    this.objects['/1/0'].addResource(6, 'RW', RESOURCE_TYPE.BOOLEAN, true);
    // Binding
    this.objects['/1/0'].addResource(7, 'RW', RESOURCE_TYPE.STRING, bindingMode);
    // Registration Update Trigger
    this.objects['/1/0'].addResource(8, 'E', RESOURCE_TYPE.NONE, null, this.update);
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
    this.objects['/3/0'].addResource(0, 'R', RESOURCE_TYPE.STRING, manufacturer);
    this.objects['/3/0'].addResource(1, 'R', RESOURCE_TYPE.STRING, model);
    this.objects['/3/0'].addResource(16, 'R', RESOURCE_TYPE.STRING, bindingMode);
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

  requestListener(request, response) {
    // TODO: Add resource access handlers
    const addressArray = [];
    for (let i = 0; i < request.options.length; i += 1) {
      if (request.options[i].name === 'Uri-Path') {
        addressArray.push(request.options[i].value.toString());
      }
    }
    switch (request.method) {
      case 'GET': {
        if (addressArray.length === 1) {
        // TODO: Add handlers for objects reading
        } else if (addressArray.length === 2) {
        // TODO: Add handlers for object instances reading
          response.statusCode = '4.06';
        } else if (addressArray.length === 3) {
        // TODO: Add handlers for resources reading
          const objectInstance = `/${addressArray[0]}/${addressArray[1]}`;
          if (this.objects[objectInstance] instanceof ObjectInstance) {
            response.statusCode = this.objects[objectInstance].getResourceTLV(addressArray[2], (buffer) => {
              response.write(buffer);
            });
          } else {
            response.statusCode = '4.04';
          }
        } else if (addressArray.length === 4) {
        // TODO: Add handlers for resource instances reading
          response.statusCode = '4.00';
        } else {
          response.statusCode = '4.00';
        }
        break;
      }
      case 'PUT': {
        // TODO: Add handlers for resource writing
        break;
      }
      case 'POST': {
        // TODO: Add handlers for resource execution
        break;
      }
      case 'DELETE': {
        // TODO: Add handlers for resource deletion
        break;
      }
      default: {
        // TODO: Implement switch statement default case
      }
    }
    response.end();
  }

  getQueryString() {
    let queryString;
    queryString = `ep=${this.endpointClientName}`;
    queryString += `&lt=${this.objects['/1/0'].resources['1'].getValue()}`;
    queryString += `&lwm2m=${LWM2M_VERSION}`;
    queryString += `&b=${this.objects['/1/0'].resources['7'].getValue()}`;
    queryString += `&et=${this.objects['/3/0'].resources['1'].getValue()}`;
    return queryString;
  }

  update(callback, updateLifetime = false, updateBinding = false) {
    let queryString = '';
    const updateOptions = Object.assign({}, this.requestOptions);
    updateOptions.pathname = this.updatesPath;

    if (updateLifetime) {
      queryString += `lt=${this.objects['/1/0'].resources['1'].getValue()}`;
    }

    if (updateBinding) {
      queryString += `b=${this.objects['/1/0'].resources['7'].getValue()}`;
    }

    if (queryString !== '') {
      updateOptions.query = queryString;
    }

    const request = coap.request(updateOptions);
    request.on('response', (response) => {
      switch (response.code) {
        case '2.04': {
          callback();
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
      }, 3000);
    });
  }

  stopUpdates() {
    if (this.updatesIterator) {
      clearInterval(this.updatesIterator);
      this.updatesIterator = null;
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
}

module.exports = ClientNodeInstance;

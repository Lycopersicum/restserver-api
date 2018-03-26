'use strict';

const coap = require('coap');
const EventEmitter = require('events');
const ObjectInstance = require('./objectInstance.js');
const { RESOURCE_TYPE } = require('./resourceInstance.js');

const DATE = new Date();
const LWM2M_VERSION = '1.0';

coap.registerFormat('application/vnd.oma.lwm2m+tlv', 11542);

function Interval(callback, delay) {
  var iterator = setInterval(callback, delay);

  this.stop = function() {
    if (iterator) {
      clearInterval(iterator);
      iterator = null;
    }
    return this;
  }

  this.start = function() {
    if (!iterator) {
      this.stop();
      iterator = setInterval(callback, delay);
    }
    return this;
  }

  this.reset = function(newDelay) {
    delay = newDelay !== undefined ? newDelay : delay;
    return this.stop().start();
  }

  this.skip = function(newDelay) {
    callback();
    return this.reset();
  }
}

class ClientNodeInstance extends EventEmitter {
  constructor(lifetime, manufacturer, model, queueMode, endpointClientName, serverURI, clientPort) {
    super();

    this._state = 'stopped';
    this.objects = {};
    this.updatesIterator = {};
    this.observedResources = {};
    this.registrationPath = '/rd';
    this.listeningPort = clientPort;
    this.updatesInterval = 10; // updates interval in seconds
    this.endpointClientName = endpointClientName;

    this.coapServer = coap.createServer({ type: 'udp6' }, (req, res) => {
      this.requestListener(req, res);
    });
    this.coapServer.listen(clientPort);
    this.coapAgent = new coap.Agent({ type: 'udp6', socket: this.coapServer._sock });
    this.requestOptions = {
      host: serverURI,
      port: 5555,
      method: 'POST',
      confirmable: 'true',
      agent: this.coapAgent,
    };

    this.stateListener();

    this.initiateSecurityObject(serverURI);
    this.initiateServerObject(lifetime, queueMode);
    this.initiateAccessControlObject();
    this.initiateDeviceObject(manufacturer, model, queueMode);
    this.initiateConnectivityMonitoringObject();
    this.initiateFirmwareObject();
    this.initiateLocationObject();
    this.initiateConnectivityStatisticsObject();
  }

  get state() { return this._state; }

  set state(state) {
    if ((this._state !== state) && ((this._state !== 'stopped') || (state === 'started'))) {
      this._state = state;
      this.emit('state-change', state);
    }
  }

  createObject(objectID, instanceID, hidden) {
    this.objects[`${objectID}/${instanceID}`] = new ObjectInstance(objectID, instanceID, hidden);
  }

  addResource(objectID, instanceID, resourceID, access, type, handler) {
    this.objects[`${objectID}/${instanceID}`].addResource(resourceID, access, type, handler);
  }

  getObjectInstancesList() {
    const objectInstancesList = [];
    for (const key in this.objects) {
      if (this.objects[key].hidden === true) {
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(this.objects, key)) {
        objectInstancesList.push(`<${key}>`);
      }
    }
 
    return objectInstancesList;
  }

  initiateSecurityObject(serverURI, clientPSK = null, publicKey = null, serverRPK = null, secretKey = null) {
    this.createObject(0, 0, true);
    // LwM2M Server URI
    this.objects['0/0'].addResource(0, '', RESOURCE_TYPE.STRING, serverURI);
    // Bootstrap Server
    this.objects['0/0'].addResource(1, '', RESOURCE_TYPE.BOOLEAN, false);
    // Security Mode (0-4). 3 if NoSec, 0 if PSK
    this.objects['0/0'].addResource(2, '', RESOURCE_TYPE.INTEGER, clientPSK === null ? 3 : 0);
    // Public Key or Identity
    this.objects['0/0'].addResource(3, '', RESOURCE_TYPE.OPAQUE, publicKey);
    // Server Public Key
    this.objects['0/0'].addResource(4, '', RESOURCE_TYPE.OPAQUE, serverRPK);
    // Secret Key
    this.objects['0/0'].addResource(5, '', RESOURCE_TYPE.OPAQUE, secretKey);
  }

  initiateServerObject(lifetime, queueMode, minimumPeriod = 0, maximumPeriod = 60) {
    let bindingMode = 'U';
    bindingMode += queueMode ? 'Q' : '';
    this.createObject(1, 0);
    // Short Server ID
    this.objects['1/0'].addResource(0, 'R', RESOURCE_TYPE.INTEGER, 1);
    // Lifetime
    this.objects['1/0'].addResource(1, 'RW', RESOURCE_TYPE.INTEGER, lifetime);
    // Default Minimum Period
    this.objects['1/0'].addResource(2, 'RW', RESOURCE_TYPE.INTEGER, minimumPeriod);
    // Default Maximum Period
    this.objects['1/0'].addResource(3, 'RW', RESOURCE_TYPE.INTEGER, maximumPeriod);
    // Notification Storing When Disabled or Offline
    this.objects['1/0'].addResource(6, 'RW', RESOURCE_TYPE.BOOLEAN, true);
    // Binding
    this.objects['1/0'].addResource(7, 'RW', RESOURCE_TYPE.STRING, bindingMode);
    // Registration Update Trigger
    this.objects['1/0'].addResource(8, 'E', RESOURCE_TYPE.NONE, () => {
      this.updateHandler();
    });
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

  requestGet(response, addressArray, observation) {
    const objectInstance = addressArray.slice(0, 2).join('/');
    response._packet.ack = true;

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

    if (observation !== 0) {
      response.end();
    }
  }

  requestPut(response, addressArray, payload) {
    const objectInstance = addressArray.slice(0, 2).join('/');
    response._packet.ack = true;

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
        if (this.objects[objectInstance] instanceof ObjectInstance) {
          response.statusCode = this.objects[objectInstance].writeFromTLV(payload);
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
    response.end()
  }

  requestPost(response, addressArray) {
    const objectInstance = addressArray.slice(0, 2).join('/');
    response._packet.ack = true;

    switch (addressArray.length) {
      case 1: {
        response.statusCode = '4.04';
        break;
      }
      case 2: {
        response.statusCode = '4.04';
        break;
      }
      case 3: {
        if (this.objects[objectInstance] instanceof ObjectInstance) {
          response.statusCode = this.objects[objectInstance].executeResource(addressArray[2]);
        } else {
          response.statusCode = '4.04';
        }
        break;
      }
      case 4: {
        response.statusCode = '4.04';
        break;
      }
      default: {
        response.statusCode = '4.04';
      }
    }
    response.end()
  }

  requestDelete(response, addressArray) {
    // TODO: Add handlers for resource deletion
    response.end()
  }

  getQueryString() {
    return [
      `ep=${this.endpointClientName}`,
      `lt=${this.objects['1/0'].resources['1'].value}`,
      `lwm2m=${LWM2M_VERSION}`,
      `b=${this.objects['1/0'].resources['7'].value}`,
      `et=${this.objects['3/0'].resources['1'].value}`,
    ].join('&');
  }

  update(updatesPath, updateLifetime = false, updateBinding = false) {
    return new Promise((updated, failed) => {
      const updateOptions = Object.assign({}, this.requestOptions);
      const queryOptions = [];
      updateOptions.pathname = updatesPath;

      if (updateLifetime) {
        queryOptions.push(`lt=${this.objects['1/0'].resources['1'].value}`);
      }

      if (updateBinding) {
        queryOptions.push(`b=${this.objects['1/0'].resources['7'].value}`);
      }

      if (queryOptions.length > 0) {
        updateOptions.query = queryOptions.join('&');
      }

      const request = coap.request(updateOptions);

      request.on('response', (response) => {
        if (response.code === '2.04') {
          updated();
        } else {
          failed(response.code);
        }
      });

      request.on('error', (error) => {
        // TODO: Parse errors and act accordingly
        // failed(error);
        failed('timeout');
      });
      request.on('timeout', (error) => {
        // failed(error);
        failed('timeout');
      });

      request.end();
    });
  }

  startUpdates(updatesPath) {
    this.coapServer.listen(this.listeningPort, () => {
      this.updatesIterator[updatesPath] = new Interval(() => {
        this.update(updatesPath)
        .then()
        .catch((error) => {
          this.emit('update-failed', error, updatesPath);
        });
      }, this.updatesInterval * 1000);
    });
  }

  stopUpdates(updatesPath) {
    if (this.updatesIterator[updatesPath] !== undefined) {
      this.updatesIterator[updatesPath].stop();

      delete this.updatesIterator[updatesPath];
    }
  }

  updateHandler(updatesPath) {
    if (updatesPath === undefined) {
      for (let path in this.updatesIterator) {
        this.update(path)
        .then()
        .catch((error) => {
          this.emit('update-failed', error, path);
        });
      }
    } else {
      this.update(updatesPath)
      .then()
      .catch((error) => {
        this.emit('update-failed', error, updatesPath);
      });
    }
  }

  startObservation(addressArray, notification) {
    const objectInstance = addressArray.slice(0, 2).join('/');
    notification._packet.ack = false;
    notification._packet.confirmable = true;

    notification.on('error', (error) => {
      // TODO: Find better way to handle notification timeouts
      if (this.observedResources[addressArray.join('/')] !== undefined) {
        this.stopObservation(addressArray);
      }
    })

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
        if (this.observedResources[addressArray.join('/')] === undefined &&
          this.objects[objectInstance] instanceof ObjectInstance) {
          this.observedResources[addressArray.join('/')] = new Interval(() => {
            this.objects[objectInstance].resources[addressArray[2]].getTLVBuffer((buffer) => {
              notification.write(buffer);
            });
          }, this.objects['1/0'].getResourceValue('3') * 1000 );
          if (this.objects[objectInstance].resources[addressArray[2]].notifyOnChange) {
            this.objects[objectInstance].resources[addressArray[2]].on('change', () => {
              // TODO: Implement minimum period of observation
              if (this.observedResources[addressArray.join('/')] instanceof Interval) {
                this.observedResources[addressArray.join('/')].skip();
              }
            });
          }
        }
        break;
      }
      case 4: {
        // TODO: Add handlers for resource instances observation
        break;
      }
      default: {
        // TODO: Add handler for bad observation requests
      }
    }
  }

  stopObservation(addressArray) {
    const objectInstance = addressArray.slice(0, 2).join('/');
    switch (addressArray.length) {
      case 1: {
        // TODO: Add handlers for objects observation cancelling
        break;
      } 
      case 2: {
        // TODO: Add handlers for object instances observation cancelling
        break;
      } 
      case 3: {
        this.observedResources[addressArray.join('/')].stop();
        delete this.observedResources[addressArray.join('/')];
        break;
      } 
      case 4: {
        // TODO: Add handlers for resource instances observation cancelling
        break;
      }
      default: {
        // TODO: Handle bad observation cancelling requests
      }
    }
  }

  stopObservations() {
    for (var obs in this.observedResources) {
      this.stopObservation(obs.split('/'));
    }
  }

  register(registrationPath) {
    return new Promise((registered, failed) => {
      const messageBody = this.getObjectInstancesList().join(',');
      const registrationOptions = Object.assign({}, this.requestOptions);
      registrationOptions.pathname = registrationPath;
      registrationOptions.query = this.getQueryString();
      const request = coap.request(registrationOptions);
      let updatesPath = '';

      request.on('response', (response) => {
        if (response.code === '2.01') {
          for (let i = 0; i < response.options.length; i += 1) {
            if (response.options[i].name === 'Location-Path') {
              updatesPath += `/${response.options[i].value}`;
            }
          }
          this.state = 'registered';
          registered(updatesPath);
        } else {
          failed(response.code);
        }
      });

      request.on('error', failed);
      request.on('timeout', failed);

      request.end(messageBody);
    });
  }

  deregister(registrationPath) {
    this.emit('deregister', registrationPath);
  }

  deregistrationHandler(updatesPath) {
    return new Promise((deregistered, failed) => {
      const deregistrationOptions = Object.assign({}, this.requestOptions);
      deregistrationOptions.method = 'DELETE';
      deregistrationOptions.pathname = updatesPath;

      this.stopUpdates(updatesPath);
      this.stopObservations();

      const request = coap.request(deregistrationOptions);

      request.on('response', (response) => {
        if ((response.code === '2.02') || (response.code === '4.04')) {
          deregistered();
          this.state = 'not-registered';
        } else {
          failed(response.code);
        }
      });

      request.on('error', failed);
      request.on('timeout', failed);

      request.end();
    });
  }

  stateListener() {
    this.on('state-change', (state) => {
      switch (state) {
        case 'not-registered': {
          this.startRegistration()
          break;
        }
        case 'stopped': {
          this.emit('deregister');
          break;
        }
        case 'started': {
          this.startRegistration();
          break;
        }
        case 'registered': {
          break;
        }
        default: {
          this.emit('deregister');
        }
      }
    });
  }

  startRegistration(registrationPath = '/rd') {
    return new Promise((started, failed) => {
      this.register(registrationPath)
      .then((updatesPath) => {
        this.on('deregister', () => {
          this.deregistrationHandler(updatesPath);
        });

        this.on('update-failed', (reason) => {
          if ((reason === '4.04') || (reason === 'timeout')) {
            this.stopUpdates(updatesPath);
            this.state = 'not-registered';
          }
        });

        this.startUpdates(updatesPath);
        started(updatesPath);
      })
      .catch((responseCode) => {
        switch (responseCode) {
          case '4.00':
          case '4.03':
          case '4.12':
            this.state = 'stopped';
            failed(responseCode);
            break;
          default:
            setTimeout(() => {
              this.startRegistration(registrationPath)
              .then(started)
              .catch((error) => {
                this.emit('error', error);
              });
            }, this.objects['1/0'].resources['1'].value);
        }
      });
    });
  }

  start() {
    this.state = 'started';
  }

  stop() {
    this.state = 'stopped';
  }

  requestListener(request, response) {
    const addressArray = [];
    for (let i = 0; i < request.options.length; i += 1) {
      if (request.options[i].name === 'Uri-Path') {
        addressArray.push(request.options[i].value.toString());
      }
    }

    switch (request.method) {
      case 'GET': {
        response.setOption('Content-Format', 'application/vnd.oma.lwm2m+tlv');
        this.requestGet(response, addressArray, request.headers['Observe']);
        break;
      }
      case 'PUT': {
        this.requestPut(response, addressArray, request.payload);
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

    switch (request.headers['Observe']) {
      case 0: {
        response.setOption('Content-Format', 'application/vnd.oma.lwm2m+tlv');
        this.startObservation(addressArray, response);
        break;
      }
      default: {
        // TODO: Implement end of observation
        this.stopObservation(addressArray);
      }
    }
  }
}

module.exports = ClientNodeInstance;

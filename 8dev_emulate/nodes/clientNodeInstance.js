'use strict';

const coap = require('coap');
const EventEmitter = require('events');
const { ObjectInstance } = require('./objectInstance.js');
const { Resource } = require('./resourceInstance.js');
const { Lwm2m } = require('../../index.js');

const getDictionaryByValue = Lwm2m.TLV.getDictionaryByValue;
const DATE = new Date();
const LWM2M_VERSION = '1.0';

coap.registerFormat('application/vnd.oma.lwm2m+tlv', 11542);

function getIndexByValue(dictionaryList, key, value) {
  // Return dictionary list index of dictionary that has 'key' with matching 'value'
  for (let index = 0; index < dictionaryList.length; index += 1) {
    if (dictionaryList[key] === value) {
      return index;
    }
  }
  return -1;
}

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
    this.objects = [];
    this._objects = []; // Hidden objects
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

  getObject(objectID, hidden) {
    const objects = hidden ? this._objects : this.objects;

    return getDictionaryByValue(objects, 'identifier', objectID);
  }

  getObjectInstance(objectID, objectInstanceID, hidden) {
    const object = this.getObject(objectID, hidden);

    return getDictionaryByValue(object.objectInstances, 'identifier', objectInstanceID);
  }

  getResource(objectID, objectInstanceID, resourceID, hidden) {
    const objectInstance = this.getObjectInstance(objectID, objectInstanceID, hidden);

    return objectInstance.getResource(resourceID);
  }

  createObjectInstance(objectID, hidden) {
    const objects = hidden ? this._objects : this.objects;
    let object = this.getObject(objectID);
    let newObjectInstance;

    if (object === undefined) {
      objects.push({
        identifier: objectID,
        objectInstances: [],
      });

      object = objects[objects.length - 1];
    }

    newObjectInstance = new ObjectInstance({
      identifier: object.objectInstances.length,
      hidden: hidden,
    });

    object.objectInstances.push(newObjectInstance);

    return newObjectInstance;
  }

  getObjectInstancesList() {
    const objectInstancesList = [];
    let object;

    for(let objectIndex = 0; objectIndex < this.objects.length; objectIndex += 1) {
      object = this.objects[objectIndex];
      for(let objectInstance = 0; objectInstance < object.objectInstances.length; objectInstance += 1) {
        objectInstancesList.push(`</${object.identifier}/${objectInstance}>`);
      }
    }

    return objectInstancesList;
  }

  initiateSecurityObject(serverURI, clientPSK = null, publicKey = null, serverRPK = null, secretKey = null) {
    const newSecurityObject = this.createObjectInstance(0, true);
    // LwM2M Server URI
    newSecurityObject.createResource({
      identifier: 0,
      type: Lwm2m.TLV.RESOURCE_TYPE.STRING,
      value: serverURI,
    });
    // Bootstrap Server
    newSecurityObject.createResource({
      identifier: 1,
      type: Lwm2m.TLV.RESOURCE_TYPE.BOOLEAN,
      value: false,
    });
    // Security Mode (0-4). 3 if NoSec, 0 if PSK
    newSecurityObject.createResource({
      identifier: 2,
      type: Lwm2m.TLV.RESOURCE_TYPE.INTEGER,
      value: (clientPSK === null ? 3 : 0),
    });
    // Public Key or Identity
    newSecurityObject.createResource({
      identifier: 3,
      type: Lwm2m.TLV.RESOURCE_TYPE.OPAQUE,
      value: publicKey,
    });
    // Server Public Key
    newSecurityObject.createResource({
      identifier: 4,
      type: Lwm2m.TLV.RESOURCE_TYPE.OPAQUE,
      value: serverRPK,
    });
    // Secret Key
    newSecurityObject.createResource({
      identifier: 5,
      type: Lwm2m.TLV.RESOURCE_TYPE.OPAQUE,
      value: secretKey,
    });
  }

  initiateServerObject(lifetime, queueMode, minimumPeriod = 0, maximumPeriod = 60) {
    const newServerObject = this.createObjectInstance(1);
    let bindingMode = 'U';
    bindingMode += queueMode ? 'Q' : '';

    // Short Server ID
    newServerObject.createResource({
      identifier: 0,
      type: Lwm2m.TLV.RESOURCE_TYPE.INTEGER,
      value: 1,
      permissions: 'R',
    });
    // Lifetime
    newServerObject.createResource({
      identifier: 1,
      type: Lwm2m.TLV.RESOURCE_TYPE.INTEGER,
      value: lifetime,
      permissions: 'RW',
    });
    // Default Minimum Period
    newServerObject.createResource({
      identifier: 2,
      type: Lwm2m.TLV.RESOURCE_TYPE.INTEGER,
      value: minimumPeriod,
      permissions: 'RW',
    });
    // Default Maximum Period
    newServerObject.createResource({
      identifier: 3,
      type: Lwm2m.TLV.RESOURCE_TYPE.INTEGER,
      value: maximumPeriod,
      permissions: 'RW',
    });
    // Notification Storing When Disabled or Offline
    newServerObject.createResource({
      identifier: 6,
      type: Lwm2m.TLV.RESOURCE_TYPE.BOOLEAN,
      value: true,
      permissions: 'RW',
    });
    // Binding
    newServerObject.createResource({
      identifier: 7,
      type: Lwm2m.TLV.RESOURCE_TYPE.STRING,
      value: bindingMode,
      permissions: 'RW',
    });
    // Registration Update Trigger
    newServerObject.createResource({
      identifier: 8,
      type: Lwm2m.TLV.RESOURCE_TYPE.NONE,
      value: () => {
        this.updateHandle();
      },
      permissions: 'E',
    });
  }

  initiateAccessControlObject() {
    const newAccessControlObject = this.createObjectInstance(2);
  }

  initiateDeviceObject(manufacturer, model, queueMode) {
    const newDeviceObject = this.createObjectInstance(3);
    let bindingMode = 'U';

    bindingMode += queueMode ? 'Q' : '';

    newDeviceObject.createResource({
      identifier: 0,
      type: Lwm2m.TLV.RESOURCE_TYPE.STRING,
      value: manufacturer,
      permissions: 'R',
    });
    newDeviceObject.createResource({
      identifier: 1,
      type: Lwm2m.TLV.RESOURCE_TYPE.STRING,
      value: model,
      permissions: 'R',
    });
    newDeviceObject.createResource({
      identifier: 16,
      type: Lwm2m.TLV.RESOURCE_TYPE.STRING,
      value: bindingMode,
      permissions: 'R',
    });
  }

  initiateConnectivityMonitoringObject() {
    const newConnectivityMonitoringObject = this.createObjectInstance(4);
  }

  initiateFirmwareObject() {
    const newFirmwareObject = this.createObjectInstance(5);
  }

  initiateLocationObject() {
    const newLocationObject = this.createObjectInstance(6);
  }

  initiateConnectivityStatisticsObject() {
    const newConnectivityStatisticsObject = this.createObjectInstance(7);
  }

  requestGet(response, addressArray, observation) {
    let object;
    let decodedObject
    let objectInstance;
    let decodedObjectInstance
    let resource;
    let decodedResource;
    let resourceInstance;
    let decodedResourceInstance;
    let responsePayload;

    response._packet.ack = true;

    switch (addressArray.length) {
      case 1: {
        object = this.getObject(addressArray[0]);
        if (object === undefined) {
          response.statusCode = '4.04';
          break;
        }

        response.write(Lwm2m.TLV.encodeObject(object));
        response.statusCode = '2.05';
        break;
      } 
      case 2: {
        objectInstance = this.getObjectInstance(addressArray[0], addressArray[1]);
        if (objectInstance === undefined) {
          response.statusCode = '4.04';
          break;
        }

        response.write(Lwm2m.TLV.encodeObjectInstance(objectInstance));
        response.statusCode = '2.05';
        break;
      } 
      case 3: {
        resource = this.getResource(addressArray[0], addressArray[1], addressArray[2]);
        if (resource === undefined) {
          response.statusCode = '4.04';
          break;
        }

        response.write(Lwm2m.TLV.encodeResource(resource));
        response.statusCode = '2.05';
        break;
      } 
      case 4: {
        resource = this.getResource(addressArray[0], addressArray[1], addressArray[2]);
        if (resource === undefined) {
          response.statusCode = '4.04';
          break;
        }

        response.write(Lwm2m.TLV.encodeResourceInstance({
          type: resource.type,
          identifier: addressArray[3],
          value: resource.value[addressArray[3]],
        }));
        response.statusCode = '2.05';
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

  putResourceInstance(resource, description) {
    if (!(resource instanceof Resource)) {
      return '4.04'
    }

    if (!(resource.value instanceof Array)) {
      return '4.04'
    }

    if (resource.value.length <= description.identifier) {
      return '4.04'
    }

    if (resource.type !== description.type) {
      throw Error('Resource type mismatch on write');
    }

    resource[description.identifier] = description.value;

    return '2.04';
  }

  putResource(resource, description) {
    if (!(resource instanceof Resource)) {
      return '4.04'
    }

    if (resource.identifier !== description.identifier) {
      throw Error('Resource identifier mismatch on write');
    }

    if (resource.type !== description.type) {
      throw Error('Resource type mismatch on write');
    }

    return resource.writeValue(description.value);
  }

  putObjectInstance(objectInstance, description) {
    let resource;
    let responseCode;

    if (!(objectInstance instanceof ObjectInstance)) {
      return '4.04';
    }

    if (objectInstance.identifier !== description.identifier) {
      throw Error('Object instance identifier mismatch on write');
    }

    for (let index = 0; index < objectInstance.resources.length; index += 1) {
      resource = objectInstance.getResource(objectInstance.resources[index].identifier);

      responseCode = putResource(resource, objectInstance.resources[index])
      if (responseCode !== '2.04') {
        return responseCode;
      }
    }
    return '2.04'
  }

  putObject(object, description) {
    let objectInstance;
    let responseCode;

    if (object === undefined) {
      return '4.04'
    }

    if (object.identifier !== description.identifier) {
      throw Error('Object identifier mismatch on write');
    }

    for (let index = 0; index < object.objectInstances.length; index += 1) {
      objectInstance = this.getObjectInstance(object.identifier, index);
      responseCode = putObjectInstance(objectInstance, object.objectInstances[index])
      if (responseCode !== '2.04') {
        return responseCode;
      }
    }
    return '2.04'
  }

  requestPut(response, addressArray, payload) {
    let object;
    let decodedObject
    let objectInstance;
    let decodedObjectInstance
    let resource;
    let decodedResource;
    let resourceInstance;
    let decodedResourceInstance;

    response._packet.ack = true;

    switch (addressArray.length) {
      case 1: {
        object = this.getObject(addressArray[0]);
        decodedObject = Lwm2m.TLV.decodeObject(payload, object);

        response.statusCode = this.putObject(object, decodedObject);
        break;
      }
      case 2: {
        objectInstance = this.getObjectInstance(addressArray[0], addressArray[1]);
        decodedObjectInstance = Lwm2m.TLV.decodeObjectInstance(payload, objectInstance);

        response.statusCode = this.putObjectInstance(objectInstance, decodedObjectInstance);
        break;
      }
      case 3: {
        resource = this.getResource(addressArray[0], addressArray[1], addressArray[2]);
        decodedResource = Lwm2m.TLV.decodeResource(payload, resource);

        response.statusCode = this.putResource(resource, decodedResource);
        break;
      }
      case 4: {
        resource = this.getResource(addressArray[0], addressArray[1], addressArray[2]);
        decodedResourceInstance = Lwm2m.TLV.decodeResourceInstance(payload, resource);

        response.statusCode = this.putResourceInstance(resource, decodedResourceInstance);
        break;
      }
      default: {
        response.statusCode = '4.00';
      }
    }
    response.end()
  }

  requestPost(response, addressArray) {
    let resource;

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
        resource = this.getResource(addressArray[0], addressArray[1], addressArray[2]);

        response.statusCode = resource.execute();
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
    // TODO: Add handles for resource deletion
    response.end()
  }

  getQueryString() {
    return [
      `ep=${this.endpointClientName}`,
      `lt=${this.getResource(1, 0, 1).value}`,
      `lwm2m=${LWM2M_VERSION}`,
      `b=${this.getResource(1, 0, 7).value}`,
      `et=${this.getResource(3, 0, 1).value}`,
    ].join('&');
  }

  update(updatesPath, updateLifetime = false, updateBinding = false) {
    return new Promise((updated, failed) => {
      const updateOptions = Object.assign({}, this.requestOptions);
      const queryOptions = [];
      updateOptions.pathname = updatesPath;

      if (updateLifetime) {
        queryOptions.push(`lt=${this.getResource(1, 0, 1).value}`);
      }

      if (updateBinding) {
        queryOptions.push(`b=${this.getResource(1, 0, 7).value}`);
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

  updateHandle(updatesPath) {
    if (updatesPath === undefined) {
      for (let path in this.updatesIterator) {
        this.update(path)
        .catch((error) => {
          this.emit('update-failed', error, path);
        });
      }
    } else {
      this.update(updatesPath)
      .catch((error) => {
        this.emit('update-failed', error, updatesPath);
      });
    }
  }

  startObservation(addressArray, notification) {
    const objectInstance = addressArray.slice(0, 2).join('/');
    let resource;

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
        // TODO: Add handles for objects observation
        break;
      } 
      case 2: {
        // TODO: Add handles for object instances observation
        break;
      } 
      case 3: {
        resource = this.getResource(addressArray[0], addressArray[1], addressArray[2]);

        function changeListener() {
          if (this.observedResources[addressArray.join('/')] instanceof Interval) {
            this.observedResources[addressArray.join('/')].skip();
          }
        };

        if (
          this.observedResources[addressArray.join('/')] === undefined
          && resource instanceof Resource
        ) {
          this.observedResources[addressArray.join('/')] = new Interval(() => {
            notification.write(Lwm2m.TLV.encodeResource(resource));
          }, this.getResource(1, 0, 3).value * 1000 );

          if (resource.notifyOnChange) {
            resource.on('change', changeListener);
          }
        }

        break;
      }
      case 4: {
        // TODO: Add handles for resource instances observation
        break;
      }
      default: {
        // TODO: Add handle for bad observation requests
      }
    }
  }

  stopObservation(addressArray) {
    switch (addressArray.length) {
      case 1: {
        // TODO: Add handles for objects observation cancelling
        break;
      } 
      case 2: {
        // TODO: Add handles for object instances observation cancelling
        break;
      } 
      case 3: {
        resource = this.getResource(addressArray[0], addressArray[1], addressArray[2]);

        this.observedResources[addressArray.join('/')].stop();
        delete this.observedResources[addressArray.join('/')];
        break;
      } 
      case 4: {
        // TODO: Add handles for resource instances observation cancelling
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

  deregistrationHandle(updatesPath) {
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
          this.deregistrationHandle(updatesPath);
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
            }, this.getResource(1, 0, 1).value);
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
        addressArray.push(Number(request.options[i].value));
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

    if (request.headers['Observe'] === 0) {
      this.startObservation(addressArray, response);
    } else if (request.headers['Observe'] === 1) {
      this.stopObservation(addressArray);
    }
  }
}

module.exports = ClientNodeInstance;

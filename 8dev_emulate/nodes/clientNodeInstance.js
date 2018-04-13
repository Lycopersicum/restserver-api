const coap = require('coap');
const EventEmitter = require('events');
const { ObjectInstance } = require('./objectInstance.js');
const { Resource } = require('./resourceInstance.js');
const { TLV } = require('../../lwm2m/index.js');

const { getDictionaryByValue } = TLV;
const LWM2M_VERSION = '1.0';

coap.registerFormat('application/vnd.oma.lwm2m+tlv', 11542);

function Interval(callback, delay) {
  let iterator = setInterval(callback, delay);

  this.stop = function () {
    if (iterator) {
      clearInterval(iterator);
      iterator = null;
    }
    return this;
  };

  this.start = function () {
    if (!iterator) {
      this.stop();
      iterator = setInterval(callback, delay);
    }
    return this;
  };

  this.reset = function (newDelay) {
    delay = newDelay !== undefined ? newDelay : delay; // eslint-disable-line no-param-reassign
    return this.stop().start();
  };

  this.skip = function (newDelay) {
    callback();
    return this.reset(newDelay);
  };
}

function putResourceInstance(resourceObject, description) {
  const resource = resourceObject;

  if (!(resource instanceof Resource)) {
    return '4.04';
  }

  if (!(resource.value instanceof Array)) {
    return '4.04';
  }

  if (resource.value.length <= description.identifier) {
    return '4.04';
  }

  if (resource.type !== description.type) {
    throw Error('Resource type mismatch on write');
  }

  resource[description.identifier] = description.value;

  return '2.04';
}

function putResource(resource, description) {
  if (!(resource instanceof Resource)) {
    return '4.04';
  }

  if (resource.identifier !== description.identifier) {
    throw Error('Resource identifier mismatch on write');
  }

  if (resource.type !== description.type) {
    throw Error('Resource type mismatch on write');
  }

  return resource.writeValue(description.value);
}

function putObjectInstance(objectInstance, description) {
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

    responseCode = putResource(resource, objectInstance.resources[index]);
    if (responseCode !== '2.04') {
      return responseCode;
    }
  }
  return '2.04';
}

class ClientNodeInstance extends EventEmitter {
  constructor(lifetime, manufacturer, model, queueMode, endpointClientName, serverURI, clientPort) {
    super();

    this._state = 'stopped'; // eslint-disable-line no-underscore-dangle
    this.objects = [];
    this._objects = []; // eslint-disable-line no-underscore-dangle
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
    this.coapAgent = new coap.Agent({
      type: 'udp6',
      socket: this.coapServer._sock, // eslint-disable-line no-underscore-dangle
    });
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

  get state() { return this._state; } // eslint-disable-line no-underscore-dangle

  set state(state) {
    if (
      (this._state !== state) // eslint-disable-line no-underscore-dangle
      && (
        (this._state !== 'stopped') // eslint-disable-line no-underscore-dangle
        || (state === 'started'))
    ) {
      this._state = state; // eslint-disable-line no-underscore-dangle
      this.emit('state-change', state);
    }
  }

  getObject(objectID, hidden) {
    const objects = hidden
      ? this._objects // eslint-disable-line no-underscore-dangle
      : this.objects;

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
    const objects = hidden
      ? this._objects // eslint-disable-line no-underscore-dangle
      : this.objects;
    let object = this.getObject(objectID, hidden);

    if (object === undefined) {
      objects.push({
        identifier: objectID,
        objectInstances: [],
      });

      object = objects[objects.length - 1];
    }
    const newObjectInstance = new ObjectInstance({
      identifier: object.objectInstances.length,
      hidden,
    });

    object.objectInstances.push(newObjectInstance);

    return newObjectInstance;
  }

  getObjectInstancesList() {
    const objectInstancesList = [];
    let object;

    for (let objectIndex = 0; objectIndex < this.objects.length; objectIndex += 1) {
      object = this.objects[objectIndex];
      for (
        let objectInstance = 0;
        objectInstance < object.objectInstances.length;
        objectInstance += 1
      ) {
        objectInstancesList.push(`</${object.identifier}/${objectInstance}>`);
      }
    }

    return objectInstancesList;
  }

  initiateSecurityObject(
    serverURI,
    clientPSK = null,
    publicKey = null,
    serverRPK = null,
    secretKey = null,
  ) {
    const newSecurityObject = this.createObjectInstance(0, true);
    // LwM2M Server URI
    newSecurityObject.createResource({
      identifier: 0,
      type: TLV.RESOURCE_TYPE.STRING,
      value: serverURI,
    });
    // Bootstrap Server
    newSecurityObject.createResource({
      identifier: 1,
      type: TLV.RESOURCE_TYPE.BOOLEAN,
      value: false,
    });
    // Security Mode (0-4). 3 if NoSec, 0 if PSK
    newSecurityObject.createResource({
      identifier: 2,
      type: TLV.RESOURCE_TYPE.INTEGER,
      value: (clientPSK === null ? 3 : 0),
    });
    // Public Key or Identity
    newSecurityObject.createResource({
      identifier: 3,
      type: TLV.RESOURCE_TYPE.OPAQUE,
      value: publicKey,
    });
    // Server Public Key
    newSecurityObject.createResource({
      identifier: 4,
      type: TLV.RESOURCE_TYPE.OPAQUE,
      value: serverRPK,
    });
    // Secret Key
    newSecurityObject.createResource({
      identifier: 5,
      type: TLV.RESOURCE_TYPE.OPAQUE,
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
      type: TLV.RESOURCE_TYPE.INTEGER,
      value: 1,
      permissions: 'R',
    });
    // Lifetime
    newServerObject.createResource({
      identifier: 1,
      type: TLV.RESOURCE_TYPE.INTEGER,
      value: lifetime,
      permissions: 'RW',
    });
    // Default Minimum Period
    newServerObject.createResource({
      identifier: 2,
      type: TLV.RESOURCE_TYPE.INTEGER,
      value: minimumPeriod,
      permissions: 'RW',
    });
    // Default Maximum Period
    newServerObject.createResource({
      identifier: 3,
      type: TLV.RESOURCE_TYPE.INTEGER,
      value: maximumPeriod,
      permissions: 'RW',
    });
    // Notification Storing When Disabled or Offline
    newServerObject.createResource({
      identifier: 6,
      type: TLV.RESOURCE_TYPE.BOOLEAN,
      value: true,
      permissions: 'RW',
    });
    // Binding
    newServerObject.createResource({
      identifier: 7,
      type: TLV.RESOURCE_TYPE.STRING,
      value: bindingMode,
      permissions: 'RW',
    });
    // Registration Update Trigger
    newServerObject.createResource({
      identifier: 8,
      type: TLV.RESOURCE_TYPE.NONE,
      value: () => {
        this.updateHandle();
      },
      permissions: 'E',
    });
  }

  initiateAccessControlObject() {
    this.createObjectInstance(2);
  }

  initiateDeviceObject(manufacturer, model, queueMode) {
    const newDeviceObject = this.createObjectInstance(3);
    let bindingMode = 'U';

    bindingMode += queueMode ? 'Q' : '';

    newDeviceObject.createResource({
      identifier: 0,
      type: TLV.RESOURCE_TYPE.STRING,
      value: manufacturer,
      permissions: 'R',
    });
    newDeviceObject.createResource({
      identifier: 1,
      type: TLV.RESOURCE_TYPE.STRING,
      value: model,
      permissions: 'R',
    });
    newDeviceObject.createResource({
      identifier: 16,
      type: TLV.RESOURCE_TYPE.STRING,
      value: bindingMode,
      permissions: 'R',
    });
  }

  initiateConnectivityMonitoringObject() {
    this.createObjectInstance(4);
  }

  initiateFirmwareObject() {
    this.createObjectInstance(5);
  }

  initiateLocationObject() {
    this.createObjectInstance(6);
  }

  initiateConnectivityStatisticsObject() {
    this.createObjectInstance(7);
  }

  requestGet(response, addressArray, observation) {
    let object;
    let objectInstance;
    let resource;

    response._packet.ack = true; // eslint-disable-line no-underscore-dangle

    switch (addressArray.length) {
      case 1: {
        object = this.getObject(addressArray[0]);
        if (object === undefined) {
          response.statusCode = '4.04';
          break;
        }

        response.write(TLV.encodeObject(object));
        response.statusCode = '2.05';
        break;
      }
      case 2: {
        objectInstance = this.getObjectInstance(addressArray[0], addressArray[1]);
        if (objectInstance === undefined) {
          response.statusCode = '4.04';
          break;
        }

        response.write(TLV.encodeObjectInstance(objectInstance));
        response.statusCode = '2.05';
        break;
      }
      case 3: {
        resource = this.getResource(addressArray[0], addressArray[1], addressArray[2]);
        if (resource === undefined) {
          response.statusCode = '4.04';
          break;
        }

        response.write(TLV.encodeResource(resource));
        response.statusCode = '2.05';
        break;
      }
      case 4: {
        resource = this.getResource(addressArray[0], addressArray[1], addressArray[2]);
        if (resource === undefined) {
          response.statusCode = '4.04';
          break;
        }

        response.write(TLV.encodeResourceInstance({
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


  putObject(object, description) {
    let objectInstance;
    let responseCode;

    if (object === undefined) {
      return '4.04';
    }

    if (object.identifier !== description.identifier) {
      throw Error('Object identifier mismatch on write');
    }

    for (let index = 0; index < object.objectInstances.length; index += 1) {
      objectInstance = this.getObjectInstance(object.identifier, index);
      responseCode = putObjectInstance(objectInstance, object.objectInstances[index]);
      if (responseCode !== '2.04') {
        return responseCode;
      }
    }
    return '2.04';
  }

  requestPut(response, addressArray, payload) {
    let object;
    let decodedObject;
    let objectInstance;
    let decodedObjectInstance;
    let resource;
    let decodedResource;
    let decodedResourceInstance;

    response._packet.ack = true; // eslint-disable-line no-underscore-dangle

    switch (addressArray.length) {
      case 1: {
        object = this.getObject(addressArray[0]);
        decodedObject = TLV.decodeObject(payload, object);

        response.statusCode = this.putObject(object, decodedObject);
        break;
      }
      case 2: {
        objectInstance = this.getObjectInstance(addressArray[0], addressArray[1]);
        decodedObjectInstance = TLV.decodeObjectInstance(payload, objectInstance);

        response.statusCode = this.putObjectInstance(objectInstance, decodedObjectInstance);
        break;
      }
      case 3: {
        resource = this.getResource(addressArray[0], addressArray[1], addressArray[2]);
        decodedResource = TLV.decodeResource(payload, resource);

        response.statusCode = putResource(resource, decodedResource);
        break;
      }
      case 4: {
        resource = this.getResource(addressArray[0], addressArray[1], addressArray[2]);
        decodedResourceInstance = TLV.decodeResourceInstance(payload, resource);

        response.statusCode = putResourceInstance(resource, decodedResourceInstance);
        break;
      }
      default: {
        response.statusCode = '4.00';
      }
    }
    response.end();
  }

  requestPost(response, addressArray) {
    let resource;

    response._packet.ack = true; // eslint-disable-line no-underscore-dangle

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
    response.end();
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
        this.emit('update-failed', error, updatesPath);
        failed(error);
      });

      request.on('timeout', (error) => {
        this.emit('update-failed', error, updatesPath);
        failed(error);
      });

      request.end();
    });
  }

  startUpdates(updatesPath) {
    this.coapServer.listen(this.listeningPort, () => {
      this.updatesIterator[updatesPath] = new Interval(() => {
        this.update(updatesPath);
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
    const updatedPaths = Object.keys(this.updatesIterator);
    let path;

    if (updatesPath === undefined) {
      for (let index = 0; index < updatedPaths.length; index += 1) {
        path = updatedPaths[index];

        this.update(path)
          .catch(this.updateFailed);
      }
    } else {
      this.update(updatesPath);
    }
  }

  startObservation(addressArray, response) {
    const notification = response;
    let resource;

    notification._packet.ack = false; // eslint-disable-line no-underscore-dangle
    notification._packet.confirmable = true; // eslint-disable-line no-underscore-dangle

    notification.on('error', () => {
      // TODO: Find better way to handle notification timeouts
      if (this.observedResources[addressArray.join('/')] !== undefined) {
        this.stopObservation(addressArray);
      }
    });

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

        if (
          this.observedResources[addressArray.join('/')] === undefined
          && resource instanceof Resource
        ) {
          this.observedResources[addressArray.join('/')] = new Interval(() => {
            notification.write(TLV.encodeResource(resource));
          }, this.getResource(1, 0, 3).value * 1000);

          if (resource.notifyOnChange) {
            resource.on('change', () => {
              if (this.observedResources[addressArray.join('/')] instanceof Interval) {
                this.observedResources[addressArray.join('/')].skip();
              }
            });
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
    const observedResources = Object.keys(this.observedResource);

    for (let index = 0; index < observedResources.length; index += 1) {
      this.stopObservation(observedResources[index].split('/'));
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
          this.startRegistration();
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
        this.requestGet(response, addressArray, request.headers.Observe);
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
      default: {
        // TODO: Implement switch statement default case
      }
    }

    if (request.headers.Observe === 0) {
      this.startObservation(addressArray, response);
    } else if (request.headers.Observe === 1) {
      this.stopObservation(addressArray);
    }
  }
}

module.exports = ClientNodeInstance;

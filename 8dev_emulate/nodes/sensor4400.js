'use strict';

const crypto = require('crypto');
const ClientNode = require('./clientNodeInstance.js');
const { RESOURCE_TYPE } = require('./resourceInstance.js');

function randomNumber(bytesQuantity) {
  const randomBytes = crypto.randomBytes(bytesQuantity);
  return parseInt(randomBytes.toString('hex'), 16);
}

function random(low, high) {
  let lowerBoundary = low;
  let higherBoundary = high;
  let temporaryLow;
  let requiredBytes = 1;
  if (lowerBoundary > higherBoundary) {
    temporaryLow = lowerBoundary;
    lowerBoundary = higherBoundary;
    higherBoundary = temporaryLow;
  }
  while (higherBoundary - lowerBoundary > 2 ** (requiredBytes - 1)) {
    requiredBytes += 1;
  }
  return (randomNumber(requiredBytes) % (higherBoundary - lowerBoundary)) + lowerBoundary;
}

class Sensor4400 extends ClientNode {
  constructor(lifetime, UUID, serverIP, clientPort) {
    super(lifetime, '8devices', '8dev_4400', true, UUID, serverIP, clientPort);
    this.objects['/3/0'].addResource(7, 'R', RESOURCE_TYPE.INTEGER, 3300, this.powerSourceVoltageHandler);
  }

  powerSourceVoltageHandler() {
    return random(3200, 3400);
  }
}

const sen1 = new Sensor4400(600, 'clientOne', '::1', 5685);
sen1.register(() => {});

process.on('SIGINT', () => {
  sen1.deregister(() => {
    process.exit(0);
  });
});

module.exports = Sensor4400;

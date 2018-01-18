'use strict';

const ClientNode = require('./clientNodeInstance.js');
const { RESOURCE_TYPE } = require('./resourceInstance.js');

function randomFloat(min, max) {
  return (Math.random() * (max - min)) + min;
}

function randomInteger(min, max) {
  return Math.floor(randomFloat(Math.ceil(min), Math.floor(max)));
}

function powerSourceVoltageHandler(averageVoltage = 3300, fluctuation = 0.005) {
  const fluctuationMin = averageVoltage * (1 - fluctuation);
  const fluctuationMax = averageVoltage * (1 + fluctuation);
  return randomInteger(fluctuationMin, fluctuationMax);
}

function temperatureSensorHandler(averageTemperature = 20, fluctuation = 0.025) {
  const fluctuationMin = averageTemperature * (1 - fluctuation);
  const fluctuationMax = averageTemperature * (1 + fluctuation);
  return randomFloat(fluctuationMin, fluctuationMax);
}

class Sensor3700 extends ClientNode {
  constructor(lifetime, UUID, serverIP, clientPort) {
    super(lifetime, '8devices', '8dev_3700', true, UUID, serverIP, clientPort);

    this.objects['/3/0'].addResource(7, 'R', RESOURCE_TYPE.INTEGER, 3300, powerSourceVoltageHandler);
  }
}

class Sensor3800 extends ClientNode {
  constructor(lifetime, UUID, serverIP, clientPort) {
    super(lifetime, '8devices', '8dev_3800', true, UUID, serverIP, clientPort);

    this.objects['/3/0'].addResource(7, 'R', RESOURCE_TYPE.INTEGER, 3300, powerSourceVoltageHandler);
  }
}

class Sensor4400 extends ClientNode {
  constructor(lifetime, UUID, serverIP, clientPort) {
    super(lifetime, '8devices', '8dev_4400', true, UUID, serverIP, clientPort);

    this.createObject(3200, 0);
    this.createObject(3303, 0);

    this.objects['/3/0'].addResource(7, 'R', RESOURCE_TYPE.INTEGER, 3300, powerSourceVoltageHandler);
    this.objects['/3200/0'].addResource(5500, 'R', RESOURCE_TYPE.BOOLEAN, false);
    this.objects['/3200/0'].addResource(5501, 'R', RESOURCE_TYPE.INTEGER, 0);
    this.objects['/3303/0'].addResource(5700, 'R', RESOURCE_TYPE.FLOAT, 20.0, temperatureSensorHandler);
  }

  hallSensorTrigger() {
    const that = this;
    this.objects['/3200/0'].getResourceValue(5500, (hallSensorValue) => {
      that.objects['/3200/0'].writeResource(5500, !hallSensorValue, true);
      that.objects['/3200/0'].getResourceValue(5501, (hallSensorCounterValue) => {
        that.objects['/3200/0'].writeResource(5501, (hallSensorCounterValue + 1) % (2 ** 31), true);
      });
    });
  }
}

class Sensor4500 extends ClientNode {
  constructor(lifetime, UUID, serverIP, clientPort) {
    super(lifetime, '8devices', '8dev_4500', true, UUID, serverIP, clientPort);

    this.objects['/3/0'].addResource(7, 'R', RESOURCE_TYPE.INTEGER, 3300, powerSourceVoltageHandler);
  }
}

module.exports = {
  Sensor3700,
  Sensor3800,
  Sensor4400,
  Sensor4500,
};

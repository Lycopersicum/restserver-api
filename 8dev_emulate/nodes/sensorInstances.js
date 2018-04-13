const ClientNode = require('./clientNodeInstance.js');
const { TLV } = require('../../lwm2m/index.js');

const { RESOURCE_TYPE } = TLV;

function randomFloat(min, max) {
  return (Math.random() * (max - min)) + min;
}

function randomInteger(min, max) {
  return Math.floor(randomFloat(Math.ceil(min), Math.floor(max)));
}

function powerSourceVoltageHandle(averageVoltage = 3300, fluctuation = 0.005) {
  const fluctuationMin = averageVoltage * (1 - fluctuation);
  const fluctuationMax = averageVoltage * (1 + fluctuation);
  return randomInteger(fluctuationMin, fluctuationMax);
}

function analogInputCurrentHandle() {
  return randomFloat(0, 3333);
}

function temperatureSensorHandle(averageTemperature = 20, fluctuation = 0.025) {
  const fluctuationMin = averageTemperature * (1 - fluctuation);
  const fluctuationMax = averageTemperature * (1 + fluctuation);
  return randomFloat(fluctuationMin, fluctuationMax);
}

function humiditySensorHandle(averageHumidity = 70, fluctuation = 0.05) {
  const fluctuationMin = averageHumidity * (1 - fluctuation);
  const fluctuationMax = averageHumidity * (1 + fluctuation);
  return randomFloat(fluctuationMin, fluctuationMax);
}

class Sensor3700 extends ClientNode {
  constructor(lifetime, UUID, serverIP, clientPort) {
    super(lifetime, '8devices', '8dev_3700', true, UUID, serverIP, clientPort);

    this.initialisePowerSourceVoltageResource();
    this.initialisePowerMeasurementObject();
    this.initialisePowerControlObject();

    this.timeInitialisation = new Date().getTime();
  }

  initialisePowerSourceVoltageResource() {
    const deviceObject = this.getObjectInstance(3, 0);

    deviceObject.createResource({
      identifier: 7,
      permissions: 'R',
      type: RESOURCE_TYPE.INTEGER,
      value: 3300,
      handle: powerSourceVoltageHandle,
    });
  }

  initialisePowerMeasurementObject() {
    const powerMeasurementObject = this.createObjectInstance(3305);

    this.activePower = powerMeasurementObject.createResource({
      identifier: 5800,
      permissions: 'R',
      type: RESOURCE_TYPE.FLOAT,
      value: 0.0,
      handle: () => this.instantaneousActivePowerHandle(),
    });

    this.activeEnergy = powerMeasurementObject.createResource({
      identifier: 5805,
      permissions: 'R',
      type: RESOURCE_TYPE.FLOAT,
      value: 0.0,
    });

    this.reactivePower = powerMeasurementObject.createResource({
      identifier: 5810,
      permissions: 'R',
      type: RESOURCE_TYPE.FLOAT,
      value: 0.0,
      handle: () => this.instantaneousReactivePowerHandle(),
    });

    this.reactiveEnergy = powerMeasurementObject.createResource({
      identifier: 5815,
      permissions: 'R',
      type: RESOURCE_TYPE.FLOAT,
      value: 0.0,
    });

    this.activePower.on('change', (currentActivePower) => {
      this.activeEnergy.value = ( // eslint-disable-line no-bitwise
        (currentActivePower / 36000)
        + this.activeEnergy.value
      ) & 0x7FFFFFFF;
    });

    this.reactivePower.on('change', (currentReactivePower) => {
      this.reactiveEnergy.value = ( // eslint-disable-line no-bitwise
        (currentReactivePower / 36000)
        + this.reactiveEnergy.value
      ) & 0x7FFFFFFF;
    });
  }

  initialisePowerControlObject() {
    const powerControlObject = this.createObjectInstance(3312);

    this.relayState = powerControlObject.createResource({
      identifier: 5850,
      permissions: 'RW',
      type: RESOURCE_TYPE.BOOLEAN,
      value: false,
      notifyOnChange: true,
    });
  }

  instantaneousActivePowerHandle() {
    const timeNow = new Date().getTime() - this.timeInitialisation;

    if (this.relayState.value === false) {
      return 0;
    }

    return Math.abs(Math.cos(timeNow) * 1000 * Math.cos(timeNow / 20000));
  }

  instantaneousReactivePowerHandle() {
    const timeNow = new Date().getTime() - this.timeInitialisation;

    if (this.relayState.value === false) {
      return 0;
    }

    return Math.abs(Math.sin(timeNow) * 400 * Math.cos(timeNow / 20000));
  }
}

class Sensor3800 extends ClientNode {
  constructor(lifetime, UUID, serverIP, clientPort) {
    super(lifetime, '8devices', '8dev_3800', true, UUID, serverIP, clientPort);

    this.initialisePowerSourceVoltageResource();
    this.initialiseTemperatureSensorObject();
    this.initialiseHumiditySensorObject();
  }

  initialisePowerSourceVoltageResource() {
    const deviceObject = this.getObjectInstance(3, 0);

    deviceObject.createResource({
      identifier: 7,
      permissions: 'R',
      type: RESOURCE_TYPE.INTEGER,
      value: 3300,
      handle: powerSourceVoltageHandle,
    });
  }

  initialiseTemperatureSensorObject() {
    const digitalInputObject = this.createObjectInstance(3303);

    digitalInputObject.createResource({
      identifier: 5700,
      permissions: 'R',
      type: RESOURCE_TYPE.FLOAT,
      value: 20.0,
      handle: temperatureSensorHandle,
    });
  }

  initialiseHumiditySensorObject() {
    const digitalInputObject = this.createObjectInstance(3304);

    digitalInputObject.createResource({
      identifier: 5700,
      permissions: 'R',
      type: RESOURCE_TYPE.FLOAT,
      value: 70.0,
      handle: humiditySensorHandle,
    });
  }
}

class Sensor4400 extends ClientNode {
  constructor(lifetime, UUID, serverIP, clientPort) {
    super(lifetime, '8devices', '8dev_4400', true, UUID, serverIP, clientPort);

    this.initialisePowerSourceVoltageResource();
    this.initialiseDigitalInputObject();
    this.initialiseTemperatureSensorObject();
  }

  hallSensorState(newState) {
    this.hallSensorState.value = newState;
  }

  hallSensorTrigger() {
    this.hallSensorState.value = !(this.hallSensorState.value);
  }

  initialisePowerSourceVoltageResource() {
    const deviceObject = this.getObjectInstance(3, 0);

    deviceObject.createResource({
      identifier: 7,
      permissions: 'R',
      type: RESOURCE_TYPE.INTEGER,
      value: 3300,
      handle: powerSourceVoltageHandle,
    });
  }

  initialiseDigitalInputObject() {
    const digitalInputObject = this.createObjectInstance(3200);

    this.hallSensorState = digitalInputObject.createResource({
      identifier: 5500,
      permissions: 'R',
      type: RESOURCE_TYPE.BOOLEAN,
      value: false,
      notifyOnChange: true,
    });

    this.hallSensorCounter = digitalInputObject.createResource({
      identifier: 5501,
      permissions: 'R',
      type: RESOURCE_TYPE.INTEGER,
      value: 0,
      notifyOnChange: true,
    });

    this.hallSensorState.on('change', () => {
      this.hallSensorCounter.value =
          (this.hallSensorCounter.value + 1) & 0x7FFFFFFF; // eslint-disable-line no-bitwise
    });
  }

  initialiseTemperatureSensorObject() {
    const digitalInputObject = this.createObjectInstance(3303);

    digitalInputObject.createResource({
      identifier: 5700,
      permissions: 'R',
      type: RESOURCE_TYPE.FLOAT,
      value: 20.0,
      handle: temperatureSensorHandle,
    });
  }
}

class Sensor4500 extends ClientNode {
  constructor(lifetime, UUID, serverIP, clientPort) {
    super(lifetime, '8devices', '8dev_4500', true, UUID, serverIP, clientPort);

    this.initialisePowerSourceVoltageResource();
    this.initialiseAnalogueInputOjbect();
  }

  initialisePowerSourceVoltageResource() {
    const deviceObject = this.getObjectInstance(3, 0);

    deviceObject.createResource({
      identifier: 7,
      permissions: 'R',
      type: RESOURCE_TYPE.INTEGER,
      value: 3300,
      handle: powerSourceVoltageHandle,
    });
  }

  initialiseAnalogueInputOjbect() {
    const analogueInputObject = this.createObjectInstance(3202);

    analogueInputObject.createResource({
      identifier: 5600,
      permissions: 'R',
      type: RESOURCE_TYPE.FLOAT,
      value: 20.0,
      handle: analogInputCurrentHandle,
    });
  }
}

module.exports = {
  Sensor3700,
  Sensor3800,
  Sensor4400,
  Sensor4500,
};

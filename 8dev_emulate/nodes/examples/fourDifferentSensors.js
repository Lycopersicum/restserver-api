const {
  Sensor3700,
  Sensor3800,
  Sensor4400,
  Sensor4500,
} = require('../sensorInstances.js');

const sen37 = new Sensor3700(600, 'threeSeven', '::1', 5687);
const sen38 = new Sensor3800(600, 'threeEight', '::1', 5688);
const sen44 = new Sensor4400(600, 'fourFour', '::1', 5684);
const sen441 = new Sensor4400(600, 'fourFour1', '::1', 5689);
const sen45 = new Sensor4500(600, 'fourFive', '::1', 5685);
sen44.start();
sen37.start();
sen38.start();
sen44.start();
sen441.start();
sen45.start();

sen44.on('error', console.log);
process.on('SIGINT', () => {
  process.exit(0);
});

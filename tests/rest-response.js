module.exports = {
  endpoints: [
    {
      name: 'threeEight', type: '8dev_3800', status: 'ACTIVE', q: true,
    },
    {
      name: 'fourFive', type: '8dev_4500', status: 'ACTIVE', q: true,
    },
    {
      name: 'threeSeven', type: '8dev_3700', status: 'ACTIVE', q: true,
    },
    {
      name: 'fourFour', type: '8dev_4400', status: 'ACTIVE', q: true,
    },
    {
      name: 'fourFour1', type: '8dev_4400', status: 'ACTIVE', q: true,
    },
  ],
  sensorObjects: [
    { uri: '/1/0' },
    { uri: '/2/0' },
    { uri: '/3/0' },
    { uri: '/4/0' },
    { uri: '/5/0' },
    { uri: '/6/0' },
    { uri: '/7/0' },
    { uri: '/3305/0' },
    { uri: '/3312/0' },
  ],
  request: {
    'async-response-id': '1521817656#367da52f-6d0c-8550-b218-571b',
  },
  notifications: {
    registrations: [
      { name: 'fourFive' },
      { name: 'fourFour1' },
      { name: 'fourFour' },
      { name: 'threeEight' },
      { name: 'threeSeven' },
    ],
    'reg-updates': [
      { name: 'fourFive' },
      { name: 'fourFour1' },
      { name: 'fourFour' },
      { name: 'threeEight' },
      { name: 'threeSeven' },
    ],
    'de-registrations': [
      { name: 'fourFive' },
      { name: 'fourFour1' },
      { name: 'fourFour' },
      { name: 'threeEight' },
      { name: 'threeSeven' },
    ],
    'async-responses': [
      {
        timestamp: 1400009933, id: '1521817656#367da52f-6d0c-8550-b218-571b', status: 200, payload: '5Ba3AAAAAA==',
      },
      {
        timestamp: 1400009934, id: '1521817656#367da52f-6d0c-8550-b218-571c', status: 200, payload: '5Ba3AAAAAA==',
      },
    ],
  },
  oneAsyncResponse: {
    registrations: [
      { name: 'fourFive' },
      { name: 'fourFour1' },
      { name: 'fourFour' },
      { name: 'threeEight' },
      { name: 'threeSeven' },
    ],
    'reg-updates': [
      { name: 'fourFive' },
      { name: 'fourFour1' },
      { name: 'fourFour' },
      { name: 'threeEight' },
      { name: 'threeSeven' },
    ],
    'de-registrations': [
      { name: 'fourFive' },
      { name: 'fourFour1' },
      { name: 'fourFour' },
      { name: 'threeEight' },
      { name: 'threeSeven' },
    ],
    'async-responses': [
      {
        timestamp: 1400009935, id: '1521817656#367da52f-6d0c-8550-b218-571d', status: 200, payload: '5Ba3AAAAAA==',
      },
    ],
  },
};

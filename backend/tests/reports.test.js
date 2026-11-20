const request = require('supertest');
const { createApp } = require('../src/app');
const { Report } = require('../src/models');
const { startDb, stopDb, clearDb } = require('./helpers');

const app = createApp();

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

test('a visitor can report a wrong price without being signed in', async () => {
  const res = await request(app).post('/api/reports').send({ type: 'wrong_price', message: 'This price is way off the real store page.' });
  expect(res.status).toBe(201);
  expect(await Report.countDocuments()).toBe(1);
  expect((await Report.findById(res.body.id)).status).toBe('open');
});

test('a short message is rejected', async () => {
  const res = await request(app).post('/api/reports').send({ type: 'other', message: 'hi' });
  expect(res.status).toBe(400);
  expect(await Report.countDocuments()).toBe(0);
});

test('an unknown type is rejected', async () => {
  const res = await request(app).post('/api/reports').send({ type: 'spam', message: 'This is a long enough message.' });
  expect(res.status).toBe(400);
});

test('too many reports from the same visitor are rate-limited', async () => {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await request(app).post('/api/reports').send({ type: 'other', message: 'Report number ' + i + ' here.' });
  }
  const res = await request(app).post('/api/reports').send({ type: 'other', message: 'One too many reports here.' });
  expect(res.status).toBe(429);
});

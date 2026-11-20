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

describe('GET /api/reports (owner-only)', () => {
  // Writes reports directly (Report.create), not through POST /api/reports: that endpoint shares its
  // rate limiter across this whole test file, and the test above deliberately exhausts it.
  const KEY = { 'x-job-key': 'test-job-key' };

  test('rejects a missing or wrong key', async () => {
    await Report.create({ type: 'other', message: 'Needs the right key to read.' });
    expect((await request(app).get('/api/reports')).status).toBe(403);
    expect((await request(app).get('/api/reports').set({ 'x-job-key': 'wrong' })).status).toBe(403);
  });

  test('lists submitted reports newest first, with the open count', async () => {
    await Report.create({ type: 'wrong_price', message: 'First report here.' });
    await Report.create({ type: 'wrong_product', message: 'Second report here.', email: 'shopper@example.com' });
    const res = await request(app).get('/api/reports').set(KEY);
    expect(res.status).toBe(200);
    expect(res.body.reports).toHaveLength(2);
    expect(res.body.reports.map((r) => r.message)).toEqual(['Second report here.', 'First report here.']);
    expect(res.body.reports[0].email).toBe('shopper@example.com');
    expect(res.body.openCount).toBe(2);
  });

  test('filters by status', async () => {
    await Report.create({ type: 'other', message: 'To be marked reviewed.', status: 'reviewed' });
    await Report.create({ type: 'other', message: 'Still open.' });
    const open = await request(app).get('/api/reports?status=open').set(KEY);
    expect(open.body.reports).toHaveLength(1);
    expect(open.body.reports[0].message).toBe('Still open.');
    const reviewed = await request(app).get('/api/reports?status=reviewed').set(KEY);
    expect(reviewed.body.reports).toHaveLength(1);
    expect(reviewed.body.reports[0].message).toBe('To be marked reviewed.');
  });
});

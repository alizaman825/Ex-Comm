const request = require('supertest');
const { createApp } = require('../src/app');
const { ContactMessage } = require('../src/models');
const email = require('../src/services/email');
const { startDb, stopDb, clearDb } = require('./helpers');

const app = createApp();

// Each POST test (other than the one deliberately exhausting it) gets its own app instance, so its
// own fresh contactLimiter() counters - CONTACT_RATE_LIMIT_MAX is only 3/hour, far fewer than the
// number of POST tests in this file, so sharing one app's limiter across all of them would make
// later tests fail on 429 rather than what they're actually checking.
function freshApp() {
  return createApp();
}

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  jest.restoreAllMocks();
});

const valid = { email: 'shopper@example.com', topic: 'general', message: 'How do I delete my account?' };

test('a visitor can submit the contact form without an account', async () => {
  jest.spyOn(email, 'notifyNewContactMessage').mockResolvedValue(true);
  const res = await request(freshApp()).post('/api/contact').send(valid);
  expect(res.status).toBe(201);
  expect(await ContactMessage.countDocuments()).toBe(1);
  const saved = await ContactMessage.findById(res.body.id);
  expect(saved.status).toBe('new');
  expect(saved.email).toBe('shopper@example.com');
  expect(saved.ipHash).toBeTruthy();
});

test('a missing email is rejected', async () => {
  const res = await request(freshApp()).post('/api/contact').send({ ...valid, email: undefined });
  expect(res.status).toBe(400);
  expect(await ContactMessage.countDocuments()).toBe(0);
});

test('an invalid email is rejected', async () => {
  const res = await request(freshApp()).post('/api/contact').send({ ...valid, email: 'not-an-email' });
  expect(res.status).toBe(400);
});

test('an empty message is rejected', async () => {
  const res = await request(freshApp()).post('/api/contact').send({ ...valid, message: '' });
  expect(res.status).toBe(400);
});

test('a message over 2000 characters is rejected even though nothing on the client enforces it', async () => {
  const res = await request(freshApp()).post('/api/contact').send({ ...valid, message: 'x'.repeat(2001) });
  expect(res.status).toBe(400);
});

test('an unknown topic is rejected', async () => {
  const res = await request(freshApp()).post('/api/contact').send({ ...valid, topic: 'nonsense' });
  expect(res.status).toBe(400);
});

test('a filled honeypot field is accepted (201) but nothing is saved or emailed', async () => {
  const spy = jest.spyOn(email, 'notifyNewContactMessage').mockResolvedValue(true);
  const res = await request(freshApp()).post('/api/contact').send({ ...valid, website: 'https://spam.example' });
  expect(res.status).toBe(201);
  expect(await ContactMessage.countDocuments()).toBe(0);
  expect(spy).not.toHaveBeenCalled();
});

test('a script/HTML payload in name or message is never stored raw', async () => {
  jest.spyOn(email, 'notifyNewContactMessage').mockResolvedValue(false);
  const res = await request(freshApp())
    .post('/api/contact')
    .send({ ...valid, name: '<script>alert(1)</script>', message: 'Hello <img src=x onerror=alert(1)>' });
  expect(res.status).toBe(201);
  const saved = await ContactMessage.findById(res.body.id);
  expect(saved.name).not.toContain('<script>');
  expect(saved.message).not.toContain('<img');
  expect(saved.name).toContain('&lt;script&gt;');
});

test('the request still succeeds and the message is still saved when the email provider fails', async () => {
  jest.spyOn(email, 'notifyNewContactMessage').mockRejectedValue(new Error('boom'));
  // notifyNewContactMessage itself never throws in real use, but the controller awaits it directly, so
  // a provider that somehow does throw must not take the whole request down with it.
  const res = await request(freshApp()).post('/api/contact').send(valid);
  expect(res.status).toBe(201);
  expect(await ContactMessage.countDocuments()).toBe(1);
});

test('too many contact messages from the same visitor are rate-limited', async () => {
  for (let i = 0; i < 3; i += 1) {
    jest.spyOn(email, 'notifyNewContactMessage').mockResolvedValue(false);
    // eslint-disable-next-line no-await-in-loop
    await request(app).post('/api/contact').send({ ...valid, message: `Message number ${i} here.` });
  }
  const res = await request(app).post('/api/contact').send({ ...valid, message: 'One too many.' });
  expect(res.status).toBe(429);
});

describe('GET /api/contact (owner-only)', () => {
  const KEY = { 'x-job-key': 'test-job-key' };

  test('rejects a missing or wrong key', async () => {
    await ContactMessage.create({ ...valid, ipHash: 'x' });
    expect((await request(app).get('/api/contact')).status).toBe(403);
    expect((await request(app).get('/api/contact').set({ 'x-job-key': 'wrong' })).status).toBe(403);
  });

  test('lists submitted messages newest first, with the new count', async () => {
    await ContactMessage.create({ email: 'a@example.com', topic: 'general', message: 'First.', ipHash: 'x' });
    await ContactMessage.create({ email: 'b@example.com', topic: 'business', message: 'Second.', ipHash: 'y' });
    const res = await request(app).get('/api/contact').set(KEY);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(2);
    expect(res.body.messages.map((m) => m.message)).toEqual(['Second.', 'First.']);
    expect(res.body.newCount).toBe(2);
  });

  test('filters by status', async () => {
    await ContactMessage.create({ email: 'a@example.com', topic: 'general', message: 'Read already.', ipHash: 'x', status: 'read' });
    await ContactMessage.create({ email: 'b@example.com', topic: 'general', message: 'Still new.', ipHash: 'y' });
    const read = await request(app).get('/api/contact?status=read').set(KEY);
    expect(read.body.messages).toHaveLength(1);
    expect(read.body.messages[0].message).toBe('Read already.');
  });
});

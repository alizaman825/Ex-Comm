const request = require('supertest');
const { createApp } = require('../src/app');
const { startDb, stopDb, clearDb } = require('./helpers');

let app;
const alice = { name: 'Alice Khan', email: 'Alice@Example.com', password: 'secret123' };

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  app = createApp(); // fresh rate-limit counters per test
});

function expectNoSecrets(body) {
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/passwordHash/);
  expect(text).not.toMatch(/\$2[aby]\$/); // bcrypt hash prefix
  expect(text).not.toContain(alice.password);
}

describe('register', () => {
  test('creates a user, sets an httpOnly cookie and returns no password hash', async () => {
    const res = await request(app).post('/api/auth/register').send(alice);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Alice Khan', email: 'alice@example.com' });
    expect(res.headers['set-cookie'][0]).toMatch(/token=.*HttpOnly/i);
    expectNoSecrets(res.body.user);
  });

  test('rejects duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send(alice);
    const res = await request(app).post('/api/auth/register').send({ ...alice, email: 'alice@example.com' });
    expect(res.status).toBe(409);
  });

  test('validates input', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'bad', password: '1' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });
});

describe('login / me / logout', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(alice);
    app = createApp();
  });

  test('logs in with correct credentials (case-insensitive email)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ALICE@example.com', password: alice.password });
    expect(res.status).toBe(200);
    expectNoSecrets(res.body.user);
  });

  test('rejects a wrong password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: alice.email, password: 'wrong-pass' });
    expect(res.status).toBe(401);
  });

  test('GET /me works with cookie, fails without it', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: alice.email, password: alice.password });
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expectNoSecrets(me.body);
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  test('GET /me works with Bearer token; rejects a forged token', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: alice.email, password: alice.password });
    const ok = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(ok.status).toBe(200);
    const bad = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.token');
    expect(bad.status).toBe(401);
  });

  test('logout clears the cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: alice.email, password: alice.password });
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});

describe('profile routes require auth', () => {
  test.each([
    ['patch', '/api/users/me'],
    ['patch', '/api/users/me/password'],
    ['delete', '/api/users/me'],
  ])('%s %s without auth → 401', async (method, url) => {
    const res = await request(app)[method](url).send({});
    expect(res.status).toBe(401);
  });

  test('update profile, change password, delete account', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(alice);

    const upd = await agent.patch('/api/users/me').send({ name: 'Alice K', emailAlerts: true });
    expect(upd.status).toBe(200);
    expect(upd.body.user).toMatchObject({ name: 'Alice K', emailAlerts: true });
    expectNoSecrets(upd.body);

    expect((await agent.patch('/api/users/me').send({ email: 'x@y.com' })).status).toBe(400);
    expect((await agent.patch('/api/users/me/password').send({ currentPassword: 'nope', newPassword: 'newsecret1' })).status).toBe(400);
    expect((await agent.patch('/api/users/me/password').send({ currentPassword: alice.password, newPassword: 'newsecret1' })).status).toBe(204);

    expect((await agent.delete('/api/users/me').send({ password: 'newsecret1' })).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});

describe('rate limiting', () => {
  test('login is limited to AUTH_RATE_LIMIT_MAX attempts per window', async () => {
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).post('/api/auth/login').send({ email: 'x@y.com', password: 'whatever' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});

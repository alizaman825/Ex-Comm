const request = require('supertest');
const { createApp } = require('../src/app');
const { startDb, stopDb } = require('./helpers');

const app = createApp();

beforeAll(startDb);
afterAll(stopDb);

describe('API foundation', () => {
  test('GET /api/health reports ok and db connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'connected' });
  });

  test('sets helmet security headers and hides x-powered-by', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('unknown route returns JSON 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/not found/i);
  });

  test('malformed JSON returns 400, not a crash', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
  });

  test('legacy unauthenticated user/order routes are gone', async () => {
    expect((await request(app).get('/users')).status).toBe(404);
    expect((await request(app).delete('/users/delete/abc')).status).toBe(404);
    expect((await request(app).get('/order')).status).toBe(404);
    expect((await request(app).get('/api/users')).status).toBe(401);
  });
});

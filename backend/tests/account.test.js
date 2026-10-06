const request = require('supertest');
const { createApp } = require('../src/app');
const { seedDatabase } = require('../src/seed/seed');
const { Product, Listing, Alert, Notification, Wishlist, User } = require('../src/models');
const { refreshProductStats } = require('../src/services/productStats');
const { startDb, stopDb } = require('./helpers');

let app;
let agent;
let other;
let a55;
let airpods;
let a55Price;

const post = (a, url, body) => a.post(url).send(body);

beforeAll(async () => {
  await startDb();
  await seedDatabase({ log: () => {} });
  app = createApp();
  agent = request.agent(app);
  other = request.agent(app);
  await agent.post('/api/auth/register').send({ name: 'Sara Ahmed', email: 'sara@example.com', password: 'password1' });
  await other.post('/api/auth/register').send({ name: 'Omar Raza', email: 'omar@example.com', password: 'password1' });
  const p = await Product.findOne({ title: 'Samsung Galaxy A55 5G 8GB 256GB' });
  a55 = String(p._id);
  airpods = String((await Product.findOne({ title: 'Apple AirPods Pro 2 USB-C' }))._id);
  a55Price = (await Listing.find({ productId: p._id, role: 'retail', inStock: true }).sort({ price: 1 }).limit(1))[0].price;
});
afterAll(stopDb);

describe('everything requires a session', () => {
  test.each([
    ['get', '/api/wishlist'],
    ['post', '/api/wishlist'],
    ['delete', `/api/wishlist/${'a'.repeat(24)}`],
    ['get', '/api/alerts'],
    ['post', '/api/alerts'],
    ['patch', `/api/alerts/${'a'.repeat(24)}`],
    ['delete', `/api/alerts/${'a'.repeat(24)}`],
    ['get', '/api/notifications'],
    ['get', '/api/notifications/unread-count'],
    ['patch', '/api/notifications/read-all'],
    ['patch', `/api/notifications/${'a'.repeat(24)}/read`],
  ])('%s %s -> 401', async (method, url) => {
    expect((await request(app)[method](url).send({})).status).toBe(401);
  });
});

describe('wishlist', () => {
  test('add (idempotent), list with price info, product shows saved state, remove', async () => {
    const add = await post(agent, '/api/wishlist', { productId: a55 });
    expect(add.status).toBe(201);
    expect((await post(agent, '/api/wishlist', { productId: a55 })).status).toBe(200); // second add: no duplicate
    const sara = await User.findOne({ email: 'sara@example.com' });
    expect(await Wishlist.countDocuments({ userId: sara._id, productId: a55 })).toBe(1);

    const list = await agent.get('/api/wishlist');
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].product.title).toMatch(/A55/);
    expect(list.body.items[0].priceWhenAdded).toBeGreaterThan(0);
    expect(typeof list.body.items[0].changeSinceAdded).toBe('number');

    expect((await agent.get(`/api/products/${a55}`)).body.product.inWishlist).toBe(true);
    expect((await other.get(`/api/products/${a55}`)).body.product.inWishlist).toBe(false);

    expect((await agent.delete(`/api/wishlist/${a55}`)).status).toBe(204);
    expect((await agent.delete(`/api/wishlist/${a55}`)).status).toBe(404);
    expect((await agent.get('/api/wishlist')).body.items).toHaveLength(0);
  });

  test('unknown product and invalid body', async () => {
    expect((await post(agent, '/api/wishlist', { productId: 'b'.repeat(24) })).status).toBe(404);
    expect((await post(agent, '/api/wishlist', { productId: 'x' })).status).toBe(400);
  });

  test('users only see their own wishlist', async () => {
    await post(agent, '/api/wishlist', { productId: airpods });
    expect((await other.get('/api/wishlist')).body.items).toHaveLength(0);
    await agent.delete(`/api/wishlist/${airpods}`);
  });
});

describe('alerts', () => {
  let alertId;

  test('creates an alert below the current price without notifying', async () => {
    const res = await post(agent, '/api/alerts', { productId: a55, targetPrice: Math.round(a55Price * 0.8) });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ updated: false, triggeredNow: false });
    expect(res.body.alert).toMatchObject({ type: 'price', active: true, platform: null, reached: false });
    expect(res.body.alert.currentPrice).toBe(a55Price);
    alertId = res.body.alert.id;
    expect(await Notification.countDocuments({ alertId })).toBe(0);
  });

  test('creating again for the same product/platform updates the target instead of duplicating', async () => {
    const res = await post(agent, '/api/alerts', { productId: a55, targetPrice: Math.round(a55Price * 0.7) });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(true);
    expect(res.body.alert.id).toBe(alertId);
    expect(await Alert.countDocuments({ userId: (await User.findOne({ email: 'sara@example.com' }))._id, productId: a55, active: true })).toBe(1);
  });

  test('a target already reached notifies immediately', async () => {
    const res = await post(agent, '/api/alerts', { productId: airpods, targetPrice: 10000000 });
    expect(res.status).toBe(201);
    expect(res.body.triggeredNow).toBe(true);
    const n = await Notification.findOne({ alertId: res.body.alert.id });
    expect(n.message).toMatch(/AirPods Pro 2/);
    expect(n.read).toBe(false);
  });

  test('platform-specific alert watches only that platform', async () => {
    const res = await post(agent, '/api/alerts', { productId: a55, targetPrice: 1000, platform: 'priceoye' });
    expect(res.status).toBe(201);
    expect(res.body.alert).toMatchObject({ platform: 'priceoye', currentPlatform: 'priceoye' });
    await agent.delete(`/api/alerts/${res.body.alert.id}`);
  });

  test('validation', async () => {
    expect((await post(agent, '/api/alerts', { productId: a55, targetPrice: 0 })).status).toBe(400);
    expect((await post(agent, '/api/alerts', { productId: a55, targetPrice: -5 })).status).toBe(400);
    expect((await post(agent, '/api/alerts', { productId: a55, targetPrice: 'cheap' })).status).toBe(400);
    expect((await post(agent, '/api/alerts', { productId: a55, targetPrice: 100, platform: 'amazon' })).status).toBe(400);
    expect((await post(agent, '/api/alerts', { productId: 'c'.repeat(24), targetPrice: 100 })).status).toBe(404);
  });

  test('list, pause, resume, edit', async () => {
    const list = await agent.get('/api/alerts');
    expect(list.body.alerts.length).toBe(2);
    expect(list.body.alerts[0].product.title).toBeDefined();

    const paused = await agent.patch(`/api/alerts/${alertId}`).send({ active: false });
    expect(paused.body.alert.active).toBe(false);
    const edited = await agent.patch(`/api/alerts/${alertId}`).send({ targetPrice: 5000, active: true });
    expect(edited.body.alert).toMatchObject({ active: true, targetPrice: 5000 });
    expect((await agent.patch(`/api/alerts/${alertId}`).send({})).status).toBe(400);
    expect((await agent.patch(`/api/alerts/${alertId}`).send({ userId: 'x' })).status).toBe(400);
  });

  test("another user cannot see, edit or delete someone else's alert", async () => {
    expect((await other.get('/api/alerts')).body.alerts).toHaveLength(0);
    expect((await other.patch(`/api/alerts/${alertId}`).send({ active: false })).status).toBe(404);
    expect((await other.delete(`/api/alerts/${alertId}`)).status).toBe(404);
  });

  test('delete', async () => {
    expect((await agent.delete(`/api/alerts/${alertId}`)).status).toBe(204);
    expect((await agent.delete(`/api/alerts/${alertId}`)).status).toBe(404);
  });
});

describe('notifications', () => {
  test('list, unread count, mark one read, mark all read', async () => {
    await Notification.create({ userId: (await User.findOne({ email: 'sara@example.com' }))._id, productId: a55, message: 'Second one', price: 1000, platform: 'daraz' });

    const list = await agent.get('/api/notifications');
    expect(list.body.total).toBe(2);
    expect(list.body.unreadCount).toBe(2);
    expect(list.body.notifications[0].message).toBe('Second one'); // newest first
    expect(list.body.notifications[1].product.title).toMatch(/AirPods/);

    expect((await agent.get('/api/notifications/unread-count')).body.count).toBe(2);
    expect((await agent.get('/api/notifications?unread=true')).body.total).toBe(2);

    const first = list.body.notifications[0].id;
    expect((await agent.patch(`/api/notifications/${first}/read`)).body.read).toBe(true);
    expect((await agent.get('/api/notifications/unread-count')).body.count).toBe(1);

    expect((await agent.patch('/api/notifications/read-all')).body.updated).toBe(1);
    expect((await agent.get('/api/notifications/unread-count')).body.count).toBe(0);
    expect((await agent.get('/api/notifications?unread=true')).body.total).toBe(0);
  });

  test("cannot touch another user's notifications", async () => {
    const mine = (await agent.get('/api/notifications')).body.notifications[0].id;
    expect((await other.patch(`/api/notifications/${mine}/read`)).status).toBe(404);
    expect((await other.get('/api/notifications')).body.total).toBe(0);
  });
});

describe('alert cooldown and cascade delete', () => {
  test('a fired alert does not fire again within 24 hours', async () => {
    const { evaluateProductAlerts } = require('../src/services/alerts');
    const before = await Notification.countDocuments();
    expect(await evaluateProductAlerts(airpods)).toHaveLength(0); // already triggered at creation
    expect(await Notification.countDocuments()).toBe(before);

    await Alert.updateMany({ productId: airpods }, { lastTriggeredAt: new Date(Date.now() - 25 * 3600 * 1000) });
    expect(await evaluateProductAlerts(airpods)).toHaveLength(1); // cooldown over
  });

  test('prices dropping below a target fires the alert once refreshed', async () => {
    const created = await post(agent, '/api/alerts', { productId: a55, targetPrice: Math.round(a55Price * 0.9) });
    expect(created.body.triggeredNow).toBe(false);
    const cheap = await Listing.findOne({ productId: a55, role: 'retail', inStock: true });
    await Listing.updateOne({ _id: cheap._id }, { price: Math.round(a55Price * 0.85) });
    await refreshProductStats(a55);
    const { evaluateProductAlerts } = require('../src/services/alerts');
    const fired = await evaluateProductAlerts(a55);
    expect(fired).toHaveLength(1);
    expect(fired[0].price).toBeLessThan(a55Price);
  });

  test('deleting the account removes wishlist, alerts and notifications', async () => {
    await post(agent, '/api/wishlist', { productId: a55 });
    const uid = (await User.findOne({ email: 'sara@example.com' }))._id;
    expect(await Alert.countDocuments({ userId: uid })).toBeGreaterThan(0);
    expect((await agent.delete('/api/users/me').send({ password: 'password1' })).status).toBe(204);
    expect(await Alert.countDocuments({ userId: uid })).toBe(0);
    expect(await Notification.countDocuments({ userId: uid })).toBe(0);
    expect(await Wishlist.countDocuments({ userId: uid })).toBe(0);
  });
});

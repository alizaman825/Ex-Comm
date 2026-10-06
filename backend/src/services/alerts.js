// Alert evaluation and notification creation. Shared by the alerts API (immediate check on create)
// and the scheduled price-check job (T7).
const { Alert, Listing, Notification, Product, User } = require('../models');
const mailer = require('./mailer');

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const PLATFORM_LABEL = { daraz: 'Daraz', priceoye: 'PriceOye', aliexpress: 'AliExpress' };
const rs = (n) => `Rs ${Math.round(n).toLocaleString('en-PK')}`;

// The price an alert watches: the cheapest in-stock listing on the chosen platform,
// or (no platform chosen) on any retail store. Returns { price, platform } or null.
function watchedOffer(alert, listings) {
  let pool = listings.filter((l) => l.inStock);
  if (alert.platform) pool = pool.filter((l) => l.platform === alert.platform);
  else pool = pool.filter((l) => l.role !== 'supplier');
  if (!pool.length) return null;
  const best = pool.reduce((a, b) => (b.price < a.price ? b : a));
  return { price: best.price, platform: best.platform, listingId: best._id };
}

const inCooldown = (alert, now = Date.now()) => alert.lastTriggeredAt && now - alert.lastTriggeredAt.getTime() < COOLDOWN_MS;

// Price-type alert check (supplier_drop / margin types are added in T15).
function checkPriceAlert(alert, listings, now = Date.now()) {
  const offer = watchedOffer(alert, listings);
  if (!offer || !alert.targetPrice || offer.price > alert.targetPrice) return { offer, triggered: false };
  return { offer, triggered: !inCooldown(alert, now) };
}

// Optional email copy of a notification (only if the user enabled it and SMTP is configured).
async function emailIfEnabled(userId, note) {
  if (!mailer.isConfigured()) return;
  const user = await User.findById(userId);
  if (!user || !user.emailAlerts) return;
  await mailer.sendMail({ to: user.email, subject: 'Ex-Comm price alert', text: note.message });
}

async function createNotification(alert, product, offer) {
  const where = PLATFORM_LABEL[offer.platform] || offer.platform;
  const note = await Notification.create({
    userId: alert.userId,
    alertId: alert._id,
    productId: product._id,
    price: offer.price,
    platform: offer.platform,
    message: `Price drop: ${product.title} is now ${rs(offer.price)} on ${where}, at or below your target of ${rs(alert.targetPrice)}.`,
  });
  alert.lastTriggeredAt = new Date();
  await alert.save();
  await emailIfEnabled(alert.userId, note);
  return note;
}

// Evaluate one alert against current listings; creates a notification when it fires.
async function evaluateAlert(alert, { product, listings } = {}) {
  const prod = product || (await Product.findById(alert.productId));
  if (!prod) return { triggered: false };
  const lst = listings || (await Listing.find({ productId: alert.productId }).lean());
  const { offer, triggered } = checkPriceAlert(alert, lst);
  if (!triggered) return { triggered: false, offer };
  return { triggered: true, offer, notification: await createNotification(alert, prod, offer) };
}

// Evaluate every active alert on a product (used after prices change).
async function evaluateProductAlerts(productId) {
  const [product, listings, alerts] = await Promise.all([
    Product.findById(productId),
    Listing.find({ productId }).lean(),
    Alert.find({ productId, active: true }),
  ]);
  const fired = [];
  for (const alert of alerts) {
    // eslint-disable-next-line no-await-in-loop
    const r = await evaluateAlert(alert, { product, listings });
    if (r.triggered) fired.push(r.notification);
  }
  return fired;
}

module.exports = { COOLDOWN_MS, watchedOffer, checkPriceAlert, createNotification, evaluateAlert, evaluateProductAlerts };

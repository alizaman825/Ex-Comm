const { z } = require('zod');
const { Alert, Product, Listing, PLATFORMS } = require('../models');
const AppError = require('../utils/AppError');
const { watchedOffer, evaluateAlert } = require('../services/alerts');
const { objectId } = require('./products.controller');

const platform = z.enum(PLATFORMS).nullable();
const price = z.number({ invalid_type_error: 'Target price must be a number' }).positive('Target price must be greater than 0').max(100000000);

const createSchema = z.object({
  productId: objectId,
  targetPrice: price,
  platform: platform.optional(),
  type: z.literal('price').default('price'), // supplier_drop and margin types arrive with the seller module (T15)
});
const updateSchema = z
  .object({ targetPrice: price.optional(), platform: platform.optional(), active: z.boolean().optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });
const idParams = z.object({ id: objectId });

async function present(alerts) {
  const products = await Product.find({ _id: { $in: alerts.map((a) => a.productId) } }).lean();
  const listings = await Listing.find({ productId: { $in: products.map((p) => p._id) } }).lean();
  const pOf = new Map(products.map((p) => [String(p._id), p]));
  return alerts
    .filter((a) => pOf.has(String(a.productId)))
    .map((a) => {
      const p = pOf.get(String(a.productId));
      const offer = watchedOffer(a, listings.filter((l) => String(l.productId) === String(p._id)));
      const json = a.toJSON();
      return {
        ...json,
        product: { id: String(p._id), title: p.title, image: p.image || null, minPrice: p.minPrice },
        currentPrice: offer ? offer.price : null,
        currentPlatform: offer ? offer.platform : null,
        reached: Boolean(offer && a.targetPrice && offer.price <= a.targetPrice),
      };
    });
}

// GET /api/alerts
async function list(req, res) {
  const alerts = await Alert.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ alerts: await present(alerts) });
}

// POST /api/alerts: one active alert per product + platform + type; creating again updates the target.
async function create(req, res) {
  const { productId, targetPrice, type } = req.body;
  const plat = req.body.platform ?? null;
  const product = await Product.findById(productId);
  if (!product) throw new AppError(404, 'Product not found');

  let alert = await Alert.findOne({ userId: req.user._id, productId, platform: plat, type, active: true });
  const updated = Boolean(alert);
  if (alert) {
    alert.targetPrice = targetPrice;
    alert.lastTriggeredAt = undefined;
  } else {
    alert = new Alert({ userId: req.user._id, productId, platform: plat, type, targetPrice });
  }
  await alert.save();
  await Product.updateOne({ _id: productId }, { $inc: { popularity: updated ? 0 : 1 } });

  // If the price is already at or below the target, notify straight away.
  const { triggered } = await evaluateAlert(alert, { product });
  const [out] = await present([alert]);
  res.status(updated ? 200 : 201).json({ alert: out, updated, triggeredNow: triggered });
}

async function findOwned(req) {
  const alert = await Alert.findOne({ _id: req.params.id, userId: req.user._id });
  if (!alert) throw new AppError(404, 'Alert not found');
  return alert;
}

// PATCH /api/alerts/:id
async function update(req, res) {
  const alert = await findOwned(req);
  const { targetPrice, active } = req.body;
  if (req.body.platform !== undefined) alert.platform = req.body.platform;
  if (targetPrice !== undefined) {
    alert.targetPrice = targetPrice;
    alert.lastTriggeredAt = undefined;
  }
  if (active !== undefined) alert.active = active;
  await alert.save();
  if (alert.active) await evaluateAlert(alert);
  const [out] = await present([alert]);
  res.json({ alert: out });
}

// DELETE /api/alerts/:id
async function remove(req, res) {
  const alert = await findOwned(req);
  await alert.deleteOne();
  res.status(204).end();
}

module.exports = { list, create, update, remove, createSchema, updateSchema, idParams };

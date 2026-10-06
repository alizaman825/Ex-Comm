const { z } = require('zod');
const { Wishlist, Product } = require('../models');
const AppError = require('../utils/AppError');
const { cardsFor, objectId } = require('./products.controller');

const addSchema = z.object({ productId: objectId });
const paramsSchema = z.object({ productId: objectId });

const pct = (now, then) => (then ? Math.round(((now - then) / then) * 1000) / 10 : 0);

// GET /api/wishlist
async function list(req, res) {
  const items = await Wishlist.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
  const products = await Product.find({ _id: { $in: items.map((i) => i.productId) } }).lean();
  const cards = await cardsFor(products);
  const cardOf = new Map(cards.map((c) => [c.id, c]));
  res.json({
    items: items
      .filter((i) => cardOf.has(String(i.productId)))
      .map((i) => {
        const product = cardOf.get(String(i.productId));
        return {
          id: String(i._id),
          addedAt: i.createdAt,
          priceWhenAdded: i.priceWhenAdded || null,
          changeSinceAdded: pct(product.minPrice, i.priceWhenAdded),
          product,
        };
      }),
  });
}

// POST /api/wishlist {productId}: idempotent.
async function add(req, res) {
  const product = await Product.findById(req.body.productId).lean();
  if (!product) throw new AppError(404, 'Product not found');
  const existing = await Wishlist.findOne({ userId: req.user._id, productId: product._id });
  if (existing) return res.json({ saved: true, id: String(existing._id) });
  const item = await Wishlist.create({ userId: req.user._id, productId: product._id, priceWhenAdded: product.minPrice });
  await Product.updateOne({ _id: product._id }, { $inc: { popularity: 1 } });
  return res.status(201).json({ saved: true, id: String(item._id) });
}

// DELETE /api/wishlist/:productId
async function remove(req, res) {
  const r = await Wishlist.deleteOne({ userId: req.user._id, productId: req.params.productId });
  if (!r.deletedCount) throw new AppError(404, 'Product is not in your wishlist');
  res.status(204).end();
}

module.exports = { list, add, remove, addSchema, paramsSchema };

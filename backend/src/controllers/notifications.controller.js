const { z } = require('zod');
const { Notification, Product } = require('../models');
const AppError = require('../utils/AppError');
const { objectId } = require('./products.controller');

const idParams = z.object({ id: objectId });
const listQuerySchema = z.object({
  unread: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /api/notifications?unread=true&page&limit
async function list(req, res) {
  const { unread, page, limit } = req.validQuery;
  const filter = { userId: req.user._id, ...(unread ? { read: false } : {}) };
  const [rows, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId: req.user._id, read: false }),
  ]);
  const products = await Product.find({ _id: { $in: rows.map((r) => r.productId).filter(Boolean) } }).select('title image').lean();
  const pOf = new Map(products.map((p) => [String(p._id), p]));
  res.json({
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    unreadCount,
    notifications: rows.map((n) => {
      const p = pOf.get(String(n.productId));
      return {
        id: String(n._id),
        message: n.message,
        price: n.price || null,
        platform: n.platform || null,
        read: n.read,
        createdAt: n.createdAt,
        alertId: n.alertId ? String(n.alertId) : null,
        product: p ? { id: String(p._id), title: p.title, image: p.image || null } : null,
      };
    }),
  });
}

// GET /api/notifications/unread-count
async function unreadCount(req, res) {
  res.json({ count: await Notification.countDocuments({ userId: req.user._id, read: false }) });
}

// PATCH /api/notifications/:id/read
async function markRead(req, res) {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { read: true }, { new: true });
  if (!n) throw new AppError(404, 'Notification not found');
  res.json({ id: String(n._id), read: true });
}

// PATCH /api/notifications/read-all
async function markAllRead(req, res) {
  const r = await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
  res.json({ updated: r.modifiedCount });
}

module.exports = { list, unreadCount, markRead, markAllRead, idParams, listQuerySchema };

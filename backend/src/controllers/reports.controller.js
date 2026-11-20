const { z } = require('zod');
const mongoose = require('mongoose');
const { Report } = require('../models');

const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid id')
  .optional();

const createSchema = z.object({
  type: z.enum(['wrong_price', 'wrong_product', 'other']),
  productId: objectId,
  listingId: objectId,
  message: z.string().trim().min(5, 'Please describe the problem (at least 5 characters)').max(1000),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').optional().or(z.literal('')),
});

async function create(req, res) {
  const { type, productId, listingId, message, email } = req.body;
  const report = await Report.create({ type, productId, listingId, message, email: email || undefined });
  res.status(201).json({ id: report._id });
}

const listQuerySchema = z.object({
  status: z.enum(['open', 'reviewed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/reports (owner-only, x-job-key protected - PLAN.md Phase 1 item 7 continuation): no admin
// UI yet, so this is the "simple way to read submitted reports" the brief asks for. Never logs a
// report's contents - the response is the only place they're exposed.
async function list(req, res) {
  const { status, limit } = req.query;
  const filter = status ? { status } : {};
  // _id as a tiebreaker: two reports created in the same millisecond would otherwise sort in
  // whatever order the database happens to return them, since createdAt alone can't tell them
  // apart. ObjectIds are monotonically increasing, so this keeps "newest first" stable.
  const reports = await Report.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .populate('productId', 'title')
    .populate('listingId', 'platform title')
    .lean();
  res.json({ reports, openCount: await Report.countDocuments({ status: 'open' }) });
}

module.exports = { create, createSchema, list, listQuerySchema };

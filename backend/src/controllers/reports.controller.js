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

module.exports = { create, createSchema };

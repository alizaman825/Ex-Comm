const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

// User-submitted "report a wrong price or product" (PLAN.md Phase 1 item 7). Read by the owner only
// (no admin UI yet); stored so nothing submitted is lost while that's built.
const reportSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['wrong_price', 'wrong_product', 'other'], required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    status: { type: String, enum: ['open', 'reviewed'], default: 'open' },
  },
  { timestamps: true }
);

reportSchema.plugin(toJSON);

module.exports = mongoose.model('Report', reportSchema);

const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const wishlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    priceWhenAdded: Number,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

wishlistSchema.index({ userId: 1, productId: 1 }, { unique: true });
wishlistSchema.plugin(toJSON);

module.exports = mongoose.model('Wishlist', wishlistSchema);

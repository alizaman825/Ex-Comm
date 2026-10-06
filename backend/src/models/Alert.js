const mongoose = require('mongoose');
const { toJSON, PLATFORMS } = require('./plugins');

const alertSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    type: { type: String, enum: ['price', 'supplier_drop', 'margin'], default: 'price' },
    targetPrice: { type: Number, min: 1 }, // price / supplier_drop alerts
    targetMargin: { type: Number, min: 1, max: 1000 }, // margin alerts (%)
    platform: { type: String, enum: [...PLATFORMS, null], default: null }, // null = any platform
    active: { type: Boolean, default: true },
    lastTriggeredAt: Date,
  },
  { timestamps: true }
);

alertSchema.index({ userId: 1, productId: 1 });
alertSchema.index({ active: 1 });
alertSchema.plugin(toJSON);

module.exports = mongoose.model('Alert', alertSchema);

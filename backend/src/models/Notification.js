const mongoose = require('mongoose');
const { toJSON, PLATFORMS } = require('./plugins');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    alertId: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    message: { type: String, required: true },
    price: Number,
    platform: { type: String, enum: [...PLATFORMS, null] },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.plugin(toJSON);

module.exports = mongoose.model('Notification', notificationSchema);

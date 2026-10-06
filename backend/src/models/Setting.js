const mongoose = require('mongoose');

// Key/value app settings (exchange rate, default margin assumptions).
const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed,
  updatedAt: { type: Date, default: Date.now },
});

const DEFAULTS = {
  usdToPkr: 280, // configurable exchange rate
  shippingPkr: 1500, // default shipping per item from supplier
  customsPct: 20, // import duty/taxes as % of (supplier price + shipping)
  feePct: 8, // platform/marketplace fee as % of selling price
};

settingSchema.statics.getAll = async function getAll() {
  const rows = await this.find().lean();
  return { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
};

settingSchema.statics.set = function set(key, value) {
  return this.updateOne({ key }, { $set: { value, updatedAt: new Date() } }, { upsert: true });
};

const Setting = mongoose.model('Setting', settingSchema);
Setting.DEFAULTS = DEFAULTS;

module.exports = Setting;

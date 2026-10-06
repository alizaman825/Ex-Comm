const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const categorySchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  icon: String,
  keywords: [String], // preset searches shown on the category page
  sortOrder: { type: Number, default: 0 },
});

categorySchema.plugin(toJSON);

module.exports = mongoose.model('Category', categorySchema);

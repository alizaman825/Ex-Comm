const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

// One row per scheduled/manual job run (for monitoring and the report).
const jobRunSchema = new mongoose.Schema({
  name: { type: String, required: true }, // 'price-check'
  mode: { type: String, enum: ['live', 'simulate'], default: 'live' },
  trigger: { type: String, enum: ['schedule', 'manual'], default: 'schedule' },
  status: { type: String, enum: ['success', 'partial', 'failed', 'skipped'], required: true },
  startedAt: { type: Date, required: true },
  durationMs: Number,
  summary: mongoose.Schema.Types.Mixed, // products, listings checked, prices changed, alerts triggered, failures
  error: String,
});

jobRunSchema.index({ name: 1, startedAt: -1 });
jobRunSchema.plugin(toJSON);

module.exports = mongoose.model('JobRun', jobRunSchema);

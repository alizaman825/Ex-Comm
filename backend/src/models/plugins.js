// Shared toJSON shape for all models: `id` instead of `_id`, no `__v`.
function toJSON(schema) {
  schema.set('toJSON', {
    virtuals: false,
    transform(_doc, ret) {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  });
}

// 'telex'/'mega' (Phase 2A / Part F): background sync only (jobs/telexSync.js, jobs/megaSync.js) -
// never an on-demand live adapter like daraz/priceoye, and not a per-request supplier check like
// aliexpress/ebay.
const PLATFORMS = ['daraz', 'priceoye', 'aliexpress', 'ebay', 'telex', 'mega'];

module.exports = { toJSON, PLATFORMS };

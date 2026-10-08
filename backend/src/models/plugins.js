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

const PLATFORMS = ['daraz', 'priceoye', 'aliexpress', 'ebay'];

module.exports = { toJSON, PLATFORMS };

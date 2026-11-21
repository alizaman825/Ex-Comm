const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

// "Contact us" form submissions (Phase 2 Part D). Read by the owner only (x-job-key header, same
// pattern as Report - no admin UI yet). name/message are stored HTML-escaped by the controller before
// save, so a script/HTML payload in either field can never execute if this is ever rendered in a
// browser later (there is no admin UI today, but the raw API response is already the only place
// these are exposed - see contact.controller.js). ipHash is a salted SHA-256 of the submitter's IP
// (CONTACT_IP_HASH_SALT); the raw IP address is never stored.
const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    topic: { type: String, enum: ['general', 'report_problem', 'business', 'privacy_request'], required: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    ipHash: { type: String },
    status: { type: String, enum: ['new', 'read'], default: 'new' },
  },
  { timestamps: true }
);

contactMessageSchema.plugin(toJSON);

module.exports = mongoose.model('ContactMessage', contactMessageSchema);

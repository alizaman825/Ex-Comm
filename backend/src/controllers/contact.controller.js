const crypto = require('crypto');
const { z } = require('zod');
const { ContactMessage } = require('../models');
const { config } = require('../config/env');
const { notifyNewContactMessage } = require('../services/email');

const TOPICS = ['general', 'report_problem', 'business', 'privacy_request'];

const createSchema = z.object({
  name: z.string().trim().max(100, 'Name must be 100 characters or fewer').optional().or(z.literal('')),
  email: z.string().trim().toLowerCase().max(254).email('Enter a valid email address'),
  topic: z.enum(TOPICS),
  message: z.string().trim().min(1, 'Enter a message').max(2000, 'Message must be 2000 characters or fewer'),
  // Honeypot: a real visitor never sees or fills this field (hidden on the page). Any value here means
  // a bot filled every field, so the request is accepted-and-discarded below rather than rejected - a
  // 400 here would tell the bot exactly which field tripped it.
  website: z.string().max(200).optional().or(z.literal('')),
});

function escapeHtml(input) {
  return input.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function hashIp(ip) {
  return crypto.createHash('sha256').update(`${config.contact.ipHashSalt}:${ip || ''}`).digest('hex');
}

async function create(req, res) {
  const { name, email, topic, message, website } = req.body;

  if (website) {
    // Honeypot tripped: pretend success, save nothing, email no one.
    return res.status(201).json({ id: null });
  }

  const doc = await ContactMessage.create({
    name: name ? escapeHtml(name) : undefined,
    email,
    topic,
    // Stored HTML-escaped regardless of what the client sent, so this can never render as executable
    // HTML/script anywhere it's later shown (D2) - see the model's own comment.
    message: escapeHtml(message),
    ipHash: hashIp(req.ip),
  });

  // Never blocks or fails the user-facing request (D5): the message is already saved above by the
  // time this runs, and the result is logged only as a boolean, never its contents. The real
  // implementation already catches its own errors and returns false, but this try/catch is a second,
  // defensive guarantee that nothing from the email path - even an unexpected throw - can turn a
  // successful save into a failed response.
  let emailSent = false;
  try {
    emailSent = await notifyNewContactMessage({ name, email, topic, message });
  } catch {
    emailSent = false;
  }
  console.log('Contact email notification sent:', emailSent);

  res.status(201).json({ id: doc._id });
}

const listQuerySchema = z.object({
  status: z.enum(['new', 'read']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/contact (owner-only, x-job-key protected - same pattern as GET /api/reports): no admin UI
// yet, so this is the simple way to read submitted messages. Never logs a message's contents or
// email address anywhere - the API response here is the only place they're exposed.
async function list(req, res) {
  const { status, limit } = req.query;
  const filter = status ? { status } : {};
  const messages = await ContactMessage.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
  res.json({ messages, newCount: await ContactMessage.countDocuments({ status: 'new' }) });
}

module.exports = { create, createSchema, list, listQuerySchema };

// Outbound notification email for new contact-form submissions (Phase 2 Part D), via an HTTP-based
// provider rather than SMTP - Render's free web service plan is understood to block outbound SMTP
// ports (25/587), so an HTTPS API call is the working approach for a deploy there, unlike the existing
// nodemailer/SMTP path used for price-alert emails (services/mailer.js), which is a separate, optional
// feature with its own SMTP_* config.
//
// Provider: Resend (resend.com). Its free tier can send from the default `onboarding@resend.dev`
// sender, with no custom domain to verify, to the email address that owns the API key - which is
// exactly this use case (a notification to the site owner's own inbox). If a custom domain is ever
// verified in Resend, RESEND_FROM_EMAIL can point at an address on it and recipients are no longer
// limited to the account owner's address; nothing else here needs to change.
//
// Kept to one real implementation plus this safe no-op fallback - see isConfigured(). Swapping
// providers later means adding another `sendVia*` function and branching on which env vars are set.
const { config } = require('../config/env');

function isConfigured() {
  return Boolean(config.email.resendApiKey && config.contact.recipientEmail);
}

async function sendViaResend({ subject, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.email.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.email.resendFrom,
      to: config.contact.recipientEmail,
      subject,
      text,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend responded with HTTP ${res.status}`);
  }
}

// Notifies the owner of a new contact message. Never throws, and never logs the message/email/error
// body itself (those can carry sensitive content) - callers log only this function's boolean result
// (see contact.controller.js, D5). Returns false (a safe no-op) whenever the provider isn't configured,
// so the app works fine before any email env vars are ever set.
async function notifyNewContactMessage({ name, email, topic, message }) {
  if (!isConfigured()) return false;
  try {
    const lines = [
      `Topic: ${topic}`,
      `From: ${name || '(no name given)'} <${email}>`,
      '',
      message,
      '',
      '---',
      'Sign in to the owner-only GET /api/contact endpoint (x-job-key) to see all messages.',
    ];
    await sendViaResend({ subject: `New Ex-Comm contact message (${topic})`, text: lines.join('\n') });
    return true;
  } catch (err) {
    // Boolean/count only - never err.message or any part of the request body (D5).
    console.error('Contact email notification failed:', Boolean(err));
    return false;
  }
}

module.exports = { notifyNewContactMessage, isConfigured };

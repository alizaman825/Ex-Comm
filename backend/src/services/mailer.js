// Optional email delivery for price alerts. Does nothing unless SMTP_HOST is configured.
const { config } = require('../config/env');

let transporter;

function isConfigured() {
  return Boolean(config.smtp.host);
}

function getTransporter() {
  if (!transporter) {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transporter;
}

// Returns true if the email was handed to the SMTP server; never throws.
async function sendMail({ to, subject, text }) {
  if (!isConfigured()) return false;
  try {
    await getTransporter().sendMail({ from: config.smtp.from, to, subject, text });
    return true;
  } catch (err) {
    console.error('Email send failed:', err.message);
    return false;
  }
}

module.exports = { isConfigured, sendMail };

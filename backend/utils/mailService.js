const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    const error = new Error('Email service is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.');
    error.statusCode = 503;
    throw error;
  }

  if (!transporter) {
    const port = Number(SMTP_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      const error = new Error('SMTP_PORT must be a valid port number.');
      error.statusCode = 503;
      throw error;
    }

    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  }

  return transporter;
};

const sendMail = async ({ to, subject, text, html }) => {
  const mailer = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  try {
    await mailer.sendMail({ from, to, subject, text, html });
  } catch (cause) {
    console.error('Email delivery failed:', cause.message);
    const error = new Error('Email delivery failed. Check SMTP settings and try again.');
    error.statusCode = 503;
    throw error;
  }
};

module.exports = { sendMail };

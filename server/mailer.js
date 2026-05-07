'use strict';

/**
 * mailer.js — Nodemailer email service.
 *
 * Uses environment variables from .env — never hardcode credentials.
 * Supports Gmail App Passwords (recommended) and any SMTP provider.
 */

const nodemailer = require('nodemailer');

// ── Transporter ─────────────────────────────────────────────
// Created once and reused — Nodemailer handles connection pooling.
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP_USER and SMTP_PASS must be set in .env');
  }

  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true = 465, false = STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return _transporter;
}

// ── Email template ───────────────────────────────────────────
function otpEmailHTML(code) {
  return `
<div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
  <div style="max-width:500px; margin:auto; background:#ffffff; border-radius:10px; padding:20px; text-align:center;">

    <h2 style="color:#0ea5e9;">💡 ThinkFi</h2>

    <img src="https://cdn-icons-png.flaticon.com/512/3064/3064155.png" width="80" />

    <h2 style="margin-top:20px;">Secure Login Request</h2>

    <p style="color:#555;">
      We received a login request. Use the OTP below to continue.
    </p>

    <div style="font-size:30px; letter-spacing:8px; 
                background:#0f172a; color:#22d3ee; 
                padding:15px; border-radius:8px; margin:20px 0;">
      ${code}
    </div>

    <p style="font-size:14px; color:#888;">
      This code will expire in <b>10 minutes</b>
    </p>

    <hr style="margin:20px 0;" />

    <p style="font-size:13px; color:#666;">
      If you didn’t request this, please ignore this email.
    </p>

    <p style="font-size:12px; color:#aaa;">
      © ${new Date().getFullYear()} ThinkFi • Secure • Private
    </p>

  </div>
</div>
`;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Send an OTP email.
 * @param {string} to    — recipient email
 * @param {string} code  — the 6-digit code
 */
async function sendOTP(to, code) {
  const transporter = getTransporter();

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || `"ThinkFi" <${process.env.SMTP_USER}>`,
    to,
    subject: `${code} — Your ThinkFi verification code`,
    text:    `Your ThinkFi verification code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
    html:    otpEmailHTML(code),
  });
}

module.exports = { sendOTP };

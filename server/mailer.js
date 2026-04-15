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
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ThinkFi — Verify your email</title>
</head>
<body style="margin:0;padding:0;background:#05070f;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#0e1423;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#00d4ff,#00a8cc);padding:28px 32px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:#05070f;letter-spacing:-0.5px;">💡 ThinkFi</div>
      <div style="font-size:13px;color:rgba(5,7,15,0.7);margin-top:4px;">AI-Powered Finance Dashboard</div>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <h2 style="color:#eef2ff;font-size:20px;font-weight:700;margin:0 0 8px;">Your verification code</h2>
      <p style="color:#9aa5be;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Use this code to sign in to ThinkFi. It expires in <strong style="color:#eef2ff;">10 minutes</strong>.
      </p>

      <!-- OTP Box -->
      <div style="background:#141c2e;border:2px solid rgba(0,212,255,0.3);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
        <div style="letter-spacing:16px;font-size:40px;font-weight:800;color:#00d4ff;font-family:'Courier New',monospace;">${code}</div>
      </div>

      <p style="color:#4e5d78;font-size:12px;line-height:1.6;margin:0;">
        If you didn't request this code, you can safely ignore this email.<br/>
        Never share this code with anyone — ThinkFi will never ask for it.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
      <p style="color:#2d3a52;font-size:11px;margin:0;">© ${new Date().getFullYear()} ThinkFi · Secure · Private</p>
    </div>
  </div>
</body>
</html>`;
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

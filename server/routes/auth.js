'use strict';

/**
 * routes/auth.js — Real email and phone OTP authentication.
 *
 * POST /api/auth/send-otp       — validate email, generate OTP, send email
 * POST /api/auth/verify-otp     — verify email code, issue JWT, upsert user
 * POST /api/auth/send-otp-phone — validate phone, generate OTP, send SMS
 * POST /api/auth/verify-otp-phone — verify phone code, issue JWT, upsert user
 * GET  /api/auth/me             — return current user from JWT
 * POST /api/auth/logout         — client-side only (JWT is stateless)
 */

const express       = require('express');
const jwt           = require('jsonwebtoken');
const router        = express.Router();
const { users, otp } = require('../db');
const { sendOTP }   = require('../mailer');
const { sendSMS }   = require('../sms');
const { requireAuth } = require('../middleware/auth');

// ── Simple per-IP rate limiting for auth endpoints ────────────
// Max 5 send-otp requests per IP per 15 minutes
const sendRateMap = new Map();

function isAuthRateLimited(ip) {
  const now   = Date.now();
  const entry = sendRateMap.get(ip) || { count: 0, resetAt: now + 15 * 60_000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 15 * 60_000; }
  entry.count++;
  sendRateMap.set(ip, entry);
  return entry.count > 5;
}

setInterval(() => {
  const cutoff = Date.now() - 20 * 60_000;
  for (const [ip, e] of sendRateMap) if (e.resetAt < cutoff) sendRateMap.delete(ip);
}, 15 * 60_000).unref();

// ── Validators ────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[0-9\s\-()]{7,}$/;

// ─────────────────────────────────────────────────────────────
// POST /api/auth/send-otp
// Body: { email, name? }
// ─────────────────────────────────────────────────────────────
router.post('/send-otp', async (req, res, next) => {
  try {
    if (isAuthRateLimited(req.ip)) {
      return res.status(429).json({ error: 'Too many requests. Please wait 15 minutes.' });
    }

    const email = (req.body.email || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (email.length > 254) {
      return res.status(400).json({ error: 'Email address too long.' });
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(503).json({ error: 'Email service not configured. Add SMTP credentials to .env' });
    }

    // Generate OTP and store in DB
    const code = await otp.create(email);

    // Send the actual email
    await sendOTP(email, code);

    // Never confirm whether the email exists — always respond the same way
    res.json({ message: 'Verification code sent. Check your inbox.' });

  } catch (err) {
    // Don't leak SMTP errors to client
    console.error('[AUTH] send-otp error:', err.message);
    next(new Error('Failed to send verification email. Please try again.'));
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/verify-otp
// Body: { email, code, name? }
// ─────────────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const code  = (req.body.code  || '').trim();
    const name  = (req.body.name  || '').trim().slice(0, 80);

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }
    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Code must be 6 digits.' });
    }

    // Verify OTP against DB
    const result = await otp.verify(email, code);
    if (!result.valid) {
      return res.status(401).json({ error: result.reason });
    }

    // OTP valid — create or update user
    const user = await users.upsert(email, name);

    // Issue JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });

  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/auth/me  — protected: returns current user
// ─────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/logout
// JWT is stateless — logout is handled on the client by deleting the token.
// This endpoint exists so the client has a clean API surface.
// For production: implement a token blocklist (Redis) if needed.
// ─────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully.' });
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/send-otp-phone
// Body: { phone, name? }
// ─────────────────────────────────────────────────────────────
router.post('/send-otp-phone', async (req, res, next) => {
  try {
    if (isAuthRateLimited(req.ip)) {
      return res.status(429).json({ error: 'Too many requests. Please wait 15 minutes.' });
    }

    const phone = (req.body.phone || '').trim();
    if (!phone || !PHONE_RE.test(phone)) {
      return res.status(400).json({ error: 'A valid phone number is required.' });
    }
    if (phone.length > 20) {
      return res.status(400).json({ error: 'Phone number too long.' });
    }

    // Generate OTP and store in DB
    const code = await otp.create(phone, 'phone');

    // Send SMS
    await sendSMS(phone, code);

    // Never confirm whether the phone exists — always respond the same way
    res.json({ message: 'Verification code sent. Check your messages.' });

  } catch (err) {
    console.error('[AUTH] send-otp-phone error:', err.message);
    next(new Error('Failed to send verification code. Please try again.'));
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/verify-otp-phone
// Body: { phone, code, name? }
// ─────────────────────────────────────────────────────────────
router.post('/verify-otp-phone', async (req, res, next) => {
  try {
    const phone = (req.body.phone || '').trim();
    const code  = (req.body.code  || '').trim();
    const name  = (req.body.name  || '').trim().slice(0, 80);

    if (!phone || !PHONE_RE.test(phone)) {
      return res.status(400).json({ error: 'Valid phone number is required.' });
    }
    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Code must be 6 digits.' });
    }

    // Verify OTP against DB
    const result = await otp.verify(phone, code, 'phone');
    if (!result.valid) {
      return res.status(401).json({ error: result.reason });
    }

    // OTP valid — create or update user
    const user = await users.upsertByPhone(phone, name);

    // Issue JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, phone: user.phone, name: user.name },
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;

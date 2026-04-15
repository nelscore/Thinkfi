'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');

const { users, otp } = require('../db');
const { sendOTP } = require('../mailer');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const sendRateMap = new Map();

function isConfiguredValue(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  return !/^(your_|replace_with_)/i.test(normalized);
}

function hasRealSMTPConfig() {
  return isConfiguredValue(process.env.SMTP_USER) && isConfiguredValue(process.env.SMTP_PASS);
}

function isAuthRateLimited(ip) {
  const now = Date.now();
  const entry = sendRateMap.get(ip) || { count: 0, resetAt: now + 15 * 60_000 };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 15 * 60_000;
  }

  entry.count++;
  sendRateMap.set(ip, entry);
  return entry.count > 5;
}

setInterval(() => {
  const cutoff = Date.now() - 20 * 60_000;
  for (const [ip, entry] of sendRateMap) {
    if (entry.resetAt < cutoff) sendRateMap.delete(ip);
  }
}, 15 * 60_000).unref();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[0-9\s\-()]{7,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const GENDER_OPTIONS = new Set(['male', 'female', 'other', 'prefer_not_to_say']);

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

    const code = await otp.create(email);

    if (!hasRealSMTPConfig()) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(503).json({ error: 'Email service not configured. Add SMTP credentials to .env' });
      }

      const masked = email.replace(/(.{2}).+(@.+)/, '$1***$2');
      console.warn(`[AUTH] Development OTP for ${masked}: ${code}`);
      return res.json({ message: 'Verification code generated. Check the server console in development mode.' });
    }

    await sendOTP(email, code);
    return res.json({ message: 'Verification code sent. Check your inbox.' });
  } catch (err) {
    console.error('[AUTH] send-otp error:', err.message);
    return next(new Error('Failed to send verification email. Please try again.'));
  }
});

router.post('/verify-otp', async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const code = (req.body.code || '').trim();
    const name = (req.body.name || '').trim().slice(0, 80);
    const phone = (req.body.phone || '').trim();
    const gender = (req.body.gender || '').trim().toLowerCase();
    const birthDate = (req.body.birthDate || '').trim();

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }
    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Code must be 6 digits.' });
    }
    if (phone && !PHONE_RE.test(phone)) {
      return res.status(400).json({ error: 'Enter a valid phone number.' });
    }
    if (gender && !GENDER_OPTIONS.has(gender)) {
      return res.status(400).json({ error: 'Invalid gender option.' });
    }
    if (birthDate && !DATE_RE.test(birthDate)) {
      return res.status(400).json({ error: 'Date of birth must be YYYY-MM-DD.' });
    }

    const result = await otp.verify(email, code);
    if (!result.valid) {
      return res.status(401).json({ error: result.reason });
    }

    const user = await users.upsert(email, name, { phone, gender, birthDate });
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        gender: user.gender,
        birthDate: user.birthDate,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully.' });
});

module.exports = router;

'use strict';
require('dotenv').config();

const express = require('express');
const path    = require('path');
const cors    = require('cors');

const authRoutes        = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const goalRoutes        = require('./routes/goals');
const aiRoutes          = require('./routes/ai');
const errorHandler      = require('./middleware/errorHandler');

const app = express();

// ── CORS ─────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV !== 'production';
app.use(cors({
  origin: isDev ? '*' : (process.env.ALLOWED_ORIGIN || 'http://localhost:3000'),
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Security headers ──────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '50kb' }));

// ── Static files ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../client')));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/goals',        goalRoutes);
app.use('/api/ai',           aiRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '3.2.0', ts: Date.now() });
});

// SPA catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ ThinkFi v3.2.0 → http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn('⚠️  ANTHROPIC_API_KEY missing — AI disabled');
  if (!process.env.JWT_SECRET)        console.warn('⚠️  JWT_SECRET missing — auth will fail');
  if (!process.env.SMTP_USER)         console.warn('⚠️  SMTP_USER missing — email will fail');
});

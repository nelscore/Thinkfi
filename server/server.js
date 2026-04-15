'use strict';
require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const goalRoutes = require('./routes/goals');
const aiRoutes = require('./routes/ai');
const errorHandler = require('./middleware/errorHandler');

const app = express();

const isDev = process.env.NODE_ENV !== 'production';
app.use(cors({
  origin: isDev ? '*' : (process.env.ALLOWED_ORIGIN || 'http://localhost:3000'),
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, '../client'), { index: false }));

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/ai', aiRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '3.2.1', ts: Date.now() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/welcome.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.use(errorHandler);

function startServer(port = process.env.PORT || 3000) {
  return app.listen(port, () => {
    console.log(`ThinkFi server listening on http://localhost:${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('ANTHROPIC_API_KEY missing; AI runs in offline mode');
    }
    if (!process.env.JWT_SECRET) {
      console.warn('JWT_SECRET missing; auth will fail');
    }
    if (!process.env.SMTP_USER) {
      console.warn('SMTP_USER missing; OTP falls back to console in development');
    }
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };

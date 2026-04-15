'use strict';

/**
 * middleware/auth.js — JWT verification middleware.
 *
 * Verifies the Bearer token in the Authorization header.
 * Attaches req.user = { id, email, name } if valid.
 * Returns 401 if missing or invalid.
 */

const jwt       = require('jsonwebtoken');
const { users } = require('../db');

function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const token = header.slice(7); // remove "Bearer "

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Optional: verify user still exists in DB
    // Lightweight — better-sqlite3 is sync, no async overhead
    const user = users.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'Account not found. Please sign in again.' });
    }

    req.user = user; // { id, email, name, createdAt, lastLogin }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    return res.status(401).json({ error: 'Invalid session. Please sign in again.' });
  }
}

module.exports = { requireAuth };

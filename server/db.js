'use strict';

/**
 * db.js — Pure Node.js JSON store. Zero native dependencies.
 *
 * Works on ANY Node.js version (v14+), any OS, no compilation needed.
 *
 * Schema (thinkfi.json):
 *   users        — { id, email, phone, name, gender, birthDate, createdAt, lastLogin }
 *   otpCodes     — { id, email, code, expiresAt, used }
 *   transactions — { id, userId, amount, category, date, type, note, createdAt }
 *   goals        — { id, userId, name, target, saved, deadline, createdAt }
 *
 * Write safety:
 *   - Serialized through a Promise chain (writeLock) — no race conditions.
 *   - Atomic write: write to .tmp then rename — crash-safe.
 */

const fs   = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DB_PATH  = path.join(__dirname, 'thinkfi.json');
const TMP_PATH = DB_PATH + '.tmp';

// ── Schema default ────────────────────────────────────────────
const EMPTY_DB = () => ({ users: [], otpCodes: [], transactions: [], goals: [] });

// ── Read ──────────────────────────────────────────────────────
function read() {
  if (!fs.existsSync(DB_PATH)) return EMPTY_DB();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const db  = JSON.parse(raw);
    // Ensure all tables exist even if file is old
    return { ...EMPTY_DB(), ...db };
  } catch {
    return EMPTY_DB();
  }
}

// ── Atomic write ──────────────────────────────────────────────
function writeSync(db) {
  fs.writeFileSync(TMP_PATH, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(TMP_PATH, DB_PATH);
}

// ── Write lock — serializes all mutations ─────────────────────
let _lock = Promise.resolve();
function withLock(fn) {
  const next = _lock.then(fn).catch(fn);
  _lock = next.then(() => {}, () => {});
  return next;
}

// ── Whitelists ────────────────────────────────────────────────
const VALID_TYPES = new Set(['income', 'expense']);
const VALID_CATS  = new Set([
  'salary', 'freelance', 'business', 'investment', 'other_income',
  'food', 'housing', 'transport', 'health', 'entertainment',
  'shopping', 'education', 'other',
]);

// ══════════════════════════════════════════
// USERS
// ══════════════════════════════════════════
const users = {
  findByEmail(email) {
    return read().users.find(u => u.email === email.toLowerCase().trim()) || null;
  },
  findByPhone(phone) {
    return read().users.find(u => u.phone === phone.trim()) || null;
  },
  findById(id) {
    return read().users.find(u => u.id === id) || null;
  },
  upsert(email, name, extras = {}) {
    return withLock(() => {
      const db  = read();
      const e   = email.toLowerCase().trim();
      const idx = db.users.findIndex(u => u.email === e);
      const now = new Date().toISOString();

      if (idx !== -1) {
        db.users[idx].lastLogin = now;
        if (name && name.trim()) db.users[idx].name = name.trim().slice(0, 80);
        if (extras.phone) db.users[idx].phone = extras.phone.trim();
        if (extras.gender) db.users[idx].gender = extras.gender.trim();
        if (extras.birthDate) db.users[idx].birthDate = extras.birthDate.trim();
        writeSync(db);
        return db.users[idx];
      }

      const user = {
        id:        randomUUID(),
        email:     e,
        phone:     extras.phone ? extras.phone.trim() : null,
        name:      (name || 'User').trim().slice(0, 80),
        gender:    extras.gender ? extras.gender.trim() : null,
        birthDate: extras.birthDate ? extras.birthDate.trim() : null,
        createdAt: now,
        lastLogin: now,
      };
      db.users.push(user);
      writeSync(db);
      return user;
    });
  },
  upsertByPhone(phone, name) {
    return withLock(() => {
      const db  = read();
      const p   = phone.trim();
      const idx = db.users.findIndex(u => u.phone === p);
      const now = new Date().toISOString();

      if (idx !== -1) {
        db.users[idx].lastLogin = now;
        if (name && name.trim()) db.users[idx].name = name.trim().slice(0, 80);
        writeSync(db);
        return db.users[idx];
      }

      const user = {
        id:        randomUUID(),
        email:     null,
        phone:     p,
        name:      (name || 'User').trim().slice(0, 80),
        createdAt: now,
        lastLogin: now,
      };
      db.users.push(user);
      writeSync(db);
      return user;
    });
  },
};

// ══════════════════════════════════════════
// OTP
// ══════════════════════════════════════════
const otp = {
  // Create OTP for email or phone
  create(contact, type = 'email') {
    return withLock(() => {
      const db  = read();
      const normalized = type === 'email' ? contact.toLowerCase().trim() : contact.trim();
      const now = Date.now();

      // Invalidate previous unused codes for this contact
      db.otpCodes.forEach(c => { 
        if (c.contact === normalized && c.type === type && !c.used) c.used = true; 
      });

      const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
      db.otpCodes.push({
        id:        randomUUID(),
        contact:   normalized,
        type:      type, // 'email' or 'phone'
        code,
        expiresAt: new Date(now + 10 * 60 * 1000).toISOString(), // 10 min
        used:      false,
      });
      writeSync(db);
      return code;
    });
  },

  // Verify OTP for email or phone
  verify(contact, code, type = 'email') {
    return withLock(() => {
      const db  = read();
      const normalized = type === 'email' ? contact.toLowerCase().trim() : contact.trim();
      const now = new Date();

      // Find latest unused matching code
      const matches = db.otpCodes
        .filter(c => c.contact === normalized && c.type === type && c.code === String(code).trim() && !c.used)
        .sort((a, b) => new Date(b.expiresAt) - new Date(a.expiresAt));

      if (!matches.length) return { valid: false, reason: 'Invalid code. Please try again.' };

      const entry = matches[0];
      if (new Date(entry.expiresAt) < now) {
        entry.used = true;
        writeSync(db);
        return { valid: false, reason: 'Code expired. Please request a new one.' };
      }

      entry.used = true;
      writeSync(db);
      return { valid: true };
    });
  },

  cleanup() {
    return withLock(() => {
      const db     = read();
      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const before = db.otpCodes.length;
      db.otpCodes  = db.otpCodes.filter(c => c.expiresAt > cutoff);
      if (db.otpCodes.length !== before) writeSync(db);
    });
  },
};

setInterval(() => otp.cleanup(), 60 * 60 * 1000).unref();

// ══════════════════════════════════════════
// TRANSACTIONS
// ══════════════════════════════════════════
const transactions = {
  getAll(userId, filters = {}) {
    let data = read().transactions.filter(t => t.userId === userId);
    if (filters.type  && VALID_TYPES.has(filters.type))            data = data.filter(t => t.type === filters.type);
    if (filters.month && /^\d{4}-\d{2}$/.test(filters.month))     data = data.filter(t => t.date.startsWith(filters.month));
    return data.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  },

  create(userId, body) {
    return withLock(() => {
      const db = read();
      const tx = {
        id:        randomUUID(),
        userId,
        amount:    Number(body.amount),
        category:  VALID_CATS.has(body.category) ? body.category : 'other',
        date:      body.date,
        type:      body.type,
        note:      (body.note || '').trim().slice(0, 300),
        createdAt: new Date().toISOString(),
      };
      db.transactions.unshift(tx);
      writeSync(db);
      return tx;
    });
  },

  update(userId, id, body) {
    return withLock(() => {
      const db  = read();
      const idx = db.transactions.findIndex(t => t.id === id && t.userId === userId);
      if (idx === -1) return null;

      const cur = db.transactions[idx];
      db.transactions[idx] = {
        ...cur,
        ...(body.amount   != null && { amount:   Number(body.amount) }),
        ...(body.category != null && { category: VALID_CATS.has(body.category) ? body.category : cur.category }),
        ...(body.date     != null && { date:     body.date }),
        ...(body.type     != null && { type:     VALID_TYPES.has(body.type) ? body.type : cur.type }),
        ...(body.note     != null && { note:     body.note.trim().slice(0, 300) }),
        updatedAt: new Date().toISOString(),
      };
      writeSync(db);
      return db.transactions[idx];
    });
  },

  remove(userId, id) {
    return withLock(() => {
      const db     = read();
      const before = db.transactions.length;
      db.transactions = db.transactions.filter(t => !(t.id === id && t.userId === userId));
      if (db.transactions.length === before) return false;
      writeSync(db);
      return true;
    });
  },
};

// ══════════════════════════════════════════
// GOALS
// ══════════════════════════════════════════
const goals = {
  getAll(userId) {
    return read().goals
      .filter(g => g.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  create(userId, body) {
    return withLock(() => {
      const db   = read();
      const dl   = (body.deadline && /^\d{4}-\d{2}-\d{2}$/.test(body.deadline)) ? body.deadline : null;
      const goal = {
        id:            randomUUID(),
        userId,
        name:          body.name.trim().slice(0, 100),
        target:        Number(body.target),
        saved:         Math.max(0, Number(body.saved) || 0),
        startDate:     body.startDate && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate) ? body.startDate : new Date().toISOString().slice(0, 10),
        deadline:      dl,
        priority:      ['low', 'medium', 'high'].includes(body.priority) ? body.priority : 'medium',
        riskMode:      ['safe', 'balanced', 'aggressive'].includes(body.riskMode) ? body.riskMode : 'balanced',
        incomeEstimate: body.incomeEstimate != null ? Number(body.incomeEstimate) : null,
        createdAt:     new Date().toISOString(),
      };
      db.goals.push(goal);
      writeSync(db);
      return goal;
    });
  },

  update(userId, id, body) {
    return withLock(() => {
      const db  = read();
      const idx = db.goals.findIndex(g => g.id === id && g.userId === userId);
      if (idx === -1) return null;

      const cur = db.goals[idx];
      const dl  = body.deadline != null
        ? (/^\d{4}-\d{2}-\d{2}$/.test(body.deadline) ? body.deadline : cur.deadline)
        : cur.deadline;

      db.goals[idx] = {
        ...cur,
        ...(body.name          != null && { name:   body.name.trim().slice(0, 100) }),
        ...(body.target        != null && { target: Number(body.target) }),
        ...(body.saved         != null && { saved:  Math.max(0, Number(body.saved)) }),
        ...(body.startDate     != null && { startDate: body.startDate }),
        ...(body.priority      != null && { priority: ['low','medium','high'].includes(body.priority) ? body.priority : cur.priority }),
        ...(body.riskMode      != null && { riskMode: ['safe','balanced','aggressive'].includes(body.riskMode) ? body.riskMode : cur.riskMode }),
        ...(body.incomeEstimate != null && { incomeEstimate: Number(body.incomeEstimate) }),
        deadline:  dl,
        updatedAt: new Date().toISOString(),
      };
      writeSync(db);
      return db.goals[idx];
    });
  },

  remove(userId, id) {
    return withLock(() => {
      const db     = read();
      const before = db.goals.length;
      db.goals     = db.goals.filter(g => !(g.id === id && g.userId === userId));
      if (db.goals.length === before) return false;
      writeSync(db);
      return true;
    });
  },
};

module.exports = { users, otp, transactions, goals };

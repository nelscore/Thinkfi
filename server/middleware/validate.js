'use strict';

/**
 * validate.js — Request body validation middleware.
 *
 * FIX: Separate validators for CREATE (all fields required)
 * vs UPDATE/PATCH (only validate fields that are present).
 * Using validateTransaction on PATCH was wrong — it rejected
 * valid partial updates that omitted required fields.
 */

const VALID_TYPES = ['income', 'expense'];
const VALID_CATEGORIES = [
  'salary', 'freelance', 'business', 'investment', 'other_income',
  'food', 'housing', 'transport', 'health', 'entertainment',
  'shopping', 'education', 'other',
];

// ── Transactions ──────────────────────────────────────────────

/** Full validation — all required fields must be present. Used on POST. */
function validateTransaction(req, res, next) {
  const { amount, category, date, type } = req.body;
  const errors = [];

  if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0) {
    errors.push('amount must be a positive number');
  }
  if (!category || !VALID_CATEGORIES.includes(category)) {
    errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push('date must be in YYYY-MM-DD format');
  }
  if (!VALID_TYPES.includes(type)) {
    errors.push('type must be "income" or "expense"');
  }

  if (errors.length > 0) return res.status(400).json({ errors });
  next();
}

/**
 * Partial validation — only validate fields that are present.
 * Used on PATCH so callers can update a single field without
 * sending the full transaction body.
 */
function validateTransactionPatch(req, res, next) {
  const { amount, category, date, type } = req.body;
  const errors = [];

  if (amount !== undefined) {
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      errors.push('amount must be a positive number');
    }
  }
  if (category !== undefined) {
    if (!VALID_CATEGORIES.includes(category)) {
      errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }
  }
  if (date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push('date must be in YYYY-MM-DD format');
    }
  }
  if (type !== undefined) {
    if (!VALID_TYPES.includes(type)) {
      errors.push('type must be "income" or "expense"');
    }
  }
  if (Object.keys(req.body).length === 0) {
    errors.push('Request body cannot be empty');
  }

  if (errors.length > 0) return res.status(400).json({ errors });
  next();
}

// ── Goals ─────────────────────────────────────────────────────

/** Full validation for POST /goals */
function validateGoal(req, res, next) {
  const { name, target, saved, deadline, startDate, priority, riskMode, incomeEstimate } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('name is required');
  }
  if (target == null || isNaN(Number(target)) || Number(target) <= 0) {
    errors.push('target must be a positive number');
  }
  if (saved !== undefined && (isNaN(Number(saved)) || Number(saved) < 0)) {
    errors.push('saved must be a non-negative number');
  }
  if (deadline !== undefined && deadline !== null && deadline !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      errors.push('deadline must be in YYYY-MM-DD format');
    }
  }
  if (startDate !== undefined && startDate !== null && startDate !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      errors.push('startDate must be in YYYY-MM-DD format');
    }
  }
  if (priority !== undefined) {
    if (!['low', 'medium', 'high'].includes(priority)) {
      errors.push('priority must be low, medium, or high');
    }
  }
  if (riskMode !== undefined) {
    if (!['safe', 'balanced', 'aggressive'].includes(riskMode)) {
      errors.push('riskMode must be safe, balanced, or aggressive');
    }
  }
  if (incomeEstimate !== undefined && incomeEstimate !== null && incomeEstimate !== '') {
    if (isNaN(Number(incomeEstimate)) || Number(incomeEstimate) < 0) {
      errors.push('incomeEstimate must be a non-negative number');
    }
  }

  if (errors.length > 0) return res.status(400).json({ errors });
  next();
}

/** Partial validation for PATCH /goals/:id */
function validateGoalPatch(req, res, next) {
  const { name, target, saved, deadline, startDate, priority, riskMode, incomeEstimate } = req.body;
  const errors = [];

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      errors.push('name cannot be empty');
    }
  }
  if (target !== undefined) {
    if (isNaN(Number(target)) || Number(target) <= 0) {
      errors.push('target must be a positive number');
    }
  }
  if (saved !== undefined) {
    if (isNaN(Number(saved)) || Number(saved) < 0) {
      errors.push('saved must be a non-negative number');
    }
  }
  if (deadline !== undefined && deadline !== null && deadline !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      errors.push('deadline must be in YYYY-MM-DD format');
    }
  }
  if (startDate !== undefined && startDate !== null && startDate !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      errors.push('startDate must be in YYYY-MM-DD format');
    }
  }
  if (priority !== undefined) {
    if (!['low', 'medium', 'high'].includes(priority)) {
      errors.push('priority must be low, medium, or high');
    }
  }
  if (riskMode !== undefined) {
    if (!['safe', 'balanced', 'aggressive'].includes(riskMode)) {
      errors.push('riskMode must be safe, balanced, or aggressive');
    }
  }
  if (incomeEstimate !== undefined && incomeEstimate !== null && incomeEstimate !== '') {
    if (isNaN(Number(incomeEstimate)) || Number(incomeEstimate) < 0) {
      errors.push('incomeEstimate must be a non-negative number');
    }
  }
  if (Object.keys(req.body).length === 0) {
    errors.push('Request body cannot be empty');
  }

  if (errors.length > 0) return res.status(400).json({ errors });
  next();
}

module.exports = { validateTransaction, validateTransactionPatch, validateGoal, validateGoalPatch };

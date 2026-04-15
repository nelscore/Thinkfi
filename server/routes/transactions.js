'use strict';

const express = require('express');
const router  = express.Router();
const { transactions: db } = require('../db');
const { requireAuth }      = require('../middleware/auth');
const { validateTransaction, validateTransactionPatch } = require('../middleware/validate');

// All routes require a valid JWT
router.use(requireAuth);

/** GET /api/transactions */
router.get('/', (req, res, next) => {
  try {
    const { type, month } = req.query;
    const data = db.getAll(req.user.id, { type, month });

    const totalIncome  = data.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = data.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    res.json({ data, total: data.length, totalIncome, totalExpense, netBalance: totalIncome - totalExpense });
  } catch (err) { next(err); }
});

/** GET /api/transactions/:id */
router.get('/:id', (req, res, next) => {
  try {
    const all = db.getAll(req.user.id);
    const tx  = all.find(t => t.id === req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    res.json(tx);
  } catch (err) { next(err); }
});

/** POST /api/transactions */
router.post('/', validateTransaction, async (req, res, next) => {
  try {
    const tx = await db.create(req.user.id, req.body);
    res.status(201).json(tx);
  } catch (err) { next(err); }
});

/** PATCH /api/transactions/:id */
router.patch('/:id', validateTransactionPatch, async (req, res, next) => {
  try {
    const updated = await db.update(req.user.id, req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Transaction not found' });
    res.json(updated);
  } catch (err) { next(err); }
});

/** DELETE /api/transactions/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    const ok = await db.remove(req.user.id, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Transaction not found' });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;

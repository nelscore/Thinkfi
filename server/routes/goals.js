'use strict';

const express = require('express');
const router  = express.Router();
const { goals: db }   = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validateGoal, validateGoalPatch } = require('../middleware/validate');

router.use(requireAuth);

/** GET /api/goals */
router.get('/', (req, res, next) => {
  try {
    const data = db.getAll(req.user.id);
    res.json({ data, total: data.length });
  } catch (err) { next(err); }
});

/** POST /api/goals */
router.post('/', validateGoal, async (req, res, next) => {
  try {
    const goal = await db.create(req.user.id, req.body);
    res.status(201).json(goal);
  } catch (err) { next(err); }
});

/** PATCH /api/goals/:id */
router.patch('/:id', validateGoalPatch, async (req, res, next) => {
  try {
    const updated = await db.update(req.user.id, req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Goal not found' });
    res.json(updated);
  } catch (err) { next(err); }
});

/** DELETE /api/goals/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    const ok = await db.remove(req.user.id, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Goal not found' });
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;

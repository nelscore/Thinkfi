'use strict';

const express = require('express');
const router  = express.Router();
const { transactions, goals } = require('../db');
const { requireAuth } = require('../middleware/auth');

function buildOfflineAIReply(message, ctx) {
  const lower = message.toLowerCase();
  const parts = [];
  const { income, expense, net, rate, topCats, goalSummary } = ctx;

  if (lower.includes('save') || lower.includes('money') || lower.includes('spend')) {
    parts.push(`You earn ₹${income.toLocaleString('en-IN')} and spend ₹${expense.toLocaleString('en-IN')} monthly.`);
    parts.push(`Your savings rate is ${rate}% and your net balance is ₹${net.toLocaleString('en-IN')}.`);
    parts.push('Focus first on the largest expense categories and automate at least one recurring savings transfer each month.');
    if (topCats) {
      parts.push(`Your top spending areas are ${topCats}. Start by cutting one small expense there.`);
    }
    if (goalSummary) {
      parts.push(`You are tracking goals such as ${goalSummary}. Keep those goals in mind when choosing where to trim costs.`);
    }
    return parts.join(' ');
  }

  if (lower.includes('goal') || lower.includes('finish') || lower.includes('deadline')) {
    if (goalSummary) {
      return `You have goals like ${goalSummary}. Prioritize the one with the nearest deadline and add a little more each month to finish faster.`;
    }
    return 'You do not have active goals yet. Create one in the Goals tab and I can help you build a savings plan.';
  }

  if (lower.includes('budget')) {
    return 'Create a simple monthly budget by dividing your spending into essentials, savings, and treats. Keep essentials under 50% of income and save at least 20%.';
  }

  return 'I am running in offline mode. Track your income and expenses, then ask me for savings tips, budgeting ideas, or goal planning advice.';
}

// ── Rate limiter (per IP, 10 req/min) ────────────────────────
const rateMap = new Map();
function isRateLimited(ip) {
  const now   = Date.now();
  const entry = rateMap.get(ip) || { count: 0, resetAt: now + 60_000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60_000; }
  entry.count++;
  rateMap.set(ip, entry);
  return entry.count > 10;
}
setInterval(() => {
  const cutoff = Date.now() - 5 * 60_000;
  for (const [ip, e] of rateMap) if (e.resetAt < cutoff) rateMap.delete(ip);
}, 5 * 60_000).unref();

/**
 * POST /api/ai/chat
 * Requires valid JWT. Builds financial context from real DB data.
 */
router.post('/chat', requireAuth, async (req, res, next) => {
  try {
    if (isRateLimited(req.ip)) {
      return res.status(429).json({ error: 'Rate limit reached. Try again in a minute.' });
    }

    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    if (message.trim().length > 1000) {
      return res.status(400).json({ error: 'message must be under 1000 characters' });
    }

    // Build context from THIS user's real data
    const txs      = transactions.getAll(req.user.id);
    const goalList = goals.getAll(req.user.id);

    const income  = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net     = income - expense;
    const rate    = income > 0 ? ((net / income) * 100).toFixed(1) : 0;

    const catTotals = {};
    txs.filter(t => t.type === 'expense').forEach(t => {
      catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    });
    const topCats = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([k, v]) => `${k}: ₹${v.toLocaleString('en-IN')}`).join(', ');

    const goalSummary = goalList
      .map(g => `${g.name} (${Math.round((g.saved / g.target) * 100)}%)`)
      .join(', ');

    const aiContext = { income, expense, net, rate, topCats, goalSummary };
    if (!process.env.ANTHROPIC_API_KEY) {
      const reply = buildOfflineAIReply(message, aiContext);
      return res.json({ reply });
    }

    const systemPrompt = `You are ThinkFi, a smart personal finance AI advisor for ${req.user.name}.
User financial data:
- Total income: ₹${income.toLocaleString('en-IN')}
- Total expenses: ₹${expense.toLocaleString('en-IN')}
- Net savings: ₹${net.toLocaleString('en-IN')}
- Savings rate: ${rate}%
- Top spending categories: ${topCats || 'none yet'}
- Goals: ${goalSummary || 'none yet'}

Instructions:
- Be concise and specific. Use bullet points (•). Max 130 words.
- Always use ₹ for Indian currency.
- Reference the actual numbers above in your advice.
- Be encouraging but honest.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: message.trim() }],
      }),
    });

    if (!response.ok) {
      console.error('Anthropic API error:', response.status);
      return res.status(502).json({ error: 'AI service unavailable. Try again shortly.' });
    }

    const data  = await response.json();
    const reply = data.content?.[0]?.text || 'Sorry, no response from AI.';
    res.json({ reply });

  } catch (err) {
    next(err);
  }
});

module.exports = router;

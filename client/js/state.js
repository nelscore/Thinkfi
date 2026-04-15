'use strict';

/**
 * state.js — Single source of truth for client-side app state.
 *
 * All data lives here after being fetched from the server.
 * UI modules read from State and call API to mutate.
 * This prevents scattered localStorage access throughout the codebase.
 */

const State = (() => {
  let _transactions = [];
  let _goals        = [];
  let _user         = { name: 'Guest', email: '', loggedIn: false };
  let _ui           = {
    route:    'home',
    theme:    localStorage.getItem('tf_theme') || 'dark',
    loading:  false,
    aiCount:  0,
    AI_LIMIT: 2,  // free queries before sign-in required
  };

  const listeners = {};

  function emit(event, payload) {
    (listeners[event] || []).forEach(fn => fn(payload));
  }

  return {
    // ── Getters ───────────────────────────────────────────────
    get transactions()  { return [..._transactions]; },
    get goals()         { return [..._goals]; },
    get user()          { return { ..._user }; },
    get ui()            { return { ..._ui }; },

    // Computed values
    get totalIncome()  { return _transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0); },
    get totalExpense() { return _transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0); },
    get netBalance()   { return this.totalIncome - this.totalExpense; },
    get savingsRate()  {
      const inc = this.totalIncome;
      return inc > 0 ? ((this.netBalance / inc) * 100).toFixed(1) : 0;
    },

    // ── Setters ───────────────────────────────────────────────
    setTransactions(data) {
      _transactions = data || [];
      emit('transactions:changed', _transactions);
    },

    setGoals(data) {
      _goals = data || [];
      emit('goals:changed', _goals);
    },

    setUser(user) {
      _user = { ..._user, ...user };
      emit('user:changed', _user);
    },

    setLoading(val) {
      _ui.loading = val;
      emit('loading:changed', val);
    },

    setRoute(route) {
      _ui.route = route;
    },

    setTheme(theme) {
      _ui.theme = theme;
      localStorage.setItem('tf_theme', theme);
      emit('theme:changed', theme);
    },

    incrementAiCount() {
      _ui.aiCount++;
    },

    get aiLimitReached() {
      return !_user.loggedIn && _ui.aiCount >= _ui.AI_LIMIT;
    },

    // ── Pub/Sub ───────────────────────────────────────────────
    on(event, fn) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },

    off(event, fn) {
      listeners[event] = (listeners[event] || []).filter(f => f !== fn);
    },
  };
})();

window.State = State;

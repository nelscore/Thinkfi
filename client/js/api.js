'use strict';

/**
 * api.js — All HTTP communication with the ThinkFi server.
 * - Automatically attaches JWT Bearer token to every request.
 * - Token stored in localStorage under 'tf_token'.
 * - On 401: clears token and triggers re-login UI.
 */

const BASE = '/api';

// ── Token management ──────────────────────────────────────────
const Auth = {
  getToken()        { return localStorage.getItem('tf_token'); },
  setToken(t)       { localStorage.setItem('tf_token', t); },
  clearToken()      { localStorage.removeItem('tf_token'); },
  isLoggedIn()      { return !!this.getToken(); },
};
window.Auth = Auth;

// ── Core request ──────────────────────────────────────────────
async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token   = Auth.getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(BASE + path, opts);

  if (res.status === 204) return null;

  const json = await res.json().catch(() => ({}));

  if (res.status === 401) {
    // Session expired or invalid — clear token and prompt re-login
    Auth.clearToken();
    if (typeof openLogin === 'function') openLogin();
    throw new Error('Session expired. Please sign in again.');
  }

  if (!res.ok) {
    const msg = json.errors?.join(', ') || json.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json;
}

// ── Auth endpoints (no JWT needed) ───────────────────────────
const sendOTPRequest     = (email, name) => request('POST', '/auth/send-otp',   { email, name });
const verifyOTPRequest   = (email, code, name) => request('POST', '/auth/verify-otp', { email, code, name });
const sendOTPPhoneRequest = (phone, name) => request('POST', '/auth/send-otp-phone',   { phone, name });
const verifyOTPPhoneRequest = (phone, code, name) => request('POST', '/auth/verify-otp-phone', { phone, code, name });
const getMe              = ()            => request('GET',  '/auth/me');
const logoutRequest      = ()            => request('POST', '/auth/logout');

// ── Transactions ──────────────────────────────────────────────
const getTransactions    = (f = {}) => { const qs = new URLSearchParams(f).toString(); return request('GET', `/transactions${qs ? '?' + qs : ''}`); };
const createTransaction  = (body)   => request('POST',   '/transactions',      body);
const updateTransaction  = (id, b)  => request('PATCH',  `/transactions/${id}`, b);
const deleteTransaction  = (id)     => request('DELETE', `/transactions/${id}`);

// ── Goals ─────────────────────────────────────────────────────
const getGoals   = ()        => request('GET',    '/goals');
const createGoal = (body)    => request('POST',   '/goals',       body);
const updateGoal = (id, b)   => request('PATCH',  `/goals/${id}`, b);
const deleteGoal = (id)      => request('DELETE', `/goals/${id}`);

// ── AI ────────────────────────────────────────────────────────
const askAI      = (msg)     => request('POST',   '/ai/chat', { message: msg });

// ── Health ────────────────────────────────────────────────────
const healthCheck = ()       => request('GET', '/health');

window.API = {
  sendOTPRequest, verifyOTPRequest, sendOTPPhoneRequest, verifyOTPPhoneRequest, getMe, logoutRequest,
  getTransactions, createTransaction, updateTransaction, deleteTransaction,
  getGoals, createGoal, updateGoal, deleteGoal,
  askAI, healthCheck,
};

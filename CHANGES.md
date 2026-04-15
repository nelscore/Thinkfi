# ThinkFi v3.1.0 — Bug Fix Changelog

## What was wrong and why it mattered

---

### 🔴 BUG 1 — PATCH /transactions used wrong validator (BREAKING)
**File:** `server/routes/transactions.js`  
**Problem:** `router.patch('/:id', validateTransaction, ...)` used the full
validator which requires ALL fields (amount, category, date, type). Any partial
update — e.g., editing just the note — would return HTTP 400.  
**Fix:** Created `validateTransactionPatch` and `validateGoalPatch` that only
validate fields that are actually present in the request body. Same fix applied
to PATCH /goals.

---

### 🔴 BUG 2 — Race condition in db.js (DATA CORRUPTION RISK)
**File:** `server/db.js`  
**Problem:** Two concurrent requests could both call `read()`, both make
changes, and the second `write()` would silently overwrite the first's changes.
Under load (e.g., seeding 13 transactions at once), this reliably caused data
loss.  
**Fix:** All write operations now go through a `withLock()` function that
serializes them through a Promise chain. Added atomic writes (write to `.tmp`
then `rename`) so a crash mid-write can't corrupt the file.

---

### 🟠 BUG 3 — Rate limiter memory leak (SERVER STABILITY)
**File:** `server/routes/ai.js`  
**Problem:** `rateMap` (a Map of IP → rate entry) was never cleaned up. Every
unique IP added an entry that stayed forever. Long-running servers accumulate
thousands of stale entries.  
**Fix:** Added a `setInterval` sweep that deletes entries older than 5 minutes.
Used `.unref()` so the interval doesn't prevent process shutdown.

---

### 🟠 BUG 4 — `fmt()` broke on negative numbers (DISPLAY BUG)
**File:** `client/js/ui.js`  
**Problem:** `fmt(-150000)` fell through to the last branch (because `-150000 >= 10000000` is false, `-150000 >= 100000` is false, `-150000 >= 1000` is false) and returned `₹150,000` — losing the minus sign entirely. Negative net balance showed as positive.  
**Fix:** Check `Math.abs(n)` for threshold comparisons, prepend sign separately.

---

### 🟠 BUG 5 — `seedDemoData` used `Promise.all` (FRAGILE)
**File:** `client/js/ui.js`  
**Problem:** `Promise.all` rejects immediately if any single transaction POST
fails. When seeding 13 transactions, one server hiccup means zero data gets
loaded, and the error is silently caught.  
**Fix:** Changed to `Promise.allSettled` — collects successful results even
if some fail. Also fixed past deadline dates (2025-xx-xx → 2026/2027).

---

### 🟡 BUG 6 — CORS wildcard in production (SECURITY)
**File:** `server/server.js`  
**Problem:** `app.use(cors())` allows any domain to make requests. In production
this means any website can call your API on behalf of your users.  
**Fix:** In production mode, only `ALLOWED_ORIGIN` env var is allowed. Dev keeps
wildcard for convenience.

---

### 🟡 BUG 7 — No input sanitization on category field (INJECTION)
**File:** `server/db.js`  
**Problem:** `body.category` was stored directly without validation. A client
could send `category: "<script>alert(1)</script>"` and it would persist.  
**Fix:** All writes now check against `VALID_CATEGORIES` Set. Invalid values
fall back to `'other'`.

---

### 🟡 BUG 8 — Deadline format not validated in db layer (DATA INTEGRITY)
**File:** `server/db.js`  
**Problem:** `body.deadline` was stored without format checking. `"not-a-date"`
would persist and later cause `new Date(g.deadline)` to return `NaN` in UI
calculations (monthly savings needed, etc.).  
**Fix:** Regex test `/^\d{4}-\d{2}-\d{2}$/` before storing. Invalid → `null`.

---

### 🟡 BUG 9 — No `.gitignore` (SECURITY / DATA LEAK)
**Problem:** `.env` (API key) and `server/data.json` (user financial data)
could be accidentally committed to git.  
**Fix:** Added `.gitignore` covering both.

---

### 🟡 BUG 10 — No body size limit (DOS VECTOR)
**File:** `server/server.js`  
**Problem:** `express.json()` with no limit accepts arbitrarily large payloads,
allowing memory exhaustion attacks.  
**Fix:** `express.json({ limit: '50kb' })`. Also added 1000-char cap on AI
messages in the route handler.

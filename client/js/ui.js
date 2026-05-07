'use strict';

/**
 * ui.js — All DOM manipulation and UI event handlers.
 * Reads from State, calls API, updates DOM.
 * No data storage here — that belongs to api.js + server.
 */
// Auto-open OTP step if redirected from welcome page
window.addEventListener('DOMContentLoaded', () => {
  if (new URLSearchParams(window.location.search).get('verify') === '1') {
  const email = sessionStorage.getItem('pendingEmail') || '';
    openLogin();
    setTimeout(() => {
      if (email) document.getElementById('lf-in').value = email;
      ls(2);
    }, 400);
  }
});
// ── Constants ────────────────────────────────────────────

const CATS = {
  salary:       '💼 Salary',
  freelance:    '💻 Freelance',
  business:     '🏢 Business',
  investment:   '📈 Investment',
  other_income: '📦 Other Income',
  food:         '🍔 Food',
  housing:      '🏠 Housing',
  transport:    '🚗 Transport',
  health:       '💊 Health',
  entertainment:'🎮 Entertainment',
  shopping:     '🛒 Shopping',
  education:    '📚 Education',
  other:        '📦 Other',
};

const CBADGE = {
  salary:'b-income', freelance:'b-income', business:'b-income',
  investment:'b-income', other_income:'b-income',
  food:'b-food', housing:'b-housing', transport:'b-transport',
  health:'b-health', entertainment:'b-entertainment',
  shopping:'b-shopping', education:'b-income', other:'b-other',
};

const CCOLORS = ['#00d4ff','#00e896','#ffb800','#b981ff','#ff4d6d','#ff7043','#4facfe','#64ffda'];

const CHART_STATE = { trendCh: null, pieCh: null, budgetCh: null };

// ── Utilities ────────────────────────────────────────────

// FIX: Handle negative numbers correctly — check absolute value for thresholds,
// then prepend sign. Old code: fmt(-150000) → '₹-150,000' (wrong branch hit).
const fmt = n => {
  const sign = n < 0 ? '-' : '';
  const abs  = Math.abs(n);
  if (abs >= 10000000) return sign + '₹' + (abs / 10000000).toFixed(2) + 'Cr';
  if (abs >= 100000)   return sign + '₹' + (abs / 100000).toFixed(1) + 'L';
  if (abs >= 1000)     return sign + '₹' + (abs / 1000).toFixed(1) + 'K';
  return sign + '₹' + abs.toLocaleString('en-IN');
};

const fmtFull = n => '₹' + Math.abs(n).toLocaleString('en-IN');
const fmtDate = d => {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
const fmtSignedFull = n => {
  const sign = n < 0 ? '-' : '';
  return sign + '\u20B9' + Math.abs(n).toLocaleString('en-IN');
};
const catShort = c => {
  const l = CATS[c] || c;
  return l.split(' ').slice(1).join(' ') || l;
};

// ── Loading indicator ────────────────────────────────────

function setLoading(id, on) {
  const el = document.getElementById(id);
  if (!el) return;
  if (on) {
    el.dataset.origText = el.textContent;
    el.disabled = true;
    el.textContent = 'Loading…';
  } else {
    el.disabled = false;
    el.textContent = el.dataset.origText || el.textContent;
  }
}

// ── Toast ────────────────────────────────────────────────

function toast(msg, type = 'i') {
  const icons = { s: '✅', e: '❌', i: 'ℹ️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-root').appendChild(t);
  setTimeout(() => {
    t.style.animation = 'tout .28s ease forwards';
    setTimeout(() => t.remove(), 280);
  }, 3200);
}

// ── History log (in-memory) ──────────────────────────────

const histLog = [];
function addHist(type, title, sub) {
  histLog.unshift({
    type, title, sub,
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  });
  if (histLog.length > 100) histLog.pop();
  renderRPHist();
}

// ── Navigation ───────────────────────────────────────────

function go(r, el, noPush) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('pg-' + r);
  if (pg) pg.classList.add('active');

  document.querySelectorAll('.nav-item[data-r],.bn-item[data-r]').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');

  if (!noPush) history.pushState({}, '', r === 'home' ? '#/home' : '#/' + r);
  State.setRoute(r);

  const labels = { home:'Home', analytics:'Analytics', goals:'Goals', data:'Data Input', budget:'Budget', settings:'Settings', about:'About' };
  document.getElementById('bc-page').textContent = labels[r] || r;

  if (r === 'analytics') refreshAnalytics();
  if (r === 'data')      refreshDataPage();
  if (r === 'goals')     renderGoals();
  if (r === 'budget')    renderBudget();

  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('show');
    document.getElementById('sb-mask').classList.remove('show');
    document.getElementById('hamb').classList.remove('open');
  }
}

window.go = go;

function toggleSB() {
  document.getElementById('sidebar').classList.toggle('show');
  document.getElementById('sb-mask').classList.toggle('show');
  document.getElementById('hamb').classList.toggle('open');
}
window.toggleSB = toggleSB;

function toggleRP(force) {
  const rp = document.getElementById('rp');
  if (!rp) return;
  const isOpen = rp.classList.contains('open');
  const shouldOpen = typeof force === 'boolean' ? force : !isOpen;
  rp.classList.toggle('open', shouldOpen);
}
window.toggleRP = toggleRP;

function closeRP() {
  const rp = document.getElementById('rp');
  if (!rp) return;
  rp.classList.remove('open');
}
window.closeRP = closeRP;

window.addEventListener('DOMContentLoaded', () => {
  const rp = document.getElementById('rp');
  const trigger = document.getElementById('rp-trigger');
  if (rp) {
    document.addEventListener('click', e => {
      if (!rp.classList.contains('open')) return;
      const isInside = rp.contains(e.target) || (trigger && trigger.contains(e.target));
      if (!isInside) closeRP();
    });
  }
});

// ── Theme ────────────────────────────────────────────────

function loadTheme() {
  const theme = State.ui.theme;
  document.documentElement.setAttribute('data-theme', theme);
  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) themeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
  const t = document.getElementById('theme-toggle');
  if (t) t.checked = theme === 'dark';
}

function toggleTheme() {
  const next = State.ui.theme === 'dark' ? 'light' : 'dark';
  State.setTheme(next);
  document.documentElement.setAttribute('data-theme', next);
  document.getElementById('theme-btn').textContent = next === 'dark' ? '🌙' : '☀️';
  const t = document.getElementById('theme-toggle');
  if (t) t.checked = next === 'dark';
  setTimeout(() => { if (CHART_STATE.trendCh) updateCharts(); }, 50);
}
window.toggleTheme = toggleTheme;

function setAIStatus(isOnline) {
  const dot = document.getElementById('ai-status-dot');
  const txt = document.getElementById('ai-status-text');
  if (!dot || !txt) return;
  if (isOnline) {
    dot.style.background = 'var(--green)';
    txt.textContent = 'Online';
    txt.style.color = 'var(--green)';
  } else {
    dot.style.background = 'var(--red)';
    txt.textContent = 'Offline';
    txt.style.color = 'var(--red)';
  }
}

async function refreshAIStatus() {
  try {
    await API.healthCheck();
    setAIStatus(true);
  } catch (_) {
    setAIStatus(false);
  }
}
window.refreshAIStatus = refreshAIStatus;

// ── Bootstrap: load all data from server ─────────────────

async function bootstrap() {
  // Restore session from stored JWT
  if (Auth.isLoggedIn()) {
    try {
      const { user } = await API.getMe();
      State.setUser({ name: user.name, email: user.email, loggedIn: true });
      unlockApp();
    } catch (_) {
      // JWT invalid or expired — clear it silently
      Auth.clearToken();
    }
  }

  if (!State.user.loggedIn) {
    // Not logged in — load demo data for preview
    seedDemoData();
    refreshAll();
    setTimeout(initCharts, 300);
    return;
  }

  try {
    const [txResult, goalResult] = await Promise.all([
      API.getTransactions(),
      API.getGoals(),
    ]);
    State.setTransactions(txResult.data);
    State.setGoals(goalResult.data);
  } catch (err) {
    console.warn('Could not load user data:', err.message);
  }
  refreshAll();
  setTimeout(initCharts, 300);
}

// ── Refresh all dashboard sections ───────────────────────

function refreshAll() {
  const inc  = State.totalIncome;
  const exp  = State.totalExpense;
  const net  = State.netBalance;
  const rate = State.savingsRate;

  animNum('s-net', net, true, true);
  animNum('s-inc', inc, false, true);
  animNum('s-exp', exp, false, true);
  document.getElementById('s-rate').textContent = rate + '%';

  document.getElementById('rp-net').textContent   = fmtSignedFull(net);
  document.getElementById('rp-rate').textContent  = rate + '%';
  document.getElementById('rp-burn').textContent  = fmtFull(exp);
  document.getElementById('rp-daily').textContent = fmtFull(Math.round(exp / 30));

  const heroNet = document.getElementById('hero-net');
  if (heroNet) heroNet.textContent = fmtSignedFull(net);
  const heroRate = document.getElementById('hero-rate');
  if (heroRate) heroRate.textContent = rate + '%';
  const heroInc = document.getElementById('hero-inc');
  if (heroInc) heroInc.textContent = fmtFull(inc);
  const heroExp = document.getElementById('hero-exp');
  if (heroExp) heroExp.textContent = fmtFull(exp);

  const runwayMonths = exp > 0 ? Math.max(0, Number((net / exp).toFixed(1))) : 0;
  const runwayLabel = exp > 0 ? `${runwayMonths} mo` : '∞ mo';
  const rpRunway = document.getElementById('rp-runway');
  if (rpRunway) rpRunway.textContent = runwayLabel;
  document.getElementById('rp-goals-ct').textContent  = State.goals.length;

  updateHealthScore(inc, exp, net, rate);
  renderHomeRecent();
  renderSpendMeter();
  renderHomeGoals();
  renderRPGoals();
  renderRPHist();
  renderRPSources();
  refreshDataPage();
  renderBudgetCats();
  renderNotifications();
}

function initHome3DMotion() {
  const hero = document.querySelector('.home-hero');
  if (!hero) return;
  hero.style.transform = 'perspective(1200px) rotateY(0deg) rotateX(0deg)';
  hero.addEventListener('mousemove', e => {
    const rect = hero.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    const rotY = x * 6;
    const rotX = -y * 5;
    hero.style.transform = `perspective(1200px) rotateY(${rotY}deg) rotateX(${rotX}deg)`;
  });
  hero.addEventListener('mouseleave', () => {
    hero.style.transform = 'perspective(1200px) rotateY(0deg) rotateX(0deg)';
  });

  // Add 3D card interactions
  document.querySelectorAll('.adv-card-3d').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      const rotY = x * 8;
      const rotX = -y * 6;
      card.style.transform = `perspective(1000px) rotateY(${rotY}deg) rotateX(${rotX}deg) translateY(-8px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg) translateY(0px)';
    });
  });
}

// ── Animated counter ─────────────────────────────────────

function animNum(id, val, signed, currency) {
  const el = document.getElementById(id);
  if (!el) return;
  const target = Math.abs(val);
  let current = 0;
  const step = target / 50;
  const timer = setInterval(() => {
    current += step;
    if (current >= target) { current = target; clearInterval(timer); }
    el.textContent = (signed && val < 0 ? '-' : '') + (currency ? '₹' : '') + Math.round(current).toLocaleString('en-IN');
  }, 16);
}

// ── Health Score ─────────────────────────────────────────

function updateHealthScore(inc, exp, net, rate) {
  let score = 40;
  if (rate >= 30) score += 30; else if (rate >= 20) score += 20; else if (rate >= 10) score += 10;
  if (exp < inc) score += 15;
  if (State.goals.length >= 2) score += 10;
  if (State.goals.some(g => (g.saved / g.target) >= 0.5)) score += 5;
  score = Math.min(100, Math.max(0, score));

  document.getElementById('health-pct').textContent  = score;
  document.getElementById('health-num').textContent  = score + '/100';

  const status = score >= 80 ? 'Excellent 🏆' : score >= 65 ? 'Good 👍' : score >= 45 ? 'Fair ⚠️' : 'Needs Work 🔴';
  const color  = score >= 80 ? 'var(--green)' : score >= 65 ? 'var(--c1)' : score >= 45 ? 'var(--amber)' : 'var(--red)';
  const statusEl = document.getElementById('health-status');
  statusEl.textContent = status;
  statusEl.style.color = color;

  const tips = [];
  if (rate < 20)   tips.push('💡 Save at least 20% of income');
  if (exp > inc)   tips.push('⚠️ Spending exceeds income — urgent');
  if (!State.goals.length) tips.push('🎯 Set a goal to boost your score');
  document.getElementById('health-tips').textContent = tips.join(' · ');

  const circ  = 238.76;
  const ring  = document.getElementById('health-ring');
  ring.style.strokeDashoffset = circ - (score / 100) * circ;
  ring.style.stroke = color;
  document.getElementById('health-pct').style.color = color;
}

// ── Home: recent transactions ─────────────────────────────

function renderHomeRecent() {
  const all = [...State.transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);
  const el = document.getElementById('home-recent');
  if (!all.length) {
    el.innerHTML = `<div style="text-align:center;padding:28px;">
      <div style="font-size:32px;">💳</div>
      <div style="font-size:13px;color:var(--text2);margin-top:8px;">No transactions yet</div>
      <button class="btn btn-outline btn-sm" style="margin-top:12px;" onclick="go('data',document.querySelector('[data-r=data]'))">Add First Entry</button>
    </div>`;
    return;
  }
  el.innerHTML = `<div class="tbl-wrap"><table>
    <thead><tr><th>Description</th><th>Category</th><th>Amount</th></tr></thead>
    <tbody>${all.map(t => `
      <tr>
        <td>${t.note || catShort(t.category)}</td>
        <td><span class="badge ${CBADGE[t.category] || 'b-other'}">${catShort(t.category)}</span></td>
        <td class="mono" style="color:${t.type === 'income' ? 'var(--green)' : 'var(--red)'};">
          ${t.type === 'income' ? '+' : '-'}${fmtFull(t.amount)}
        </td>
      </tr>`).join('')}
    </tbody></table></div>`;
}

// ── Home: spending meter ──────────────────────────────────

function renderSpendMeter() {
  const cats = {};
  State.transactions.filter(t => t.type === 'expense').forEach(t => {
    cats[t.category] = (cats[t.category] || 0) + t.amount;
  });
  const total = Object.values(cats).reduce((s, v) => s + v, 0) || 1;
  const el = document.getElementById('home-spend-meter');
  if (!Object.keys(cats).length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text2);text-align:center;padding:16px;">No expenses recorded yet</div>`;
    return;
  }
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 5);
  el.innerHTML = sorted.map(([cat, amt], i) => {
    const pct = (amt / total * 100).toFixed(0);
    return `<div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
        <span style="color:var(--text1);">${CATS[cat] || cat}</span>
        <span class="mono" style="font-size:11px;">${fmtFull(amt)} (${pct}%)</span>
      </div>
      <div class="prog"><div class="prog-fill" style="width:${pct}%;background:${CCOLORS[i % CCOLORS.length]};"></div></div>
    </div>`;
  }).join('');
}

// ── Home: goal progress ───────────────────────────────────

function renderHomeGoals() {
  const goals = State.goals;
  const el = document.getElementById('home-goals');
  const pfArr = ['pf-c1', 'pf-green', 'pf-amber', 'pf-purple'];
  if (!goals.length) {
    el.innerHTML = `<div style="text-align:center;padding:20px;">
      <div style="font-size:28px;">🎯</div>
      <div style="font-size:12px;color:var(--text2);margin-top:6px;">No goals yet</div>
      <button class="btn btn-outline btn-sm" style="margin-top:10px;" onclick="go('goals',document.querySelector('[data-r=goals]'))">Create Goal</button>
    </div>`;
    return;
  }
  el.innerHTML = goals.slice(0, 3).map((g, i) => {
    const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
    return `<div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px;">
        <span style="font-weight:600;">${g.name}</span>
        <span class="mono" style="font-size:12px;color:var(--c1);">${pct}%</span>
      </div>
      <div class="prog"><div class="prog-fill ${pfArr[i % 4]}" style="width:${pct}%;"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-top:4px;">
        <span>${fmtFull(g.saved)}</span><span>${fmtFull(g.target)}</span>
      </div>
    </div>`;
  }).join('');
}

// ── Transaction form ──────────────────────────────────────

let txType = 'income';
let editingTxId = null;

function setType(t) {
  txType = t;
  document.getElementById('tt-inc').className = 'tt-opt income' + (t === 'income' ? ' on' : '');
  document.getElementById('tt-exp').className = 'tt-opt expense' + (t === 'expense' ? ' on' : '');
  document.getElementById('tx-src-lbl').textContent = t === 'income' ? 'Source *' : 'Category *';
  const sel = document.getElementById('tx-cat');
  sel.innerHTML = t === 'income'
    ? `<option value="">Select source</option>
       <option value="salary">💼 Salary</option>
       <option value="freelance">💻 Freelance</option>
       <option value="business">🏢 Business</option>
       <option value="investment">📈 Investment</option>
       <option value="other_income">📦 Other Income</option>`
    : `<option value="">Select category</option>
       <option value="food">🍔 Food & Dining</option>
       <option value="housing">🏠 Housing & Rent</option>
       <option value="transport">🚗 Transport</option>
       <option value="health">💊 Health</option>
       <option value="entertainment">🎮 Entertainment</option>
       <option value="shopping">🛒 Shopping</option>
       <option value="education">📚 Education</option>
       <option value="other">📦 Other</option>`;
}
window.setType = setType;

async function saveTx() {
  const amt  = parseFloat(document.getElementById('tx-amt').value);
  const cat  = document.getElementById('tx-cat').value;
  const dt   = document.getElementById('tx-dt').value;
  const note = document.getElementById('tx-note').value.trim();
  let ok = true;

  if (!amt || amt <= 0) { document.getElementById('e-amt').style.display = 'block'; ok = false; }
  else document.getElementById('e-amt').style.display = 'none';
  if (!cat)  { document.getElementById('e-cat').style.display = 'block'; ok = false; }
  else document.getElementById('e-cat').style.display = 'none';
  if (!dt)   { document.getElementById('e-dt').style.display = 'block'; ok = false; }
  else document.getElementById('e-dt').style.display = 'none';
  if (!ok) return;

  const body = { amount: amt, category: cat, date: dt, type: txType, note };

  setLoading('save-tx-btn', true);
  try {
    if (editingTxId) {
      const updated = await API.updateTransaction(editingTxId, body);
      State.setTransactions(State.transactions.map(t => t.id === editingTxId ? updated : t));
      addHist(txType, `Updated: ${fmtFull(amt)}`, CATS[cat] || cat);
      toast('Transaction updated ✅', 's');
      cancelEdit();
    } else {
      const tx = await API.createTransaction(body);
      State.setTransactions([tx, ...State.transactions]);
      addHist(txType, `${txType === 'income' ? 'Income' : 'Expense'}: ${fmtFull(amt)}`, CATS[cat] || cat);
      toast('Transaction saved ✅', 's');
    }
    document.getElementById('tx-amt').value  = '';
    document.getElementById('tx-note').value = '';
    document.getElementById('tx-cat').value  = '';
    checkBudgetAlerts(cat, amt);
    refreshAll();
    updateCharts();
  } catch (err) {
    toast('Error: ' + err.message, 'e');
  } finally {
    setLoading('save-tx-btn', false);
  }
}
window.saveTx = saveTx;

// ── Edit drawer ───────────────────────────────────────────

function openEditDrawer(tx) {
  editingTxId = tx.id;
  // Switch to data page
  go('data', document.querySelector('[data-r=data]'));

  // Pre-fill form
  setType(tx.type);
  setTimeout(() => {
    document.getElementById('tx-amt').value  = tx.amount;
    document.getElementById('tx-cat').value  = tx.category;
    document.getElementById('tx-dt').value   = tx.date;
    document.getElementById('tx-note').value = tx.note || '';
  }, 50);

  // Show cancel button and update save btn text
  document.getElementById('save-tx-btn').textContent = '💾 Update Transaction';
  document.getElementById('cancel-edit-btn').style.display = 'block';
  document.getElementById('tx-amt').focus();
  toast('Editing transaction — make changes and save', 'i');
}

function cancelEdit() {
  editingTxId = null;
  document.getElementById('save-tx-btn').textContent = '💾 Save Transaction';
  document.getElementById('cancel-edit-btn').style.display = 'none';
  setType('income');
}
window.cancelEdit = cancelEdit;

// ── Budget alerts ─────────────────────────────────────────

function checkBudgetAlerts(cat, amt) {
  const bl = JSON.parse(localStorage.getItem('tf_bl') || '{}');
  if (!bl[cat]) return;
  const spent = State.transactions
    .filter(t => t.type === 'expense' && t.category === cat)
    .reduce((s, t) => s + t.amount, 0);
  if (spent > bl[cat]) toast(`⚠️ Over budget in ${catShort(cat)}!`, 'e');
  else if (spent / bl[cat] >= 0.8) toast(`⚡ 80% of ${catShort(cat)} budget used`, 'i');
}

// ── Data page ─────────────────────────────────────────────

function refreshDataPage() {
  const all = State.transactions;
  document.getElementById('qs-tot').textContent = all.length;
  const mo = new Date().toISOString().slice(0, 7);
  document.getElementById('qs-mo').textContent  = all.filter(t => t.date && t.date.startsWith(mo)).length;
  document.getElementById('qs-inc').textContent = fmtFull(State.totalIncome);
  document.getElementById('qs-exp').textContent = fmtFull(State.totalExpense);

  const recent = [...all].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const el = document.getElementById('data-recent');
  if (!recent.length) {
    el.innerHTML = `<div style="text-align:center;padding:20px;font-size:12px;color:var(--text2);">No entries yet</div>`;
    return;
  }
  el.innerHTML = recent.map(t => `
    <div class="tr-row">
      <div class="tr-left">
        <div class="tr-dot" style="background:${t.type === 'income' ? 'var(--green)' : 'var(--red)'}"></div>
        ${t.note || catShort(t.category)}
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="tr-right" style="color:${t.type === 'income' ? 'var(--green)' : 'var(--red)'};">
          ${t.type === 'income' ? '+' : '-'}${fmtFull(t.amount)}
        </div>
        <span style="cursor:pointer;color:var(--c1);font-size:13px;" onclick="openEditDrawer(${JSON.stringify(t).replace(/"/g, '&quot;')})">✏️</span>
        <span class="td-del" onclick="delTx('${t.id}')">🗑</span>
      </div>
    </div>`).join('');
}

// ── Analytics ─────────────────────────────────────────────

function refreshAnalytics() {
  document.getElementById('an-inc').textContent = fmtFull(State.totalIncome);
  document.getElementById('an-exp').textContent = fmtFull(State.totalExpense);
  document.getElementById('an-sav').textContent = fmtSignedFull(State.netBalance);
  renderCatBreakdown();
  renderTxTable();
  if (!CHART_STATE.trendCh || !CHART_STATE.pieCh) initCharts();
  updateCharts();
}

function renderCatBreakdown() {
  const cats = {};
  State.transactions.filter(t => t.type === 'expense').forEach(t => {
    cats[t.category] = (cats[t.category] || 0) + t.amount;
  });
  const total = Object.values(cats).reduce((s, v) => s + v, 0) || 1;
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const el = document.getElementById('an-cat-list');
  if (!sorted.length) {
    el.innerHTML = `<div style="font-size:13px;color:var(--text2);padding:16px;text-align:center;">No expense data yet</div>`;
    return;
  }
  el.innerHTML = sorted.map(([cat, amt], i) => `
    <div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
        <span style="font-size:13px;color:var(--text1);">${CATS[cat] || cat}</span>
        <span class="mono" style="font-size:12px;">${fmtFull(amt)}&nbsp;<span style="color:var(--text2);">(${((amt / total) * 100).toFixed(1)}%)</span></span>
      </div>
      <div class="prog"><div class="prog-fill" style="width:${(amt / total * 100).toFixed(1)}%;background:${CCOLORS[i % CCOLORS.length]};"></div></div>
    </div>`).join('');
}

function renderTxTable(filter = '', catFilter = '') {
  let all = [...State.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (filter)    all = all.filter(t => (t.note || catShort(t.category)).toLowerCase().includes(filter.toLowerCase()));
  if (catFilter) all = all.filter(t => t.category === catFilter);

  const body  = document.getElementById('an-tx-body');
  const empty = document.getElementById('an-tx-empty');

  if (!all.length) { body.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  body.innerHTML = all.map(t => `
    <tr>
      <td>${t.note || catShort(t.category)}</td>
      <td><span class="badge ${CBADGE[t.category] || 'b-other'}">${catShort(t.category)}</span></td>
      <td><span class="badge ${t.type === 'income' ? 'b-income' : 'b-health'}">${t.type === 'income' ? 'Income' : 'Expense'}</span></td>
      <td style="color:var(--text2);">${fmtDate(t.date)}</td>
      <td class="mono" style="text-align:right;color:${t.type === 'income' ? 'var(--green)' : 'var(--red)'};">
        ${t.type === 'income' ? '+' : '-'}${fmtFull(t.amount)}
      </td>
      <td style="display:flex;gap:8px;align-items:center;">
        <span style="cursor:pointer;color:var(--c1);" onclick="openEditDrawer(${JSON.stringify(t).replace(/"/g, '&quot;')})">✏️</span>
        <span class="td-del" onclick="delTx('${t.id}')">🗑</span>
      </td>
    </tr>`).join('');
}
window.renderTxTable = renderTxTable;

function filterTx() {
  renderTxTable(
    document.getElementById('tx-search').value,
    document.getElementById('tx-cat-filter').value,
  );
}
window.filterTx = filterTx;

async function delTx(id) {
  if (!confirm('Delete this transaction?')) return;
  try {
    await API.deleteTransaction(id);
    State.setTransactions(State.transactions.filter(t => t.id !== id));
    toast('Deleted', 'i');
    refreshAll();
    updateCharts();
    if (State.ui.route === 'analytics') renderTxTable();
  } catch (err) {
    toast('Error: ' + err.message, 'e');
  }
}
window.delTx = delTx;

// ── Search ────────────────────────────────────────────────

function doSearch() {
  const q   = document.getElementById('srch-in').value.trim().toLowerCase();
  const res = document.getElementById('srch-res');
  if (!q) { res.innerHTML = ''; return; }
  const all = [...State.transactions, ...State.goals.map(g => ({ ...g, _isGoal: true }))];
  const hits = all.filter(t => {
    const nm = (t.note || t.name || catShort(t.category) || '').toLowerCase();
    return nm.includes(q);
  }).slice(0, 8);
  if (!hits.length) {
    res.innerHTML = `<div style="padding:12px;font-size:12px;color:var(--text2);">No results</div>`;
    return;
  }
  res.innerHTML = hits.map(t => `
    <div class="sr-row" onclick="document.getElementById('srch-in').value='';document.getElementById('srch-res').style.display='none';go('${t._isGoal ? 'goals' : 'analytics'}',document.querySelector('[data-r=${t._isGoal ? 'goals' : 'analytics'}]'))">
      <span>${t._isGoal ? '🎯' : t.type === 'income' ? '💚' : '🔴'}</span>
      <span>${t.note || t.name || catShort(t.category)}</span>
      <span class="sr-type">${t._isGoal ? 'Goal' : t.type === 'income' ? '+' + fmtFull(t.amount) : '-' + fmtFull(t.amount)}</span>
    </div>`).join('');
}
window.doSearch = doSearch;

// ── Charts ────────────────────────────────────────────────

function initCharts() {
  const base = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ' ₹' + ctx.raw.toLocaleString('en-IN') } },
    },
  };

  const c1 = document.getElementById('trend-ch');
  if (c1) {
    const { months, iData, eData } = getTrend();
    CHART_STATE.trendCh = new Chart(c1, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          { label: 'Income',   data: iData, backgroundColor: 'rgba(0,232,150,0.7)',  borderRadius: 6, borderSkipped: false },
          { label: 'Expenses', data: eData, backgroundColor: 'rgba(255,77,109,0.65)', borderRadius: 6, borderSkipped: false },
        ],
      },
      options: {
        ...base,
        plugins: { ...base.plugins, legend: { display: true, labels: { color: '#9aa5be', font: { family: 'Plus Jakarta Sans', size: 11 }, boxWidth: 12, padding: 12 } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#4e5d78', font: { family: 'JetBrains Mono', size: 10 } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4e5d78', font: { family: 'JetBrains Mono', size: 10 }, callback: v => '₹' + (v / 1000) + 'K' } },
        },
      },
    });
  }

  const c2 = document.getElementById('pie-ch');
  if (c2) {
    const { labels, data } = getCatData();
    CHART_STATE.pieCh = new Chart(c2, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: CCOLORS.slice(0, data.length), borderWidth: 2, borderColor: 'var(--bg2)', hoverOffset: 6 }] },
      options: {
        ...base, cutout: '66%',
        plugins: { ...base.plugins, legend: { display: true, position: 'right', labels: { color: '#9aa5be', font: { family: 'Plus Jakarta Sans', size: 10 }, boxWidth: 10, padding: 10 } }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ₹${ctx.raw.toLocaleString('en-IN')}` } } },
      },
    });
  }

  const c3 = document.getElementById('budget-bar-ch');
  if (c3) {
    const { bLabels, bData } = getBudgetBarData();
    CHART_STATE.budgetCh = new Chart(c3, {
      type: 'bar',
      data: { labels: bLabels, datasets: [{ data: bData, backgroundColor: CCOLORS.slice(0, bData.length), borderRadius: 8, borderSkipped: false }] },
      options: { ...base, indexAxis: 'y', scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4e5d78', font: { size: 10 }, callback: v => '₹' + (v / 1000) + 'K' } }, y: { grid: { display: false }, ticks: { color: '#9aa5be', font: { size: 11 } } } } },
    });
  }
}

function getTrend() {
  const months = [], iData = [], eData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    months.push(d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }));
    iData.push(State.transactions.filter(t => t.type === 'income'  && t.date && t.date.startsWith(key)).reduce((s, t) => s + t.amount, 0));
    eData.push(State.transactions.filter(t => t.type === 'expense' && t.date && t.date.startsWith(key)).reduce((s, t) => s + t.amount, 0));
  }
  return { months, iData, eData };
}

function getCatData() {
  const cats = {};
  State.transactions.filter(t => t.type === 'expense').forEach(t => {
    cats[t.category] = (cats[t.category] || 0) + t.amount;
  });
  const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return { labels: ['No data'], data: [1] };
  return { labels: entries.map(([c]) => catShort(c)), data: entries.map(([, v]) => v) };
}
function getBudgetBarData() {
  const cats = {};
  State.transactions.filter(t => t.type === 'expense').forEach(t => {
    cats[t.category] = (cats[t.category] || 0) + t.amount;
  });
  const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return { bLabels: entries.map(([c]) => catShort(c)), bData: entries.map(([, v]) => v) };
}

function updateCharts() {
  if (CHART_STATE.trendCh) {
    const { months, iData, eData } = getTrend();
    CHART_STATE.trendCh.data.labels = months;
    CHART_STATE.trendCh.data.datasets[0].data = iData;
    CHART_STATE.trendCh.data.datasets[1].data = eData;
    CHART_STATE.trendCh.update();
  }
  if (CHART_STATE.pieCh) {
    const { labels, data } = getCatData();
    CHART_STATE.pieCh.data.labels = labels;
    CHART_STATE.pieCh.data.datasets[0].data = data;
    CHART_STATE.pieCh.data.datasets[0].backgroundColor = CCOLORS.slice(0, data.length);
    CHART_STATE.pieCh.update();
  }
  if (CHART_STATE.budgetCh) {
    const { bLabels, bData } = getBudgetBarData();
    CHART_STATE.budgetCh.data.labels = bLabels;
    CHART_STATE.budgetCh.data.datasets[0].data = bData;
    CHART_STATE.budgetCh.data.datasets[0].backgroundColor = CCOLORS.slice(0, bData.length);
    CHART_STATE.budgetCh.update();
  }
}

// ── Goals ─────────────────────────────────────────────────

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function formatDeltaDays(days) {
  if (days === 1) return '1 day';
  return `${days.toLocaleString('en-IN')} days`;
}
function getGoalFormState() {
  const nm = document.getElementById('g-nm')?.value.trim();
  const tgt = parseFloat(document.getElementById('g-tgt')?.value);
  const sav = parseFloat(document.getElementById('g-sav')?.value) || 0;
  const st = document.getElementById('g-start')?.value;
  const dl = document.getElementById('g-dl')?.value;
  const pri = document.getElementById('g-priority')?.value || 'medium';
  const risk = document.getElementById('g-risk')?.value || 'balanced';
  const income = parseFloat(document.getElementById('g-income')?.value);
  const extra = parseFloat(document.getElementById('g-extra')?.value) || 0;
  return {
    name: nm,
    target: isNaN(tgt) ? 0 : tgt,
    saved: isNaN(sav) ? 0 : sav,
    startDate: st,
    deadline: dl,
    priority: pri,
    riskMode: risk,
    incomeEstimate: isNaN(income) ? null : income,
    extraMonthly: isNaN(extra) ? 0 : extra,
  };
}

function computeGoalPlan(goal = {}) {
  const today = new Date();
  const planStart = (goal.startDate && /^\d{4}-\d{2}-\d{2}$/.test(goal.startDate))
    ? new Date(goal.startDate + 'T00:00:00')
    : today;
  const start = planStart < today ? today : planStart;
  let end = (goal.deadline && /^\d{4}-\d{2}-\d{2}$/.test(goal.deadline)) ? new Date(goal.deadline + 'T00:00:00') : null;
  const target = Math.max(0, Number(goal.target) || 0);
  const saved = Math.max(0, Number(goal.saved) || 0);
  const remaining = Math.max(0, target - saved);
  let monthsRemaining;
  let daysRemaining;

  if (end && !isNaN(end)) {
    daysRemaining = Math.max(0, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));
    monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30));
  } else {
    const fallback = { low: 9, medium: 6, high: 4 }[goal.priority] || 6;
    monthsRemaining = fallback;
    daysRemaining = fallback * 30;
    end = addDays(start, daysRemaining);
  }

  const baseMonthly = remaining === 0 ? 0 : Math.max(1, Math.ceil(remaining / monthsRemaining));
  const weekly = Math.max(1, Math.ceil(baseMonthly / 4.348));
  const daily = Math.max(1, Math.ceil(baseMonthly / 30));
  const actualDays = Math.max(1, Math.ceil((today - start) / (24 * 60 * 60 * 1000)));
  const actualDailyPace = saved / actualDays;
  const paceRatio = remaining === 0 ? 1.2 : actualDailyPace / Math.max(daily, 1);
  const status = remaining === 0 ? 'ahead' : paceRatio >= 1.05 ? 'ahead' : paceRatio >= 0.9 ? 'on track' : 'behind';
  const statusLabel = remaining === 0 ? 'Completed' : status === 'ahead' ? 'Ahead of schedule' : status === 'on track' ? 'On track' : 'Falling behind';
  const predictedDays = remaining === 0 ? 0 : Math.max(1, Math.ceil(remaining / Math.max(actualDailyPace, daily)));
  const predictedEnd = addDays(today, predictedDays);
  const safeMonths = Math.max(1, Math.ceil(monthsRemaining * 1.25));
  const aggressiveMonths = Math.max(1, Math.max(1, Math.floor(monthsRemaining * 0.75)));
  const safeMonthly = remaining === 0 ? 0 : Math.max(1, Math.ceil(remaining / safeMonths));
  const aggressiveMonthly = remaining === 0 ? 0 : Math.max(1, Math.ceil(remaining / aggressiveMonths));
  const safeEnd = remaining === 0 ? today : addDays(today, Math.ceil(remaining / safeMonthly * 30));
  const recommendedEnd = remaining === 0 ? today : addDays(today, Math.ceil(remaining / baseMonthly * 30));
  const aggressiveEnd = remaining === 0 ? today : addDays(today, Math.ceil(remaining / aggressiveMonthly * 30));
  const planCards = [
    { id: 'safe', title: 'Safe plan', monthly: safeMonthly, finish: safeEnd, note: 'Lower monthly, longer runway', highlight: false },
    { id: 'recommended', title: 'Recommended plan', monthly: baseMonthly, finish: recommendedEnd, note: 'Balanced pace for this goal', highlight: true },
    { id: 'aggressive', title: 'Aggressive plan', monthly: aggressiveMonthly, finish: aggressiveEnd, note: 'Faster completion, higher pressure', highlight: false },
  ];

  let insight = 'Your coach is waiting for the first goal details.';
  if (remaining === 0) {
    insight = 'This goal is already complete. Great work!';
  } else if (!goal.deadline) {
    insight = `Target date not set. Based on ${goal.priority} priority, this plan tracks to ${fmtDate(end)}.`;
  } else if (status === 'behind') {
    const slower = Math.max(0, Math.round((1 - paceRatio) * 100));
    insight = `You are saving ${slower}% slower than required. Add ₹${Math.max(0, baseMonthly - Math.round(actualDailyPace * 30))} / month to stay on track.`;
  } else if (status === 'on track') {
    insight = 'You are on track. Keep this pace and check back after your next savings update.';
  } else {
    insight = 'You are ahead of schedule. Nice momentum — keep the consistency going.';
  }

  const extra = Math.max(0, Number(goal.extraMonthly) || 0);
  const whatIfMonthly = baseMonthly + extra;
  const whatIfDays = remaining === 0 ? 0 : Math.max(1, Math.ceil(remaining / Math.max(1, whatIfMonthly / 30)));
  const whatIfFinish = addDays(today, whatIfDays);
  const deltaDays = predictedDays - whatIfDays;
  const whatIfText = extra === 0
    ? 'Add more to see earlier completion.'
    : deltaDays > 0
      ? `Add ₹${extra.toLocaleString('en-IN')} / month → finish ${formatDeltaDays(deltaDays)} earlier.`
      : 'This pace keeps the current finish date.';

  return {
    target,
    saved,
    remaining,
    daysRemaining,
    monthsRemaining,
    baseMonthly,
    weekly,
    daily,
    predictedEnd,
    status,
    statusLabel,
    insight,
    planCards,
    forecast: remaining === 0 ? 'Goal complete.' : `At current pace, finish on ${fmtDate(predictedEnd)}.`,
    whatIfText,
    whatIfMonthly,
    deadline: end,
    start,
  };
}

function paintGoalPreview() {
  const state = getGoalFormState();
  const previewBlock = document.getElementById('goal-preview-copy');
  const previewTag = document.getElementById('goal-preview-tag');
  const previewMonthly = document.getElementById('goal-preview-monthly');
  const previewWeekly = document.getElementById('goal-preview-weekly');
  const previewDaily = document.getElementById('goal-preview-daily');
  const previewInsight = document.getElementById('goal-preview-insight');
  const planCards = document.getElementById('goal-plan-cards');
  const simOutput = document.getElementById('goal-sim-output');

  if (!state.target || state.target <= 0) {
    previewTag.textContent = 'Start with a target amount';
    previewTag.style.background = 'rgba(255,206,0,0.12)';
    previewMonthly.textContent = '₹0';
    previewWeekly.textContent = '₹0';
    previewDaily.textContent = '₹0';
    previewBlock.textContent = 'Enter your target amount and optional deadline to see the goal pace and plan options.';
    previewInsight.textContent = 'Your coach will help you choose the right savings path.';
    planCards.innerHTML = '';
    simOutput.textContent = 'Add more to see earlier completion.';
    return;
  }

  const plan = computeGoalPlan(state);
  previewTag.textContent = plan.statusLabel;
  previewTag.style.background = plan.status === 'behind' ? 'rgba(255,78,92,0.12)' : plan.status === 'ahead' ? 'rgba(0,255,136,0.12)' : 'rgba(0,212,255,0.12)';
  previewMonthly.textContent = fmtFull(plan.baseMonthly);
  previewWeekly.textContent = fmtFull(plan.weekly);
  previewDaily.textContent = fmtFull(plan.daily);
  previewBlock.textContent = plan.forecast;
  previewInsight.textContent = plan.insight;

  planCards.innerHTML = plan.planCards.map(card => `
    <div class="goal-plan-card ${card.highlight ? 'recommended' : ''}">
      <div class="goal-plan-card-title">${card.title}</div>
      <div class="goal-plan-card-metric">${fmtFull(card.monthly)}</div>
      <div class="goal-plan-card-meta">Finish by ${fmtDate(card.finish)}</div>
      <div class="goal-plan-card-meta">${card.note}</div>
    </div>
  `).join('');

  simOutput.textContent = plan.whatIfText;
}

function updateGoalPreview() {
  paintGoalPreview();
}

function setGoalRisk(mode) {
  const hidden = document.getElementById('g-risk');
  if (!hidden) return;
  hidden.value = mode;
  document.querySelectorAll('.goal-pill').forEach(el => el.classList.toggle('active', el.dataset.mode === mode));
  updateGoalPreview();
}

function openGoalPP() {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('g-nm').value = '';
  document.getElementById('g-tgt').value = '';
  document.getElementById('g-sav').value = '';
  document.getElementById('g-start').value = today;
  document.getElementById('g-dl').value = '';
  document.getElementById('g-priority').value = 'medium';
  document.getElementById('g-risk').value = 'balanced';
  document.getElementById('g-income').value = '';
  document.getElementById('g-extra').value = 0;
  document.getElementById('ge-nm').style.display = 'none';
  document.getElementById('ge-tgt').style.display = 'none';
  document.querySelectorAll('.goal-pill').forEach(el => el.classList.toggle('active', el.dataset.mode === 'balanced'));
  updateGoalPreview();
  document.getElementById('ov-goal').classList.add('open');
}

function closeGoalPP() { document.getElementById('ov-goal').classList.remove('open'); }
window.openGoalPP  = openGoalPP;
window.closeGoalPP = closeGoalPP;

async function saveGoal() {
  const nm = document.getElementById('g-nm').value.trim();
  const tgt = parseFloat(document.getElementById('g-tgt').value);
  const sav = parseFloat(document.getElementById('g-sav').value) || 0;
  const st = document.getElementById('g-start').value;
  const dl = document.getElementById('g-dl').value;
  const priority = document.getElementById('g-priority').value || 'medium';
  const riskMode = document.getElementById('g-risk').value || 'balanced';
  const incomeEstimate = parseFloat(document.getElementById('g-income').value);
  let ok = true;

  if (!nm) { document.getElementById('ge-nm').style.display = 'block'; ok = false; } else document.getElementById('ge-nm').style.display = 'none';
  if (!tgt || tgt <= 0) { document.getElementById('ge-tgt').style.display = 'block'; ok = false; } else document.getElementById('ge-tgt').style.display = 'none';
  if (!ok) return;

  try {
    const body = {
      name: nm,
      target: tgt,
      saved: sav,
      startDate: st || new Date().toISOString().slice(0, 10),
      deadline: dl || null,
      priority,
      riskMode,
      incomeEstimate: isNaN(incomeEstimate) ? null : incomeEstimate,
    };
    const goal = await API.createGoal(body);
    State.setGoals([...State.goals, goal]);
    addHist('goal', `Goal created: ${nm}`, `Target: ${fmtFull(tgt)}`);
    document.getElementById('g-nm').value = '';
    document.getElementById('g-tgt').value = '';
    document.getElementById('g-sav').value = '';
    document.getElementById('g-dl').value = '';
    document.getElementById('g-income').value = '';
    document.getElementById('g-extra').value = 0;
    closeGoalPP();
    toast('Goal created! 🎯', 's');
    renderGoals(); renderRPGoals(); renderHomeGoals();
  } catch (err) {
    toast('Error: ' + err.message, 'e');
  }
}
window.saveGoal = saveGoal;

function renderGoals() {
  const goals = State.goals;
  const emptyEl = document.getElementById('goals-empty');
  const dashEl = document.getElementById('goals-dashboard');
  const listEl = document.getElementById('goals-list');
  const achievedEl = document.getElementById('goals-achieved');
  const achievedSection = document.getElementById('achieved-section');
  
  if (!goals.length) {
    emptyEl.style.display = 'block';
    dashEl.style.display = 'none';
    return;
  }
  
  emptyEl.style.display = 'none';
  dashEl.style.display = 'block';

  // Separate active and achieved goals
  const activeGoals = goals.filter(g => (g.saved / g.target) < 1);
  const achievedGoals = goals.filter(g => (g.saved / g.target) >= 1);

  // Calculate summary stats
  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const activeCount = activeGoals.length;
  const achievedCount = achievedGoals.length;
  
  // Calculate monthly target (average across active goals with deadlines)
  let monthlyTotal = 0;
  activeGoals.forEach(g => {
    if (g.deadline) {
      const rem = g.target - g.saved;
      const daysLeft = Math.max(1, (new Date(g.deadline) - Date.now()) / (24 * 60 * 60 * 1000));
      const mos = Math.max(1, Math.ceil(daysLeft / 30));
      monthlyTotal += Math.ceil(rem / mos);
    }
  });

  // Update metric cards
  document.getElementById('goals-active-count').textContent = activeCount;
  document.getElementById('goals-achieved-count').textContent = achievedCount;
  document.getElementById('goals-total-saved').textContent = fmtFull(totalSaved);
  document.getElementById('goals-monthly-target').textContent = fmtFull(monthlyTotal);

  // Render active goals
  listEl.innerHTML = '';
  if (activeGoals.length === 0) {
    document.getElementById('goals-no-active').style.display = 'block';
  } else {
    document.getElementById('goals-no-active').style.display = 'none';
    activeGoals.forEach((g, i) => {
      const plan = computeGoalPlan(g);
      const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
      const rem = g.target - g.saved;
      const colors = ['#00d4ff', '#00ff88', '#ffab00', '#ff6b9d', '#9d5bff'];
      const color = colors[i % colors.length];

      const card = document.createElement('div');
      card.className = `goal-card goal-${i % 4}`;
      
      // Determine if on track
      const isOnTrack = plan.baseMonthly > 0 && g.saved >= (g.target * 0.25); // Basic heuristic
      const statusLabel = isOnTrack ? 'On Track ✓' : 'Falling Behind ⚠';
      const statusClass = isOnTrack ? 'on-track' : 'falling-behind';
      
      card.innerHTML = `
        <div class="goal-card-top">
          <div class="goal-name" style="display:flex;align-items:center;gap:8px;">
            ${g.name}
          </div>
          <div class="goal-status-badge ${statusClass}">${statusLabel}</div>
        </div>

        <div class="goal-progress-wrap">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;">Progress</span>
            <span class="goal-pct">${pct}%</span>
          </div>
          <div class="goal-progress-bar">
            <div class="goal-progress-fill" style="width:${pct}%;"></div>
          </div>
        </div>

        <div class="goal-amounts">
          <div class="goal-amount-item">
            <div class="goal-amount-label">Saved</div>
            <div class="goal-amount-value" style="color:var(--green);">${fmtFull(g.saved)}</div>
          </div>
          <div class="goal-amount-item">
            <div class="goal-amount-label">Target</div>
            <div class="goal-amount-value" style="color:${color};">${fmtFull(g.target)}</div>
          </div>
          <div class="goal-amount-item">
            <div class="goal-amount-label">Remaining</div>
            <div class="goal-amount-value" style="color:var(--red);">${fmtFull(rem)}</div>
          </div>
          <div class="goal-amount-item">
            <div class="goal-amount-label">Monthly</div>
            <div class="goal-amount-value">${fmtFull(plan.baseMonthly)}</div>
          </div>
        </div>

        <div class="goal-deadline">Due: ${g.deadline ? fmtDate(g.deadline) : 'Open-ended'}</div>
        <div class="goal-monthly">Monthly target: ${fmtFull(plan.baseMonthly)} to stay on track</div>

        <div class="goal-insight">💡 ${isOnTrack ? 'Keep it up! You\'re on pace.' : 'Increase savings to catch up.'}</div>

        <div class="goal-footer">
          <button class="btn btn-primary btn-sm" style="flex:1;" onclick="addToGoal('${g.id}')">+ Add Savings</button>
          <button class="btn btn-ghost btn-sm" onclick="openEditGoal('${g.id}')">Edit</button>
        </div>
      `;
      listEl.appendChild(card);
    });
  }

  // Render achieved goals section
  if (achievedGoals.length > 0) {
    achievedSection.style.display = 'block';
    achievedEl.innerHTML = '';
    achievedGoals.forEach((g, i) => {
      const card = document.createElement('div');
      card.className = 'sc goal-card';
      card.innerHTML = `
        <div class="sc-hd">
          <div class="sc-title">${g.name}</div>
          <div style="font-size:24px;">🏆</div>
        </div>
        
        <div style="padding:16px;border-bottom:1px solid var(--border);">
          <div style="text-align:center;padding:20px;">
            <div style="font-size:28px;font-weight:800;color:var(--green);margin-bottom:8px;">✅ Completed</div>
            <div style="font-size:13px;color:var(--text2);">Goal achieved on ${fmtDate(g.deadline || new Date().toISOString())}</div>
          </div>
        </div>

        <div style="padding:12px 16px;display:flex;gap:6px;">
          <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="openEditGoal('${g.id}')">View Details</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="delGoal('${g.id}')">🗑️</button>
        </div>
      `;
      achievedEl.appendChild(card);
    });
  } else {
    achievedSection.style.display = 'none';
  }

  // Render Smart Insights section
  const insightsEl = document.getElementById('goals-insights');
  const insightsSectionEl = document.getElementById('goals-insights-section');
  
  if (activeGoals.length > 0) {
    insightsSectionEl.style.display = 'block';
    insightsEl.innerHTML = '';
    
    // Insight 1: Average progress
    const avgProgress = Math.round(activeGoals.reduce((s, g) => s + (g.saved / g.target * 100), 0) / activeGoals.length);
    const insight1 = document.createElement('div');
    insight1.className = 'goals-insight-card';
    insight1.innerHTML = `
      <div class="goals-insight-icon">📈</div>
      <div class="goals-insight-title">Average Progress</div>
      <div class="goals-insight-text">Across your ${activeGoals.length} active goal${activeGoals.length > 1 ? 's' : ''}</div>
      <div class="goals-insight-stat">${avgProgress}%</div>
    `;
    insightsEl.appendChild(insight1);
    
    // Insight 2: Total monthly need
    const insight2 = document.createElement('div');
    insight2.className = 'goals-insight-card';
    insight2.innerHTML = `
      <div class="goals-insight-icon">💰</div>
      <div class="goals-insight-title">Monthly Savings Goal</div>
      <div class="goals-insight-text">To stay on track with all active goals</div>
      <div class="goals-insight-stat">${fmtFull(monthlyTotal)}</div>
    `;
    insightsEl.appendChild(insight2);
    
    // Insight 3: Days until first deadline
    const soonestGoal = activeGoals
      .filter(g => g.deadline)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];
    
    if (soonestGoal) {
      const daysLeft = Math.max(0, Math.ceil((new Date(soonestGoal.deadline) - Date.now()) / (24 * 60 * 60 * 1000)));
      const insight3 = document.createElement('div');
      insight3.className = 'goals-insight-card';
      insight3.innerHTML = `
        <div class="goals-insight-icon">⏰</div>
        <div class="goals-insight-title">Next Deadline</div>
        <div class="goals-insight-text">${soonestGoal.name}</div>
        <div class="goals-insight-stat">${daysLeft} days</div>
      `;
      insightsEl.appendChild(insight3);
    }
  } else {
    insightsSectionEl.style.display = 'none';
  }
}
window.renderGoals = renderGoals;

async function addToGoal(id) {
  const amt = parseFloat(prompt('Add to savings (₹)?') || 0);
  if (!amt || amt <= 0) return;
  const goal = State.goals.find(g => g.id === id);
  if (!goal) return;
  try {
    const updated = await API.updateGoal(id, { saved: Math.min(goal.target, goal.saved + amt) });
    State.setGoals(State.goals.map(g => g.id === id ? updated : g));
    toast(`₹${amt.toLocaleString('en-IN')} added to "${goal.name}"!`, 's');
    renderGoals(); renderRPGoals(); renderHomeGoals();
  } catch (err) {
    toast('Error: ' + err.message, 'e');
  }
}
window.addToGoal = addToGoal;

async function openEditGoal(id) {
  const goal = State.goals.find(g => g.id === id);
  if (!goal) return;
  const newSaved = parseFloat(prompt(`Current saved: ₹${goal.saved.toLocaleString('en-IN')}\nEnter new saved amount:`, goal.saved));
  if (isNaN(newSaved) || newSaved < 0) return;
  try {
    const updated = await API.updateGoal(id, { saved: Math.min(goal.target, newSaved) });
    State.setGoals(State.goals.map(g => g.id === id ? updated : g));
    toast('Goal updated!', 's');
    renderGoals(); renderRPGoals(); renderHomeGoals();
  } catch (err) {
    toast('Error: ' + err.message, 'e');
  }
}
window.openEditGoal = openEditGoal;

async function delGoal(id) {
  if (!confirm('Delete this goal?')) return;
  try {
    await API.deleteGoal(id);
    State.setGoals(State.goals.filter(g => g.id !== id));
    toast('Goal deleted', 'i');
    renderGoals(); renderRPGoals(); renderHomeGoals();
  } catch (err) {
    toast('Error: ' + err.message, 'e');
  }
}
window.delGoal = delGoal;

// ── Budget ────────────────────────────────────────────────

function renderBudget() { renderBudgetCats(); renderBudgetLimits(); renderBudgetRecs(); updateCharts(); }

function renderBudgetCats() {
  const cats = {}, bl = JSON.parse(localStorage.getItem('tf_bl') || '{}');
  State.transactions.filter(t => t.type === 'expense').forEach(t => {
    cats[t.category] = (cats[t.category] || 0) + t.amount;
  });
  const total  = Object.values(cats).reduce((s, v) => s + v, 0) || 1;
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const el = document.getElementById('budget-cats');
  if (!el) return;
  if (!sorted.length) { el.innerHTML = `<div style="font-size:12px;color:var(--text2);padding:12px;">No expense data yet</div>`; return; }
  el.innerHTML = sorted.map(([cat, amt], i) => {
    const limit = bl[cat];
    const pct   = limit ? Math.min(100, (amt / limit * 100)).toFixed(0) : (amt / total * 100).toFixed(0);
    const over  = limit && amt > limit;
    return `<div class="budget-item">
      <div class="budget-item-top">
        <div class="budget-label">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${CCOLORS[i % CCOLORS.length]};margin-right:4px;"></span>
          ${CATS[cat] || cat}
        </div>
        <div class="budget-amounts"><strong>${fmtFull(amt)}</strong>${limit ? ` / ${fmtFull(limit)}` : ''}</div>
      </div>
      <div class="prog"><div class="prog-fill ${over ? 'pf-red' : i % 3 === 0 ? 'pf-c1' : i % 3 === 1 ? 'pf-green' : 'pf-amber'}" style="width:${pct}%;"></div></div>
      ${over ? `<div class="budget-over">⚠️ Over budget by ${fmtFull(amt - limit)}</div>` : ''}
    </div>`;
  }).join('');
}

function renderBudgetLimits() {
  const bl = JSON.parse(localStorage.getItem('tf_bl') || '{}');
  const el = document.getElementById('budget-limits-ui');
  if (!el) return;
  if (!Object.keys(bl).length) { el.innerHTML = `<div style="font-size:12px;color:var(--text2);margin-bottom:10px;">No limits set yet.</div>`; return; }
  el.innerHTML = Object.entries(bl).map(([cat, limit]) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:13px;">${CATS[cat] || cat}</span>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="mono" style="font-size:12px;color:var(--amber);">${fmtFull(limit)}</span>
        <span style="cursor:pointer;color:var(--red);font-size:14px;" onclick="delBL('${cat}')">×</span>
      </div>
    </div>`).join('');
}

function setBudgetLimit() {
  const cat = document.getElementById('bl-cat').value;
  const amt = parseFloat(document.getElementById('bl-amt').value);
  if (!cat || !amt || amt <= 0) { toast('Select category and enter valid amount', 'e'); return; }
  const bl = JSON.parse(localStorage.getItem('tf_bl') || '{}');
  bl[cat] = amt;
  localStorage.setItem('tf_bl', JSON.stringify(bl));
  document.getElementById('bl-cat').value = '';
  document.getElementById('bl-amt').value = '';
  toast(`Budget limit set for ${catShort(cat)}: ${fmtFull(amt)}`, 's');
  renderBudget();
}
window.setBudgetLimit = setBudgetLimit;

function delBL(cat) {
  const bl = JSON.parse(localStorage.getItem('tf_bl') || '{}');
  delete bl[cat];
  localStorage.setItem('tf_bl', JSON.stringify(bl));
  renderBudgetLimits();
}
window.delBL = delBL;

function renderBudgetRecs() {
  const cats = {};
  State.transactions.filter(t => t.type === 'expense').forEach(t => {
    cats[t.category] = (cats[t.category] || 0) + t.amount;
  });
  const total = Object.values(cats).reduce((s, v) => s + v, 0) || 1;
  const recs  = [];
  if ((cats.food || 0) / total > 0.3)          recs.push('🍔 Food spending is over 30%. Try home cooking to save ₹3,000–5,000/month.');
  if ((cats.housing || 0) / total > 0.45)       recs.push('🏠 Housing exceeds 45%. Ideal range is 25–35%.');
  if ((cats.entertainment || 0) / total > 0.15) recs.push('🎮 Entertainment is 15%+. Audit subscriptions.');
  if ((cats.shopping || 0) / total > 0.2)       recs.push('🛒 Shopping is 20%+. Consider the 30-day rule.');
  if (!recs.length) {
    recs.push('✅ Spending distribution looks healthy!');
    recs.push('💡 Set budget limits for tighter control.');
    recs.push('📈 Consider investing surplus income.');
  }
  const el = document.getElementById('budget-recs');
  if (!el) return;
  el.innerHTML = recs.map(r => `<div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:13px;color:var(--text1);line-height:1.5;">${r}</div>`).join('');
}

// ── Right Panel ───────────────────────────────────────────

function rpTab(t) {
  document.getElementById('rpb-ai').style.display    = t === 'ai'    ? 'block' : 'none';
  document.getElementById('rpb-hist').style.display  = t === 'hist'  ? 'block' : 'none';
  document.getElementById('rpb-stats').style.display = t === 'stats' ? 'block' : 'none';
  ['ai', 'hist', 'stats'].forEach(x => {
    document.getElementById('rpt-' + x).className = 'rp-tab' + (t === x ? ' on' : '');
  });
}
window.rpTab = rpTab;

function renderRPGoals() {
  const el = document.getElementById('rp-goals');
  if (!el) return;
  const goals = State.goals;
  if (!goals.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text2);">No goals yet.</div>'; return; }
  el.innerHTML = goals.slice(0, 3).map(g => {
    const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
    return `<div class="rp-goal-row">
      <div class="rp-goal-name"><span>${g.name}</span><span class="rp-goal-pct">${pct}%</span></div>
      <div class="prog"><div class="prog-fill pf-c1" style="width:${pct}%;"></div></div>
    </div>`;
  }).join('');
}

function renderRPHist() {
  const el = document.getElementById('rp-hist-list');
  if (!el) return;
  if (!histLog.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text2);text-align:center;padding:20px;">No activity yet.</div>'; return; }
  const icons = { income:'💚', expense:'🔴', goal:'🎯', ai:'🤖' };
  el.innerHTML = histLog.slice(0, 10).map(h => `
    <div class="rp-hist-row">
      <div class="rp-hist-ic" style="background:${h.type === 'income' ? 'var(--green-dim)' : h.type === 'goal' ? 'var(--amber-dim)' : h.type === 'ai' ? 'var(--c1dim)' : 'var(--red-dim)'};">
        ${icons[h.type] || '•'}
      </div>
      <div class="rp-hist-info">
        <div class="rp-hist-t">${h.title}</div>
        <div class="rp-hist-s">${h.sub}</div>
      </div>
      <div class="rp-hist-time">${h.time}</div>
    </div>`).join('');
}

function renderRPSources() {
  const el = document.getElementById('rp-sources');
  if (!el) return;
  const srcs = {};
  State.transactions.filter(t => t.type === 'income').forEach(t => {
    srcs[t.category] = (srcs[t.category] || 0) + t.amount;
  });
  const total = Object.values(srcs).reduce((s, v) => s + v, 0) || 1;
  if (!Object.keys(srcs).length) { el.innerHTML = '<div style="font-size:12px;color:var(--text2);">No income yet.</div>'; return; }
  el.innerHTML = Object.entries(srcs).sort((a, b) => b[1] - a[1]).map(([c, v], i) => `
    <div class="tr-row">
      <div class="tr-left"><div class="tr-dot" style="background:${CCOLORS[i % CCOLORS.length]};"></div>${catShort(c)}</div>
      <div class="tr-right" style="color:var(--green);">${fmt(v)}</div>
    </div>`).join('');
}

// ── History popup ─────────────────────────────────────────

function openHist() {
  const el    = document.getElementById('hist-inner');
  const icons = { income:'💚', expense:'🔴', goal:'🎯', ai:'🤖' };
  if (!histLog.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--text2);text-align:center;padding:30px;">No activity yet.</div>';
  } else {
    el.innerHTML = histLog.map(h => `
      <div class="hist-row">
        <div class="hist-ic" style="background:${h.type === 'income' ? 'var(--green-dim)' : h.type === 'goal' ? 'var(--amber-dim)' : h.type === 'ai' ? 'var(--c1dim)' : 'var(--red-dim)'};">
          ${icons[h.type] || '•'}
        </div>
        <div class="hist-body"><div class="hist-title">${h.title}</div><div class="hist-sub">${h.sub}</div></div>
        <div class="hist-time">${h.time}</div>
      </div>`).join('');
  }
  document.getElementById('ov-hist').classList.add('open');
}
function closeHist() { document.getElementById('ov-hist').classList.remove('open'); }
window.openHist  = openHist;
window.closeHist = closeHist;

// ── Notifications ─────────────────────────────────────────

function formatNotifTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const dt = new Date(dateStr + 'T00:00:00');
  const diffMinutes = Math.floor((now - dt) / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return fmtDate(dateStr);
}

function renderNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;

  const notifs = [];
  const goals = State.goals;
  const txs = [...State.transactions].sort((a, b) => new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00'));

  if (goals.length) {
    const bestGoal = goals.reduce((best, goal) => {
      const progress = goal.target ? Math.round((goal.saved / goal.target) * 100) : 0;
      if (!best || progress > best.progress) return { goal, progress };
      return best;
    }, null);
    if (bestGoal) {
      const text = bestGoal.progress >= 100
        ? `Goal "${bestGoal.goal.name}" is complete! 🎉`
        : `Goal "${bestGoal.goal.name}" is ${bestGoal.progress}% complete 🎯`;
      notifs.push({ text, time: bestGoal.goal.updatedAt || bestGoal.goal.date || '', type: 'goal' });
    }
  }

  const monthPrefix = new Date().toISOString().slice(0, 7);
  const thisMonthExpenses = txs.filter(t => t.type === 'expense' && t.date && t.date.startsWith(monthPrefix));
  if (thisMonthExpenses.length) {
    const totals = thisMonthExpenses.reduce((sum, tx) => {
      sum[tx.category] = (sum[tx.category] || 0) + tx.amount;
      return sum;
    }, {});
    const topCategory = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    if (topCategory) {
      const [category, amount] = topCategory;
      notifs.push({
        text: `This month you spent ${fmtFull(amount)} on ${CATS[category] || category}.`, 
        time: 'This month',
        type: 'expense'
      });
    }
  }

  if (txs.length) {
    const latest = txs[0];
    const action = latest.type === 'expense' ? 'Spent' : 'Received';
    const label = latest.note || CATS[latest.category] || latest.category;
    notifs.push({
      text: `${action} ${fmtFull(latest.amount)} for ${label}.`, 
      time: formatNotifTime(latest.date),
      type: 'transaction'
    });
  }

  if (!notifs.length) {
    notifs.push({
      text: 'No notifications yet. Add goals or transactions to start receiving updates.',
      time: '',
      type: 'info'
    });
  }

  list.innerHTML = notifs.map(n => `
    <div class="notif-row">
      <div class="notif-dot-ind" style="opacity:${n.type === 'info' ? '0' : '1'}"></div>
      <div>
        <div class="notif-row-text">${n.text}</div>
        <div class="notif-row-time">${n.time}</div>
      </div>
    </div>
  `).join('');

  document.getElementById('notif-badge').style.display = notifs.some(n => n.type !== 'info') ? 'block' : 'none';
}

function toggleNotif() { document.getElementById('notif-dd').classList.toggle('open'); }
function clearNotifs() {
  document.querySelectorAll('.notif-dot-ind').forEach(d => d.style.opacity = '0');
  document.getElementById('notif-badge').style.display = 'none';
}
window.toggleNotif = toggleNotif;
window.clearNotifs = clearNotifs;
document.addEventListener('click', e => {
  const nb = document.getElementById('notif-btn');
  if (nb && !nb.contains(e.target)) document.getElementById('notif-dd').classList.remove('open');
});

// ── AI Assistant ──────────────────────────────────────────

function openAI() {
  if (!State.user.loggedIn) document.getElementById('ai-demo-warn').style.display = 'flex';
  document.getElementById('ov-ai').classList.add('open');
}
function closeAI() { document.getElementById('ov-ai').classList.remove('open'); }
window.openAI  = openAI;
window.closeAI = closeAI;

async function aiSend(prompt) {
  const inp = document.getElementById('ai-in');
  const msg = prompt || inp.value.trim();
  if (!msg) return;
  inp.value = '';

  if (State.aiLimitReached) {
    appendAI('bot', '⚠️ Demo limit reached. <strong>Sign in</strong> for unlimited AI access.');
    return;
  }

  appendAI('user', msg);

  const tid  = 'td-' + Date.now();
  const area = document.getElementById('ai-msgs');
  const td   = document.createElement('div');
  td.className = 'ai-m bot'; td.id = tid;
  td.innerHTML = '<div class="ai-bubble"><div class="typing-ind"><span></span><span></span><span></span></div></div>';
  area.appendChild(td);
  area.scrollTop = area.scrollHeight;

  State.incrementAiCount();
  addHist('ai', 'AI query: ' + msg.slice(0, 40), 'AI assistant');

  try {
    const { reply } = await API.askAI(msg);
    document.getElementById(tid)?.remove();
    appendAI('bot', reply.replace(/\n/g, '<br>'));
    document.getElementById('rp-ai-msg').textContent = reply.slice(0, 100) + '…';
  } catch (err) {
    document.getElementById(tid)?.remove();
    appendAI('bot', '⚠️ ' + err.message);
  }
}
window.aiSend = aiSend;

function appendAI(role, text) {
  const area = document.getElementById('ai-msgs');
  const d    = document.createElement('div');
  d.className = 'ai-m ' + role;
  d.innerHTML = `<div class="ai-bubble">${text}</div>`;
  area.appendChild(d);
  area.scrollTop = area.scrollHeight;
}

// ── Real Auth (Email OTP + JWT) ───────────────────────────────

let _loginEmail = ''; // store email between steps
let _authPurpose = 'signin'; // track current auth action: 'signin' or 'signup'
let _signupData = { name: '', gender: '', birthDate: '', phone: '' };

function setAuthPurpose(purpose = 'signin') {
  _authPurpose = purpose;
}
function setLoginEmail(email = '') {
  _loginEmail = email;
}
function setSignupData(data = {}) {
  _signupData = {
    name: data.name || '',
    gender: data.gender || '',
    birthDate: data.birthDate || '',
    phone: data.phone || '',
  };
}

function openAuth(purpose = 'signin') {
  _authPurpose = purpose;
  const title = getEl('auth-title');
  const sub   = getEl('auth-sub');
  const verifyBtn = getEl('verify-btn');
  const signupFields = getEl('signup-fields');
  if (title) title.textContent = purpose === 'signup' ? 'Create your ThinkFi account' : 'Welcome back to ThinkFi';
  if (sub) sub.textContent = purpose === 'signup' ? 'Sign up to unlock all features' : 'Sign in to unlock all features';
  if (verifyBtn) verifyBtn.textContent = purpose === 'signup' ? 'Verify & Sign Up →' : 'Verify & Sign In →';
  if (signupFields) signupFields.style.display = purpose === 'signup' ? 'block' : 'none';
  getEl('ov-login')?.classList.add('open');
  ls(1);
}
function openLogin() { openAuth('signin'); }
function openSignup() { openAuth('signup'); }
function closeLogin() { getEl('ov-login')?.classList.remove('open'); }
function ls(n) { [1, 2, 3].forEach(i => { const el = getEl('ls' + i); if (el) el.style.display = i === n ? 'block' : 'none'; }); }

// Step 1: Send real OTP to email via server
function getEl(id) {
  return document.getElementById(id) || document.getElementById('landing-' + id);
}

function isWelcomePage() {
  return !!document.getElementById('welcome-container') || /\/welcome\.html$/i.test(window.location.pathname);
}

async function sendOTP() {
  const inputEl = getEl('lf-in');
  const nameEl  = getEl('lf-nm');
  const genderEl = getEl('lf-gender');
  const birthDateEl = getEl('lf-dob');
  const phoneEl = getEl('lf-phone');

  const input = inputEl?.value.trim() || '';
  const name  = nameEl?.value.trim() || '';
  const gender = genderEl?.value || '';
  const birthDate = birthDateEl?.value || '';
  const phone = phoneEl?.value.trim() || '';

  if (!input) { toast('Enter your email address', 'e'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) { toast('Enter a valid email address', 'e'); return; }
  _loginEmail = input;

  if (_authPurpose === 'signup') {
    if (!name) { toast('Enter your full name', 'e'); return; }
    if (!gender) { toast('Select your gender', 'e'); return; }
    if (!birthDate) { toast('Enter your date of birth', 'e'); return; }
    if (new Date(birthDate) > new Date()) { toast('Date of birth cannot be in the future', 'e'); return; }
    if (!phone) { toast('Enter your phone number', 'e'); return; }
    if (!/^[+]?[0-9\s\-()]{7,}$/.test(phone)) { toast('Enter a valid phone number', 'e'); return; }
    _signupData = { name, gender, birthDate, phone };
  } else {
    _signupData = { name, gender: '', birthDate: '', phone: '' };
  }

  const btn = getEl('ls1')?.querySelector('.btn-primary');
  if (!btn) {
    toast('Login form could not be initialized. Please refresh and try again.', 'e');
    return;
  }
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    await API.sendOTPRequest(input, name);
    const otpTo = getEl('otp-to');
    if (otpTo) otpTo.textContent = input;
    [0,1,2,3,4,5].forEach(i => { const el = getEl('o' + i); if (el) el.value = ''; });
    const errEl = getEl('otp-error');
    if (errEl) errEl.style.display = 'none';
    ls(2);
    setTimeout(() => { const el = getEl('o0'); if (el) el.focus(); }, 200);
    toast('✉️ Code sent! Check your inbox.', 's');
  } catch (err) {
    toast('Error: ' + err.message, 'e');
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}
window.sendOTP = sendOTP;

// Resend OTP (same as sendOTP but from step 2)
async function resendOTP() {
  const btn = getEl('resend-btn');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    await API.sendOTPRequest(_loginEmail, '');
    toast('✉️ New code sent!', 's');
    [0,1,2,3,4,5].forEach(i => { const el = getEl('o' + i); if (el) el.value = ''; });
    getEl('o0')?.focus();
  } catch (err) {
    toast('Error: ' + err.message, 'e');
  } finally {
    // Cooldown 30s before resend allowed again
    setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = 'Resend code'; } }, 30000);
  }
}

// Auto-advance to next OTP box, only on digit input
function onOTP(i) {
  const el  = getEl('o' + i);
  if (!el) return;
  const val = el.value.replace(/\D/g, ''); // digits only
  el.value  = val.slice(-1);               // keep last digit if pasted multiple

  // If user pasted all 6 digits into first box, distribute them
  if (i === 0 && val.length > 1) {
    val.slice(0, 6).split('').forEach((d, j) => {
      const box = getEl('o' + j);
      if (box) box.value = d;
    });
    getEl('o5')?.focus();
    setTimeout(verifyOTP, 300);
    return;
  }

  if (el.value && i < 5) getEl('o' + (i + 1))?.focus();

  const allFilled = [0,1,2,3,4,5].every(j => getEl('o' + j)?.value);
  if (allFilled) setTimeout(verifyOTP, 300);
}

function onOTPBack(e, i) {
  const el = getEl('o' + i);
  if (e.key === 'Backspace' && el && !el.value && i > 0) {
    getEl('o' + (i - 1))?.focus();
  }
}

// Step 2: Verify OTP with server — get JWT back
async function verifyOTP() {
  const code = [0,1,2,3,4,5].map(i => getEl('o' + i)?.value || '').join('');
  if (code.length < 6) { toast('Enter all 6 digits', 'e'); return; }

  const errEl = getEl('otp-error');
  const btn   = getEl('verify-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Verifying…'; }
  if (errEl) errEl.style.display = 'none';

  const name = getEl('lf-nm')?.value.trim() || '';

  try {
   const email = document.getElementById('lf-in')?.value.trim();

console.log('VERIFY EMAIL:', email);

const result = await API.verifyOTPRequest(
  email,
  code,
  name,
  _signupData.gender,
  _signupData.birthDate,
  _signupData.phone,
    );
    const { token, user } = result;

    // Store JWT — this is what makes auth real
    Auth.setToken(token);

    // Update app state
    State.setUser({ name: user.name, email: user.email, loggedIn: true });

    if (isWelcomePage()) {
      location.href = '/index.html#/home';
      return;
    }

    ls(3); // show success screen
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
    else toast(err.message, 'e');
    // Clear inputs on wrong code
    [0,1,2,3,4,5].forEach(i => { const el = getEl('o' + i); if (el) el.value = ''; });
    getEl('o0')?.focus();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = _authPurpose === 'signup' ? 'Verify & Sign Up →' : 'Verify & Sign In →';
    }
  }
}

function finishLogin() {
  closeLogin();
  if (!document.getElementById('auth-area') || isWelcomePage()) {
    location.href = '/index.html#/home';
    return;
  }
  unlockApp();
  // Reload data for this user from server
  bootstrap();
  toast(`Welcome back, ${State.user.name}! 🎉`, 's');
}

function unlockApp() {
  const u = State.user;
  document.getElementById('auth-area').innerHTML = `
    <div class="user-pill">
      <div class="user-pill-av">${u.name.charAt(0).toUpperCase()}</div>
      <div class="user-pill-name">${u.name.split(' ')[0]}</div>
    </div>`;
  document.getElementById('sb-av').textContent  = u.name.charAt(0).toUpperCase();
  document.getElementById('sb-nm').textContent  = u.name;
  document.getElementById('sb-rl').textContent  = 'Pro Member';
  document.querySelector('.status-dot').style.background = 'var(--green)';
  document.getElementById('demo-bar').style.display      = 'none';
  document.getElementById('logout-item').style.display   = 'flex';
  document.getElementById('hist-lock').style.display     = 'none';
  document.querySelectorAll('.blur-wrap').forEach(w => w.classList.remove('locked'));
  const cta = document.getElementById('rp-cta');
  if (cta) cta.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:4px;"><span style="color:var(--green);font-size:18px;">✅</span><div><div style="font-size:13px;font-weight:700;">Full Access Unlocked</div><div style="font-size:11px;color:var(--text2);">All features available</div></div></div>`;
  setGreeting();
}

function redirectToLanding() {
  if (window.location.pathname !== '/welcome.html') {
    window.location.replace('/welcome.html');
  }
}

async function doLogout() {
  try { await API.logoutRequest(); } catch (_) { /* ignore */ }
  Auth.clearToken();
  State.setUser({ name: 'Guest', email: '', loggedIn: false });
  State.setTransactions([]);
  State.setGoals([]);
  document.getElementById('auth-area').innerHTML = `<button class="tb-login-btn" onclick="openLogin()">🔐 Sign In</button><button class="tb-login-btn" onclick="openSignup()">📝 Sign Up</button>`;
  document.getElementById('sb-av').textContent  = 'G';
  document.getElementById('sb-nm').textContent  = 'Guest User';
  document.getElementById('sb-rl').textContent  = 'Demo Mode';
  document.querySelector('.status-dot').style.background = 'var(--amber)';
  document.getElementById('demo-bar').style.display    = 'flex';
  document.getElementById('logout-item').style.display = 'none';
  document.getElementById('hist-lock').style.display   = 'inline';
  document.getElementById('home-ai-wrap').classList.add('locked');
  document.getElementById('an-blur').classList.add('locked');
  const cta = document.getElementById('rp-cta');
  if (cta) cta.innerHTML = `<div class="rp-cta-title">🚀 Unlock Full Power</div><div class="rp-cta-sub">Sign in to save data permanently and unlock all features.</div><button class="btn btn-primary btn-full btn-sm" onclick="openLogin()">Sign In Free →</button>`;
  refreshAll(); updateCharts();
  toast('Logged out', 'i');
  setGreeting();
  redirectToLanding();
}

window.openLogin   = openLogin;
window.openSignup  = openSignup;
window.closeLogin  = closeLogin;
window.sendOTP     = sendOTP;
window.resendOTP   = resendOTP;
window.onOTP       = onOTP;
window.onOTPBack   = onOTPBack;
window.verifyOTP   = verifyOTP;
window.finishLogin = finishLogin;
window.doLogout    = doLogout;

// ── Help ──────────────────────────────────────────────────

function openHelp() { document.getElementById('ov-help').classList.add('open'); }
function closeHelp() { document.getElementById('ov-help').classList.remove('open'); }
window.openHelp  = openHelp;
window.closeHelp = closeHelp;

// ── Settings ──────────────────────────────────────────────

function savePrefs() {
  const name  = document.getElementById('pf-name').value;
  const email = document.getElementById('pf-email').value;
  localStorage.setItem('tf_prefs', JSON.stringify({ name, email }));
  toast('Preferences saved ✅', 's');
}

async function clearAll() {
  if (!confirm('Clear ALL data? Cannot be undone.')) return;
  try {
    const txs   = State.transactions;
    const goals = State.goals;
    await Promise.all([
      ...txs.map(t   => API.deleteTransaction(t.id)),
      ...goals.map(g => API.deleteGoal(g.id)),
    ]);
    State.setTransactions([]);
    State.setGoals([]);
    refreshAll(); updateCharts();
    toast('All data cleared', 'i');
  } catch (err) {
    toast('Error clearing: ' + err.message, 'e');
  }
}

function exportJSON() {
  const data = {
    transactions: State.transactions,
    goals:        State.goals,
    exportedAt:   new Date().toISOString(),
  };
  const a = document.createElement('a');
  a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(data, null, 2));
  a.download = 'thinkfi-data.json';
  a.click();
  toast('Data exported! 📥', 's');
}

async function loadDemo() {
  await seedDemoData(true);
  refreshAll(); updateCharts();
  toast('Demo data loaded!', 's');
}

window.savePrefs  = savePrefs;
window.clearAll   = clearAll;
window.exportJSON = exportJSON;
window.loadDemo   = loadDemo;

// ── Greeting ──────────────────────────────────────────────

function setGreeting() {
  const h  = new Date().getHours();
  const g  = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const nm = State.user.loggedIn ? ' ' + State.user.name.split(' ')[0] : '';
  document.getElementById('home-title').textContent = `${g}${nm} 👋`;
}

// ── Demo seed (fallback when server offline) ──────────────

async function seedDemoData(force = false) {
  if (!force && State.transactions.length) return;
  const mo  = new Date().toISOString().slice(0, 7);
  const pm  = new Date(); pm.setMonth(pm.getMonth() - 1);
  const pm2 = pm.toISOString().slice(0, 7);

  const incomeSeed = [
    { amount: 85000, category: 'salary',    date: mo   + '-01', type: 'income',  note: 'Monthly salary' },
    { amount: 18000, category: 'freelance', date: mo   + '-12', type: 'income',  note: 'Web design project' },
    { amount: 75000, category: 'salary',    date: pm2  + '-01', type: 'income',  note: 'Monthly salary' },
    { amount: 8000,  category: 'investment',date: pm2  + '-20', type: 'income',  note: 'Dividend income' },
  ];
  const expenseSeed = [
    { amount: 22000, category: 'housing',       date: mo  + '-01', type: 'expense', note: 'Monthly rent' },
    { amount: 9500,  category: 'food',          date: mo  + '-08', type: 'expense', note: 'Groceries & dining' },
    { amount: 3500,  category: 'transport',     date: mo  + '-10', type: 'expense', note: 'Fuel + metro' },
    { amount: 2200,  category: 'entertainment', date: mo  + '-14', type: 'expense', note: 'Subscriptions' },
    { amount: 4800,  category: 'health',        date: mo  + '-18', type: 'expense', note: 'Gym + doctor' },
    { amount: 6000,  category: 'shopping',      date: mo  + '-22', type: 'expense', note: 'Clothes' },
    { amount: 20000, category: 'housing',       date: pm2 + '-01', type: 'expense', note: 'Monthly rent' },
    { amount: 8000,  category: 'food',          date: pm2 + '-10', type: 'expense', note: 'Groceries' },
    { amount: 3000,  category: 'transport',     date: pm2 + '-15', type: 'expense', note: 'Fuel' },
  ];

  try {
    // FIX: Use Promise.allSettled instead of Promise.all so one failure
    // doesn't abort everything. Collect only the successful ones.
    const allSeeds = [...incomeSeed, ...expenseSeed];
    const results  = await Promise.allSettled(allSeeds.map(t => API.createTransaction(t)));
    const created  = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value); // r.value is the transaction object from server
    State.setTransactions(created);

    if (!State.goals.length) {
      const goalSeed = [
        { name: 'Emergency Fund', target: 300000, saved: 186000, deadline: '2026-12-31' },
        { name: 'Goa Trip ✈️',    target: 75000,  saved: 52000,  deadline: '2026-09-15' },
        { name: 'New MacBook 💻', target: 130000, saved: 38000,  deadline: '2027-03-01' },
      ];
      const goalResults = await Promise.allSettled(goalSeed.map(g => API.createGoal(g)));
      const createdGoals = goalResults
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
      State.setGoals(createdGoals);
    }
  } catch {
    // Server offline — use local state only
    State.setTransactions([...incomeSeed, ...expenseSeed].map((t, i) => ({ ...t, id: 'demo-' + i, createdAt: new Date().toISOString() })));
    if (!State.goals.length) {
      State.setGoals([
        { id: 'g1', name: 'Emergency Fund', target: 300000, saved: 186000, deadline: '2026-12-31', createdAt: new Date().toISOString() },
        { id: 'g2', name: 'Goa Trip ✈️',    target: 75000,  saved: 52000,  deadline: '2026-09-15', createdAt: new Date().toISOString() },
        { id: 'g3', name: 'New MacBook 💻', target: 130000, saved: 38000,  deadline: '2027-03-01', createdAt: new Date().toISOString() },
      ]);
    }
  }
}

// ── Overlay close on background click ────────────────────

document.querySelectorAll('.overlay').forEach(o =>
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); })
);

// ── Init ──────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  refreshAIStatus();
  if (document.getElementById('tx-dt')) {
    setGreeting();
    setType('income');
    document.getElementById('tx-dt').valueAsDate = new Date();
    document.getElementById('g-dl').valueAsDate  = new Date(Date.now() + 180 * 86400000);

    const prefs = JSON.parse(localStorage.getItem('tf_prefs') || '{}');
    if (prefs.name)  document.getElementById('pf-name').value  = prefs.name;
    if (prefs.email) document.getElementById('pf-email').value = prefs.email;

    const route = (location.hash.replace('#/', '')) || 'home';
    const el    = document.querySelector(`[data-r="${route}"]`);
    if (el) go(route, el); else refreshAll();

    bootstrap();
    initHome3DMotion();
  }
});

window.addEventListener('popstate', () => {
  const r  = location.hash.replace('#/', '');
  const el = document.querySelector(`[data-r="${r}"]`);
  if (el) go(r, el, true);
});

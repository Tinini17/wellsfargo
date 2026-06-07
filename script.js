
const USERS = { 'kellyreilly04': 'kellylovesreilly' };
let checkingBal = null;
let savingsBal = null;
let balancesInitialized = false;
// Firebase integration (optional)
// Replace the values in firebaseConfig with your project's config.
const firebaseConfig = {
  apiKey: "AIzaSyBAuJUPmNTtylOID7K35T6GZYPrFBJru0o",
  authDomain: "wells-fargo-25f3b.firebaseapp.com",
  databaseURL: "https://wells-fargo-25f3b-default-rtdb.firebaseio.com",
  projectId: "wells-fargo-25f3b",
  storageBucket: "wells-fargo-25f3b.firebasestorage.app",
  messagingSenderId: "702586996272",
  appId: "1:702586996272:web:f94fc9e276ed4b25478ff5"
};
let firebaseEnabled = false;
let fbDb = null;
try {
  if (firebase && firebase.initializeApp && firebaseConfig.apiKey !== 'REPLACE_ME') {
    firebase.initializeApp(firebaseConfig);
    fbDb = firebase.database();
    firebaseEnabled = true;

    // Listen for balance updates
    fbDb.ref('balances').on('value', snap => {
      const b = snap.val() || {};
      if (typeof b.checking === 'number') checkingBal = b.checking;
      if (typeof b.savings === 'number') savingsBal = b.savings;
      // persist locally so refresh shows latest known values immediately
      try { localStorage.setItem('wellsfargo_balances', JSON.stringify({ checking: checkingBal, savings: savingsBal })); } catch (e) {}
      balancesInitialized = true;
      updateBals();
    });

    // Listen for new transactions
    fbDb.ref('transactions').limitToLast(100).on('child_added', snap => {
      const tx = snap.val();
      if (!tx) return;
      const key = snap.key;
      // avoid duplicate if already present
      if (document.querySelector('[data-txid="' + key + '"]')) return;
      addTx(tx.desc || 'Tx', tx.amount || 0, !!tx.isPos, key, tx.date);
    });
  }
} catch (e) {
  console.warn('Firebase init failed', e);
}
const fmt = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function toast(msg, type) {
  const c = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + (type || 'ok');
  const icons = { ok: '✅', err: '❌', info: 'ℹ️' };
  el.innerHTML = `<span class="t-icon">${icons[type] || '✅'}</span><span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => el.classList.add('show'), 20);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3200);
}

function togglePw() {
  const inp = document.getElementById('login-pass');
  const icon = document.getElementById('eye-icon');
  if (inp.type === 'password') { inp.type = 'text'; icon.textContent = '🙈'; }
  else { inp.type = 'password'; icon.textContent = '👁'; }
}

function doLogin() {
  const u = document.getElementById('login-user').value.trim().toLowerCase();
  const p = document.getElementById('login-pass').value;
  const eu = document.getElementById('err-user');
  const ep = document.getElementById('err-pass');
  const ui = document.getElementById('login-user');
  const pi = document.getElementById('login-pass');
  const btn = document.getElementById('login-btn');

  eu.classList.remove('show'); ep.classList.remove('show');
  ui.classList.remove('error'); pi.classList.remove('error');

  if (!u) { eu.classList.add('show'); ui.classList.add('error'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Signing in…';

  setTimeout(() => {
    if (USERS[u] && USERS[u] === p) {
      try { localStorage.setItem('wellsfargo_user', u); } catch (e) {}
      document.getElementById('screen-login').classList.remove('active');
      document.getElementById('screen-app').classList.add('active');
      toast('Welcome back, Kelly! 👋', 'ok');
    } else {
      btn.disabled = false;
      btn.innerHTML = 'Sign in';
      ep.classList.add('show');
      pi.classList.add('error');
      ui.classList.add('error');
    }
  }, 1300);
}

function bioLogin() {
  toast('Authenticating with biometrics…', 'info');
  setTimeout(() => {
    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('screen-app').classList.add('active');
    toast('Welcome back, Kelly! 👋', 'ok');
  }, 1500);
}

function doLogout() {
  document.getElementById('screen-app').classList.remove('active');
  document.getElementById('screen-login').classList.add('active');
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  const btn = document.getElementById('login-btn');
  btn.disabled = false; btn.innerHTML = 'Sign in';
  ['err-user','err-pass'].forEach(id => document.getElementById(id).classList.remove('show'));
  ['login-user','login-pass'].forEach(id => document.getElementById(id).classList.remove('error'));
  go('home');
  try { localStorage.removeItem('wellsfargo_user'); } catch (e) {}
}

function go(section) {
  document.querySelectorAll('.sub').forEach(el => { el.classList.remove('active'); el.style.display = 'none'; });
  const target = document.getElementById('sec-' + section);
  if (target) { target.style.display = 'block'; target.classList.add('active'); }
  document.getElementById('scroll-body').scrollTop = 0;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const nb = document.getElementById('nav-' + section);
  if (nb) nb.classList.add('active');
  else document.getElementById('nav-home').classList.add('active');
  if (section === 'deposit') resetDep();
  if (section === 'transfer') resetXfr();
}

function updateBals() {
  const mb = document.getElementById('main-bal');
  const sb = document.getElementById('sav-bal');
  if (!balancesInitialized) {
    // show stored values if available, otherwise a placeholder
    if (checkingBal !== null) mb.textContent = fmt(checkingBal); else mb.textContent = '—';
    if (savingsBal !== null) sb.textContent = fmt(savingsBal); else sb.textContent = '—';
  } else {
    mb.textContent = (checkingBal !== null) ? fmt(checkingBal) : '—';
    sb.textContent = (savingsBal !== null) ? fmt(savingsBal) : '—';
  }
}

// Deposit
function depositReview() {
  const amt = parseFloat(document.getElementById('dep-amount').value);
  if (!amt || amt <= 0) { toast('Please enter a valid amount.', 'err'); return; }
  document.getElementById('dc-amt').textContent = fmt(amt);
  document.getElementById('dc-to').textContent = document.getElementById('dep-to').value;
  const methods = { ach: 'ACH Transfer', check: 'Mobile Check', wire: 'Wire Transfer' };
  document.getElementById('dc-meth').textContent = methods[document.getElementById('dep-method').value];
  document.getElementById('dep-form').style.display = 'none';
  document.getElementById('dep-confirm').style.display = 'block';
  document.querySelectorAll('#dep-steps .step-dot').forEach(d => d.classList.add('done'));
}
function depBack() {
  document.getElementById('dep-form').style.display = 'block';
  document.getElementById('dep-confirm').style.display = 'none';
  document.querySelectorAll('#dep-steps .step-dot')[1].classList.remove('done');
}
function resetDep() {
  document.getElementById('dep-form').style.display = 'block';
  document.getElementById('dep-confirm').style.display = 'none';
  document.querySelectorAll('#dep-steps .step-dot').forEach((d,i) => d.classList.toggle('done', i===0));
}
function doDeposit() {
  const amt = parseFloat(document.getElementById('dep-amount').value);
  const to = document.getElementById('dep-to').value;
  if (!amt || amt <= 0) { toast('Please enter a valid amount.', 'err'); return; }
  if (to.includes('Checking')) checkingBal += amt; else savingsBal += amt;
  updateBals();

  const desc = 'Deposit (' + document.getElementById('dep-method').value.toUpperCase() + ')';

  if (firebaseEnabled && fbDb) {
    // write balances and push transaction to realtime DB
    fbDb.ref('balances').set({ checking: checkingBal, savings: savingsBal }).catch(() => {});
    const newRef = fbDb.ref('transactions').push();
    const key = newRef.key;
    newRef.set({ desc, amount: amt, isPos: true, date: Date.now() }).catch(() => {});
    // add immediately to UI with the firebase key to avoid duplicates
    addTx(desc, amt, true, key, Date.now());
  } else {
    addTx(desc, amt, true);
    try { localStorage.setItem('wellsfargo_balances', JSON.stringify({ checking: checkingBal, savings: savingsBal })); } catch (e) {}
  }

  toast(fmt(amt) + ' deposited successfully!', 'ok');
  go('home');
}

// Transfer
function setPayee(name) { document.getElementById('xfr-to').value = name; }
function transferReview() {
  const amt = parseFloat(document.getElementById('xfr-amount').value);
  const to = document.getElementById('xfr-to').value.trim();
  if (!amt || amt <= 0) { toast('Please enter a valid amount.', 'err'); return; }
  if (!to) { toast('Please enter a recipient.', 'err'); return; }
  const from = document.getElementById('xfr-from').value;
  if (amt > (from.includes('4821') ? checkingBal : savingsBal)) { toast('Insufficient funds in selected account.', 'err'); return; }
  document.getElementById('xc-from').textContent = from;
  document.getElementById('xc-to').textContent = to;
  document.getElementById('xc-amt').textContent = fmt(amt);
  document.getElementById('xc-memo').textContent = document.getElementById('xfr-memo').value || '—';
  document.getElementById('xfr-form').style.display = 'none';
  document.getElementById('xfr-confirm').style.display = 'block';
  document.querySelectorAll('#xfr-steps .step-dot').forEach(d => d.classList.add('done'));
}
function xfrBack() {
  document.getElementById('xfr-form').style.display = 'block';
  document.getElementById('xfr-confirm').style.display = 'none';
  document.querySelectorAll('#xfr-steps .step-dot')[1].classList.remove('done');
}
function resetXfr() {
  document.getElementById('xfr-form').style.display = 'block';
  document.getElementById('xfr-confirm').style.display = 'none';
  document.querySelectorAll('#xfr-steps .step-dot').forEach((d,i) => d.classList.toggle('done', i===0));
}
function doTransfer() {
  const amt = parseFloat(document.getElementById('xfr-amount').value);
  const from = document.getElementById('xfr-from').value;
  const to = document.getElementById('xfr-to').value;
  if (!amt || amt <= 0) { toast('Please enter a valid amount.', 'err'); return; }
  if (from.includes('4821')) checkingBal -= amt; else savingsBal -= amt;
  updateBals();

  const desc = 'Transfer → ' + (to.split(' ')[0] || to);

  if (firebaseEnabled && fbDb) {
    fbDb.ref('balances').set({ checking: checkingBal, savings: savingsBal }).catch(() => {});
    const newRef = fbDb.ref('transactions').push();
    const key = newRef.key;
    newRef.set({ desc, amount: amt, isPos: false, date: Date.now() }).catch(() => {});
    addTx(desc, amt, false, key, Date.now());
  } else {
    addTx(desc, amt, false);
    try { localStorage.setItem('wellsfargo_balances', JSON.stringify({ checking: checkingBal, savings: savingsBal })); } catch (e) {}
  }

  toast(fmt(amt) + ' sent to ' + to + '!', 'ok');
  go('home');
}

function addTx(desc, amt, isPos, id, ts) {
  const list = document.getElementById('tx-list');
  const d = ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const icon = isPos ? '⬇️' : '↗️';
  const el = document.createElement('div');
  el.className = 'tx-item';
  el.setAttribute('data-desc', desc.toLowerCase());
  if (id) el.setAttribute('data-txid', id);
  el.innerHTML = `<div class="tx-icon">${icon}</div><div class="tx-desc"><div class="tx-name">${desc}</div><div class="tx-date">${d}</div></div><div class="tx-amount ${isPos?'pos':'neg'}">${isPos?'+':'−'}${fmt(amt).slice(1)}</div>`;
  list.insertBefore(el, list.firstChild);
}

function filterTx(q) {
  document.querySelectorAll('#tx-list .tx-item').forEach(row => {
    const match = (row.getAttribute('data-desc') || '').includes(q.toLowerCase()) || row.textContent.toLowerCase().includes(q.toLowerCase());
    row.style.display = match ? '' : 'none';
  });
}

// Init
document.querySelectorAll('.sub').forEach(s => { if (!s.classList.contains('active')) s.style.display = 'none'; });
// load last-known balances from localStorage to avoid flashing demo defaults
try {
  const saved = localStorage.getItem('wellsfargo_balances');
  if (saved) {
    const obj = JSON.parse(saved);
    if (obj && typeof obj.checking === 'number') checkingBal = obj.checking;
    if (obj && typeof obj.savings === 'number') savingsBal = obj.savings;
  }
} catch (e) {}
updateBals();

// Auto-login if a demo user was saved
try {
  const savedUser = localStorage.getItem('wellsfargo_user');
  if (savedUser) {
    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('screen-app').classList.add('active');
    const btn = document.getElementById('login-btn'); if (btn) { btn.disabled = false; btn.innerHTML = 'Sign in'; }
    toast('Restored session for ' + savedUser + '.', 'info');
  }
} catch (e) {}

// Open deposit and preselect target account
function openDepositTo(targetLabel) {
  go('deposit');
  setTimeout(() => {
    const sel = document.getElementById('dep-to');
    const amt = document.getElementById('dep-amount');
    if (sel) sel.value = targetLabel;
    if (amt) {
      amt.focus();
      amt.select && amt.select();
    }
  }, 150);
}
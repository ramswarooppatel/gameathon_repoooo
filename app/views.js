import { h, inr, today, toast } from './util.js';
import { QUESTS, BADGES, LEVELS } from './gamify.js';
import { toCsv, gstFor, enrich, prevMonth, daysBetween, guessSupply } from '../workspace/calc.js';
import { validGstin } from '../tax/gst.js';
import { GST_LATE_INTEREST_PA } from '../tax/config.js';
import { ask } from '../ai/groq.js';
import { scratch, confetti } from './fx.js';
import { parseBank, matchBank } from './bank.js';

const KIND = { sale: 'Sale', purchase: 'Purchase', expense: 'Expense', salary: 'Salary' };
const card = (title, ...kids) => h('section', { class: 'card' }, h('h3', {}, title), ...kids);
const empty = (t) => h('p', { class: 'mu' }, t);
const download = (name, text, type = 'text/csv') => h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name }).click();

function ring(score, label, suffix = '') {
  const c = score >= 70 ? '#19c37d' : score >= 45 ? '#f5b942' : '#ef5b5b', box = h('div', { class: 'ring' });
  box.innerHTML = `<svg viewBox="0 0 130 130"><circle cx="65" cy="65" r="54" fill="none" stroke="#17291f" stroke-width="12"/><circle class="arc" cx="65" cy="65" r="54" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(Math.min(100, score) * 3.393).toFixed(1)} 339.3" transform="rotate(-90 65 65)"/></svg>`;
  box.append(h('div', { class: 'rv' }, h('b', {}, score + suffix), h('span', {}, label)));
  return box;
}

function chart(monthly) {
  const max = Math.max(1, ...monthly.flatMap((m) => [m.income, m.spend])), W = 560, H = 170, bw = 22, g = W / monthly.length;
  let s = `<svg viewBox="0 0 ${W} ${H + 24}" class="chart">`;
  monthly.forEach((m, i) => {
    const x = i * g + g / 2, hi = (m.income / max) * H, hs = (m.spend / max) * H;
    s += `<rect x="${x - bw - 2}" y="${H - hi}" width="${bw}" height="${hi}" rx="4" fill="#19c37d"/><rect x="${x + 2}" y="${H - hs}" width="${bw}" height="${hs}" rx="4" fill="#5b6f66"/><text x="${x}" y="${H + 16}" text-anchor="middle" fill="#8aa398" font-size="11">${m.m.slice(5)}/${m.m.slice(2, 4)}</text>`;
  });
  const b = h('div'); b.innerHTML = s + '</svg>'; return b;
}

export function reminderText(S, r) {
  return `Hi ${r.party}, a gentle reminder that invoice ${r.number || ''} for ${inr(r.total)} was due on ${r.due_date}. Please share the payment status or expected date. Thank you. ${S.profile.name ? '— ' + S.profile.name : ''}`.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------- Dashboard
const num = (v, key, pre = '₹') => h('b', { 'data-count': Math.round(v), 'data-key': key, 'data-pre': pre }, (v < 0 ? '−' : '') + pre + Math.abs(Math.round(v)).toLocaleString('en-IN'));
const PRIZES = [10, 15, 20, 25, 30, 50];
const prizeFor = (day) => PRIZES[[...day].reduce((a, c) => a + c.charCodeAt(0), 0) % PRIZES.length];

function stories(S) {
  const s = S.sum, L = S.level, out = [], add = (tone, title, body, go) => out.push({ tone, title, body, go });
  if (s.overdueAmt > 0) add('bad', `${inr(s.overdueAmt)} is stuck`, `${s.overdueCount} customer invoice(s) are past due. One reminder today can free it up.`, 'transactions');
  const fil = S.filingsView.find((f) => !f.saved && daysBetween(today(), f.due_date) <= 7 && daysBetween(today(), f.due_date) >= 0);
  if (fil) add('warn', `${fil.type === 'GSTR1' ? 'GSTR-1' : 'GSTR-3B'} due ${fil.due_date}`, 'File on time to earn 40 XP and avoid interest.', 'compliance');
  if (s.gst.itcAtRisk > 0) add('warn', `${inr(s.gst.itcAtRisk)} credit at risk`, 'Fix supplier GSTINs on your bills to claim it.', 'transactions');
  const goal = +S.profile.monthly_goal;
  if (goal > 0) add('good', `${Math.min(100, Math.round((s.collectedMonth / goal) * 100))}% of monthly goal`, `${inr(Math.max(0, goal - s.collectedMonth))} left to collect this month.`, 'dashboard');
  else add('info', 'Set a monthly goal', 'Pick a collection target and watch the ring fill.', 'settings');
  if (L.next) add('good', `${L.toNext} XP to ${L.next}`, 'Log a transaction, pay on time or resolve an alert.', 'rewards');
  add('info', `${S.ctx.streak}-day streak`, S.ctx.has('checkin', today()) ? 'Checked in today. See you tomorrow!' : 'Check in today to keep it alive.', 'rewards');
  if (s.runwayMonths) add(s.runwayMonths < 1.5 ? 'bad' : 'good', `${s.runwayMonths} months of runway`, s.runwayMonths < 1.5 ? 'Cash is tight. Delay a bill or chase receivables.' : 'Comfortable buffer at your current spend.', 'insights');
  return h('div', { class: 'stories' }, ...out.map((o) => h('button', { class: 'story ' + o.tone, onclick: () => (location.hash = o.go) }, h('b', {}, o.title), h('span', {}, o.body))));
}

function rewardCard(S, A) {
  const done = QUESTS.filter((q) => q.done(S.ctx)).length, day = today(), got = S.events.find((e) => e.kind === 'scratch' && e.day === day), prize = prizeFor(day);
  if (got) return card('Daily reward', h('div', { class: 'prize' }, h('b', {}, `+${got.xp} XP`), h('small', {}, 'Claimed today. A new card unlocks tomorrow.')));
  if (done < 3) return card('Daily reward', h('div', { class: 'prize lock' }, h('b', {}, 'Locked'), h('small', {}, `Complete ${3 - done} more quest(s) to unlock a scratch card.`)), h('i', { class: 'bar' }, h('u', { style: `width:${(done / 3) * 100}%` })));
  const cv = h('canvas', { width: 260, height: 90, class: 'foil' }), wrap = h('div', { class: 'scratch' }, h('div', { class: 'prize' }, h('b', {}, `+${prize} XP`), h('small', {}, 'Bonus reward')), cv);
  scratch(cv, async () => { confetti(); await A.award('scratch', day, prize, 'Daily reward revealed'); setTimeout(A.render, 900); });
  return card('Daily reward ready', wrap, h('p', { class: 'small mu' }, 'Scratch the card to reveal your bonus XP.'));
}

function onboarding(S, A) {
  const steps = [
    ['Set up your business', 'Name and a valid GSTIN', !!S.profile.name && validGstin(S.profile.gstin), 'settings'],
    ['Record your first transaction', 'Invoice, bill or expense', S.entries.length > 0, 'transactions'],
    ['Set a monthly collection goal', 'Gives the goal ring a target', +S.profile.monthly_goal > 0, 'settings'],
    ['Mark a return as filed', 'GSTR-1 or GSTR-3B', S.filings.length > 0, 'compliance'],
  ];
  const n = steps.filter((x) => x[2]).length;
  if (n === steps.length) return null;
  return card(`Get started · ${n}/${steps.length}`, h('i', { class: 'bar' }, h('u', { style: `width:${(n / steps.length) * 100}%` })),
    ...steps.map(([t, d, done, go]) => h('div', { class: 'quest ' + (done ? 'done' : '') }, h('i', {}, done ? '✓' : ''), h('div', {}, h('b', {}, t), h('small', {}, d)), !done && h('button', { onclick: () => A.go(go) }, 'Do it'))));
}

function dashboard(S, A) {
  const s = S.sum, goal = +S.profile.monthly_goal, k = (l, v, sub, key, cls = '') => h('div', { class: 'kpi ' + cls }, h('span', {}, l), num(v, key), sub && h('small', {}, sub));
  const alerts = S.alerts;
  const alertRow = (a) => h('div', { class: 'al ' + a.sev }, h('span', {}, a.text), h('div', { class: 'acts' },
    ...(a.type === 'overdue' && S.can('write') ? [h('button', { onclick: () => A.reminder(a.id) }, 'Send reminder'), h('button', { onclick: () => A.markPaid(a.id) }, 'Mark paid')] : []),
    ...(a.type === 'payable' && S.can('write') ? [h('button', { onclick: () => A.markPaid(a.id) }, 'Mark paid')] : []),
    ...(a.type === 'approval' ? [h('button', { onclick: () => A.go('approvals') }, 'Review')] : []),
    ...(a.type === 'filing' ? [h('button', { onclick: () => A.go('compliance') }, 'Open')] : []),
    ...(a.type === 'itc' ? [h('button', { onclick: () => A.go('transactions') }, 'Review bills')] : [])));
  const gstin = S.profile.gstin ? S.profile.gstin.slice(0, 4) + ' •••• •••• ' + S.profile.gstin.slice(-3) : 'Add GSTIN in Settings';
  return h('div', { class: 'stack' },
    h('div', { class: 'grid3' },
      h('section', { class: 'bizcard' }, h('div', { class: 'bc-top' }, h('b', {}, S.profile.name || 'Your business'), h('span', {}, 'MIND YOUR FUNDS')),
        h('div', { class: 'bc-cash' }, h('small', {}, 'Cash in hand'), num(s.cash, 'cash')), h('div', { class: 'bc-bot' }, h('span', {}, gstin), h('span', {}, `Lv ${S.level.n} · ${S.level.name}`))),
      h('section', { class: 'card center' }, h('h3', {}, 'Business health'), ring(S.entries.length ? s.health : 0, S.entries.length ? (s.health >= 70 ? 'Healthy' : s.health >= 45 ? 'Watch' : 'At risk') : 'No data'), h('p', { class: 'small mu' }, `Runway ${s.runwayMonths} mo · ${s.overdueCount} overdue`)),
      h('section', { class: 'card center' }, h('h3', {}, 'Monthly goal'), goal > 0 ? ring(Math.min(100, Math.round((s.collectedMonth / goal) * 100)), 'collected', '%') : h('div', { class: 'prize lock' }, h('b', {}, 'No goal set'), h('button', { onclick: () => A.go('settings') }, 'Set a goal')), goal > 0 && h('p', { class: 'small mu' }, `${inr(s.collectedMonth)} of ${inr(goal)} this month`))),
    onboarding(S, A),
    stories(S),
    h('div', { class: 'kpis four' }, k('To collect', s.receivable, `${inr(s.overdueAmt)} overdue`, 'recv'), k('To pay', s.payable, `${s.upcoming.filter((u) => u.dir === 'out').length} due in 14 days`, 'pay'), k('GST this month', s.gst.net.total, 'net payable after ITC', 'gst'), k('Input credit at risk', s.gst.itcAtRisk, 'fix supplier GSTINs', 'itc', s.gst.itcAtRisk ? 'bad' : '')),
    h('div', { class: 'grid2' },
      card("Today's quests", ...QUESTS.map((q) => { const d = q.done(S.ctx); return h('div', { class: 'quest ' + (d ? 'done' : '') }, h('i', {}, d ? '✓' : ''), h('div', {}, h('b', {}, q.title), h('small', {}, `${q.desc}${q.progress && !d ? ' · ' + q.progress(S.ctx) : ''}`)), h('em', {}, `+${q.xp} XP`)); })),
      rewardCard(S, A)),
    h('div', { class: 'grid2' },
      card(`Needs attention (${alerts.length})`, ...(alerts.length ? alerts.slice(0, 6).map(alertRow) : [empty(S.entries.length ? 'All clear. Nothing needs your attention.' : 'No data yet. Add a transaction or load sample data in Settings.')])),
      card('Next 14 days', ...(s.upcoming.length ? s.upcoming.map((u) => h('div', { class: 'up' }, h('span', { class: 'dot ' + u.dir }), h('div', {}, h('b', {}, u.party), h('small', {}, `${u.dir === 'in' ? 'Collect' : 'Pay'} by ${u.due_date}`)), h('em', {}, (u.dir === 'in' ? '+' : '−') + inr(u.total)))) : [empty('Nothing due in the next 14 days.')]))),
    card('Income vs spend (6 months)', chart(s.monthly), h('p', { class: 'small mu' }, 'Green = sales · Grey = purchases, expenses and payroll (by invoice date)')));
}

// ---------------------------------------------------------------- Transactions
function entryDialog(S, A) {
  const f = h('form', { class: 'form', method: 'dialog' });
  const sel = (id, opts, v) => { const e = h('select', { id }, ...opts.map(([val, t]) => h('option', { value: val, selected: val === v }, t))); return e; };
  const inp = (id, type = 'text', extra = {}) => h('input', { id, type, ...extra });
  const L = (t, el, cls = '') => h('label', { class: cls }, t, el);
  const kind = sel('e-kind', Object.entries(KIND), 'sale'), gstin = inp('e-gstin', 'text', { maxLength: 15 }), supply = sel('e-supply', [['intra', 'Same state (CGST+SGST)'], ['inter', 'Other state (IGST)']], 'intra');
  const hint = h('small', { class: 'mu' });
  gstin.oninput = () => { gstin.value = gstin.value.toUpperCase(); hint.textContent = gstin.value ? (validGstin(gstin.value) ? 'GSTIN valid' : 'GSTIN invalid: input credit will be flagged') : ''; if (validGstin(gstin.value) && validGstin(S.profile.gstin || '')) supply.value = guessSupply(S.profile.gstin, gstin.value); };
  const rate = sel('e-rate', [0, 5, 12, 18, 28, 40].map((r) => [r, r + '%']), 18);
  const [date, due, paid] = [inp('e-date', 'date', { value: today() }), inp('e-due', 'date'), inp('e-paid', 'date')];
  const [num, party, taxable, cat] = [inp('e-num'), inp('e-party', 'text', { required: true }), inp('e-taxable', 'number', { min: 0, step: '0.01', required: true }), inp('e-cat', 'text', { placeholder: 'Rent, Software, Travel…' })];
  kind.onchange = () => { if (kind.value === 'salary') rate.value = 0; };
  party.setAttribute('list', 'party-list');
  const dl = h('datalist', { id: 'party-list' }, ...S.parties.map((p) => h('option', { value: p.name })));
  party.onchange = () => { const p = S.parties.find((x) => x.name === party.value); if (p?.gstin && !gstin.value) { gstin.value = p.gstin; gstin.oninput(); } };
  const dlg = h('dialog', { class: 'dlg' }, h('h3', {}, 'Add transaction'), f, dl);
  f.append(L('Type', kind), L('Invoice / ref no.', num), L('Party / payee', party, 'full'), L('Party GSTIN', gstin, 'full'), hint, L('Category (expenses)', cat, 'full'), L('Date', date), L('Due date', due),
    L('Taxable value ₹', taxable), L('GST %', rate), L('Supply', supply), L('Paid on', paid),
    h('div', { class: 'full row' }, h('button', { type: 'button', onclick: () => dlg.close() }, 'Cancel'), h('button', { class: 'pri', type: 'submit' }, 'Save')));
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    try {
      await A.addEntry({ kind: kind.value, number: num.value.trim() || null, party: party.value.trim(), gstin: gstin.value.trim() || null, category: cat.value.trim() || null, date: date.value, due_date: due.value || null, taxable: +taxable.value, gst_rate: +rate.value, supply: supply.value, paid_date: paid.value || null });
      dlg.close();
    } catch (x) { toast('Could not save', x.message, 'bad'); }
  };
  return dlg;
}

function importDialog(S, A) {
  const body = h('div'), dlg = h('dialog', { class: 'dlg wide' }, h('h3', {}, 'Import bank statement'), body);
  const file = h('input', { type: 'file', accept: '.csv,text/csv', onchange: async (e) => { const f = e.target.files[0]; if (f) show(await f.text()); e.target.value = ''; } });
  const show = (text) => {
    const rows = parseBank(text);
    body.textContent = '';
    if (!rows.length) return body.append(h('p', { class: 'al high' }, 'No transactions found. The CSV needs a Date column and Debit/Credit (or Amount) columns.'), h('button', { onclick: () => dlg.close() }, 'Close'));
    const pairs = matchBank(rows, S.sum.rows), checks = [];
    const tb = h('tbody', {}, ...pairs.map(({ row, entry }) => {
      const cb = h('input', { type: 'checkbox', checked: !!entry, disabled: !entry }); checks.push([cb, entry, row]);
      return h('tr', {}, h('td', {}, cb), h('td', {}, row.date), h('td', {}, row.desc), h('td', { class: 'n' }, (row.amount > 0 ? '+' : '−') + inr(Math.abs(row.amount))),
        h('td', {}, entry ? h('span', { class: 'tag paid' }, `${entry.party} ${entry.number || ''}`) : h('button', { onclick: async (ev) => { ev.target.disabled = true; await A.addEntry({ kind: row.amount > 0 ? 'sale' : 'expense', number: null, party: row.desc.slice(0, 40) || 'Bank entry', gstin: null, category: 'Bank import', date: row.date, due_date: row.date, taxable: Math.abs(row.amount), gst_rate: 0, supply: 'intra', paid_date: row.date }); ev.target.textContent = 'Added'; } }, 'Add as entry')));
    }));
    const matched = pairs.filter((p) => p.entry).length;
    body.append(h('p', { class: 'mu' }, `${rows.length} bank transactions · ${matched} matched to open invoices/bills by amount.`), h('div', { class: 'scroll tall' }, h('table', {}, h('thead', {}, h('tr', {}, ...['', 'Date', 'Narration', 'Amount', 'Match'].map((x) => h('th', {}, x)))), tb)),
      h('div', { class: 'row' }, h('button', { onclick: () => dlg.close() }, 'Cancel'), h('span', { class: 'sp' }), h('button', { class: 'pri', onclick: async () => { const sel = checks.filter(([c, e]) => c.checked && e).map(([, e, r]) => [e.id, r.date]); dlg.close(); if (sel.length) await A.reconcile(sel); } }, 'Reconcile selected')));
  };
  dlg.openPicker = () => { body.textContent = ''; body.append(h('p', { class: 'mu' }, 'Choose a CSV exported from your bank (Date, Narration, Debit, Credit). Nothing leaves your browser until you confirm.'), file); dlg.showModal(); };
  return dlg;
}

let txFilter = 'all', txQuery = '';
function transactions(S, A) {
  const dlg = entryDialog(S, A), imp = importDialog(S, A), body = h('tbody');
  const draw = () => {
    body.textContent = '';
    const rows = S.allRows.filter((r) => (txFilter === 'all' || r.kind === txFilter) && (!txQuery || (r.party + (r.number || '')).toLowerCase().includes(txQuery))).sort((a, b) => b.date.localeCompare(a.date));
    if (!rows.length) body.append(h('tr', {}, h('td', { colSpan: 9, class: 'mu' }, 'No transactions yet.')));
    for (const r of rows) {
      const over = !r.paid_date && r.due_date && r.due_date < today();
      body.append(h('tr', {}, h('td', {}, KIND[r.kind]), h('td', {}, r.number || ''), h('td', {}, r.party), h('td', {}, r.date), h('td', {}, r.due_date || ''),
        h('td', { class: 'n' }, inr(r.taxable)), h('td', { class: 'n' }, inr(r.tax.total)), h('td', { class: 'n' }, inr(r.total)),
        h('td', {}, r.approval === 'pending' ? h('span', { class: 'tag' }, 'Pending approval') : r.approval === 'rejected' ? h('span', { class: 'tag over' }, 'Rejected') : h('span', { class: 'tag ' + (r.paid_date ? 'paid' : over ? 'over' : '') }, r.paid_date ? 'Paid' : over ? 'Overdue' : 'Open')),
        h('td', { class: 'acts' }, S.can('write') && !r.paid_date && (r.approval || 'approved') === 'approved' && h('button', { onclick: () => A.markPaid(r.id) }, 'Mark paid'), S.can('write') && over && r.kind === 'sale' && h('button', { onclick: () => A.reminder(r.id) }, 'Remind'),
          r.kind === 'sale' && h('button', { title: 'Print invoice', onclick: () => A.printInvoice(r.id) }, 'Invoice'),
          S.can('admin') && h('button', { title: 'Delete', onclick: () => confirm('Delete this entry? This is recorded in the audit trail.') && A.remove(r.id) }, '✕'))));
    }
  };
  const filter = h('select', { onchange: (e) => { txFilter = e.target.value; draw(); } }, ...[['all', 'All'], ...Object.entries(KIND)].map(([v, t]) => h('option', { value: v, selected: v === txFilter }, t)));
  const search = h('input', { placeholder: 'Search party or invoice no.', value: txQuery, oninput: (e) => { txQuery = e.target.value.toLowerCase(); draw(); } });
  draw();
  return h('div', { class: 'stack' }, card('Transactions', h('div', { class: 'row bar' }, filter, search, h('span', { class: 'sp' }),
    S.can('write') && h('button', { onclick: () => imp.openPicker() }, 'Import bank CSV'), h('button', { onclick: () => download(`transactions-${today()}.csv`, toCsv(S.allRows)) }, 'Export CSV'), S.can('write') && h('button', { class: 'pri', onclick: () => dlg.showModal() }, '+ Add transaction')),
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Type', 'No.', 'Party', 'Date', 'Due', 'Taxable', 'GST', 'Total', 'Status', ''].map((t, i) => h('th', { class: [5, 6, 7].includes(i) ? 'n' : '' }, t)))), body))), dlg, imp);
}

// ---------------------------------------------------------------- Compliance
let gstMonth = null;
function compliance(S, A) {
  const cur = today().slice(0, 7), months = [0, 1, 2, 3].map((i) => prevMonth(cur, i));
  gstMonth ||= cur;
  const g = gstFor(S.sum.rows, gstMonth), hd = (o) => `CGST ${inr(o.cgst)} · SGST ${inr(o.sgst)} · IGST ${inr(o.igst)}`;
  const rows = S.filingsView.map((f) => {
    const net = f.type === 'GSTR3B' ? gstFor(S.sum.rows, f.period).net.total : 0, late = f.saved ? 0 : Math.max(0, daysBetween(f.due_date, today())), amt = h('input', { type: 'number', value: Math.round(net), min: 0, class: 'amt' });
    const interest = late > 0 && net > 0 ? Math.round(net * GST_LATE_INTEREST_PA * late / 365) : 0;
    return h('tr', {}, h('td', {}, f.type === 'GSTR1' ? 'GSTR-1 (sales)' : 'GSTR-3B (summary + tax)'), h('td', {}, f.period), h('td', {}, f.due_date),
      h('td', { class: 'n' }, f.type === 'GSTR3B' ? inr(net) : '—'),
      h('td', {}, h('span', { class: 'tag ' + (f.status === 'filed' ? 'paid' : f.status === 'late' || f.status === 'overdue' ? 'over' : '') }, f.status === 'filed' ? `Filed ${f.saved.filed_date}` : f.status === 'late' ? `Filed late ${f.saved.filed_date}` : f.status === 'overdue' ? `Overdue ${late}d${interest ? ` · est. interest ${inr(interest)}` : ''}` : 'Upcoming')),
      h('td', { class: 'acts' }, !f.saved && (f.type === 'GSTR3B' ? amt : null), !f.saved && h('button', { class: 'pri', onclick: () => A.file(f.type, f.period, f.due_date, +amt.value || 0) }, 'Mark filed')));
  });
  return h('div', { class: 'stack' },
    card('Filing calendar', h('p', { class: 'mu small' }, 'Mark a return as filed after you file it on the GST portal. Filing on or before the due date earns +40 XP and builds your compliance streak.'),
      h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Return', 'Period', 'Due', 'Net tax', 'Status', ''].map((t) => h('th', {}, t)))), h('tbody', {}, ...rows)))),
    card('GST position', h('div', { class: 'row' }, h('span', { class: 'mu' }, 'Month'), h('select', { onchange: (e) => { gstMonth = e.target.value; A.render(); } }, ...months.map((m) => h('option', { value: m, selected: m === gstMonth }, m)))),
      h('div', { class: 'kpis' }, h('div', { class: 'kpi' }, h('span', {}, 'Output tax (sales)'), h('b', {}, inr(g.output.cgst + g.output.sgst + g.output.igst)), h('small', {}, hd(g.output))),
        h('div', { class: 'kpi' }, h('span', {}, 'Input credit (valid GSTIN)'), h('b', {}, inr(g.itc.cgst + g.itc.sgst + g.itc.igst)), h('small', {}, hd(g.itc))),
        h('div', { class: 'kpi' }, h('span', {}, 'Net payable'), h('b', {}, inr(g.net.total)), h('small', {}, hd(g.net.payable))),
        h('div', { class: 'kpi ' + (g.itcAtRisk ? 'bad' : '') }, h('span', {}, 'Credit at risk'), h('b', {}, inr(g.itcAtRisk)), h('small', {}, `${g.itcRiskRows.length} bill(s) without valid GSTIN`))),
      ...g.itcRiskRows.map((r) => h('div', { class: 'al med' }, `${r.party} · ${r.number || 'no number'} · ${inr(r.tax.total)} credit lost until the supplier GSTIN is corrected`)),
      h('p', { class: 'mu small' }, 'Planning estimates only. Verify with your Chartered Accountant before filing.')));
}

// ---------------------------------------------------------------- Insights
function insights(S, A) {
  const s = S.sum, out = h('div', { class: 'chat' }), q = h('input', { placeholder: 'Ask anything: "Can I afford a hire next month?"' });
  const facts = () => `Cash ₹${Math.round(s.cash)}, to collect ₹${Math.round(s.receivable)} (overdue ₹${Math.round(s.overdueAmt)}), to pay ₹${Math.round(s.payable)}, GST payable this month ₹${Math.round(s.gst.net.total)}, runway ${s.runwayMonths} months, health ${s.health}, ${S.alerts.length} open alerts. Due in 30 days: collect ₹${Math.round(s.in30)}, pay ₹${Math.round(s.out30)}.`;
  const say = async (text, fallback) => {
    out.append(h('div', { class: 'msg me' }, text)); const r = h('div', { class: 'msg ai' }, '…'); out.append(r);
    r.textContent = await ask([{ role: 'system', content: 'You are the Mind Your Funds CFO assistant for an Indian small business. Use only the facts given. Max 80 words, include ₹ numbers, no invented tax rules, end with the next action.' }, { role: 'user', content: `${facts()} Question: ${text.slice(0, 300)}` }], fallback);
    await A.audit('ai.ask', null, { q: text.slice(0, 80) }, `Asked the AI CFO: "${text.slice(0, 80)}" using aggregate figures only (no names).`);
    await A.award('ai_used', today(), 5, 'Asked the AI CFO');
  };
  const send = () => { if (q.value.trim()) { say(q.value, `With ${inr(s.cash)} cash and ${inr(s.out30)} due out in 30 days against ${inr(s.in30)} coming in, keep cash above one payroll plus the next GST payment before committing new spend.`); q.value = ''; } };
  q.onkeydown = (e) => e.key === 'Enter' && send();
  const slip = s.cash - s.out30, base = s.cash + s.in30 - s.out30;
  return h('div', { class: 'grid2' },
    card('AI CFO', h('div', { class: 'row' }, ...['Explain my month', 'What should I do this week?', 'Can I afford a new hire?'].map((p) => h('button', { onclick: () => say(p, `${inr(s.cash)} cash; ${inr(s.receivable)} to collect; ${inr(s.gst.net.total)} GST payable. ${S.alerts[0]?.text || 'No urgent items.'}`) }, p))),
      out, h('div', { class: 'row' }, q, h('button', { class: 'pri', onclick: send }, 'Ask')), h('p', { class: 'small mu' }, 'Only aggregate numbers are sent to the AI: never names or GSTINs.')),
    card('30-day stress test',
      h('div', { class: 'kpis one' }, h('div', { class: 'kpi' }, h('span', {}, 'Expected cash in 30 days'), h('b', {}, inr(base)), h('small', {}, `${inr(s.in30)} in · ${inr(s.out30)} out`)),
        h('div', { class: 'kpi ' + (slip < 0 ? 'bad' : '') }, h('span', {}, 'If every customer pays late'), h('b', {}, inr(slip)), h('small', {}, 'no collections in the window'))),
      h('p', { class: slip < 0 ? 'al high' : 'mu' }, slip < 0 ? 'You could run short if collections slip. Chase top invoices and negotiate supplier terms now.' : 'You can absorb a full month of late payments.')));
}

// ---------------------------------------------------------------- Rewards
function rewards(S, A) {
  const L = S.level, earned = new Set(S.badges.map((b) => b.code)), lb = h('div', { class: 'mu' }, 'Loading…');
  A.leaderboard().then((rows) => { lb.textContent = ''; if (!rows.length) lb.append(empty(S.repo.mode === 'cloud' ? 'No one has joined yet. Opt in under Settings to appear here.' : 'Leaderboard needs a signed-in account.')); rows.forEach((r, i) => lb.append(h('div', { class: 'up' }, h('b', {}, `#${i + 1}`), h('div', {}, h('b', {}, r.nickname), h('small', {}, `Health ${r.health ?? '—'}`)), h('em', {}, `${r.xp} XP`)))); });
  return h('div', { class: 'stack' },
    h('div', { class: 'grid2' },
      card('Your level', h('div', { class: 'lvl' }, h('b', {}, `Level ${L.n} · ${L.name}`), h('span', {}, `${S.xp} XP`)), h('i', { class: 'bar' }, h('u', { style: `width:${L.pct}%` })), h('p', { class: 'small mu' }, L.next ? `${L.toNext} XP to ${L.next}` : 'Top level reached'),
        h('p', {}, h('b', {}, `${S.ctx.streak}-day streak`), h('span', { class: 'mu' }, ' · check in daily to keep it alive')),
        h('p', { class: 'small mu' }, 'XP: check-in 10 · transaction 5 · paid on time 15 · return filed on time 40 · alert resolved 10 · badge 25')),
      card('Leaderboard', lb)),
    card(`Badges (${earned.size}/${BADGES.length})`, h('div', { class: 'badges' }, ...BADGES.map((b) => h('div', { class: 'badge ' + (earned.has(b.code) ? 'on' : '') }, h('b', {}, b.title), h('small', {}, b.desc))))),
    card('Level ladder', h('div', { class: 'ladder' }, ...LEVELS.map(([x, n], i) => h('div', { class: i + 1 <= L.n ? 'on' : '' }, h('b', {}, n), h('small', {}, `${x} XP`))))));
}

// ---------------------------------------------------------------- Audit
function audit(S, A) {
  const status = h('span', { class: 'pill' }, 'Not verified'), org = S.can('admin') && S.repo.mode === 'cloud', rows = org ? [...S.orgLog].sort((x, y) => (y.created_at || '').localeCompare(x.created_at || '')) : [...S.ledger.entries].reverse();
  const e2 = (e) => ({ n: e.n, day: e.day, agent: e.agent, action: e.decision?.action || '', why: e.why, hash: e.hash });
  return card(org ? 'Audit trail · whole company' : 'Audit trail · your activity', h('p', { class: 'mu small' }, 'Every change is recorded with who did it and why, and chained to the previous record with SHA-256. Editing history breaks the chain. Verification checks your own chain.'),
    h('div', { class: 'row' }, h('button', { class: 'pri', onclick: async () => { const bad = await S.ledger.verify(); status.textContent = bad ? `Tampered at #${bad}` : `Verified · ${S.ledger.entries.length} of your records`; status.classList.toggle('bad', !!bad); } }, 'Verify my chain'), status,
      h('span', { class: 'sp' }), h('button', { onclick: () => download(`audit-${today()}.json`, JSON.stringify(rows.map(e2), null, 2), 'application/json') }, 'Export')),
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['#', 'Date', 'Who', 'Action', 'Why', 'Hash'].map((x) => h('th', {}, x)))),
      h('tbody', {}, ...(rows.length ? rows.map((r) => { const e = e2(r); return h('tr', {}, h('td', {}, String(e.n)), h('td', {}, e.day), h('td', {}, e.agent), h('td', {}, e.action), h('td', {}, e.why), h('td', { class: 'mono' }, (e.hash || '').slice(0, 10))); }) : [h('tr', {}, h('td', { colSpan: 6, class: 'mu' }, 'No activity yet.'))])))));
}

function recurringCard(S, A) {
  const kind = h('select', {}, ...[['expense', 'Expense'], ['salary', 'Salary'], ['purchase', 'Purchase'], ['sale', 'Sale']].map(([v, l]) => h('option', { value: v }, l)));
  const party = h('input', { placeholder: 'Rent, payroll, software…' }), amt = h('input', { type: 'number', min: 0, placeholder: 'Amount ₹', class: 'amt' }), day = h('input', { type: 'number', min: 1, max: 28, value: 1, class: 'amt' });
  const rate = h('select', {}, ...[0, 5, 12, 18, 28, 40].map((r) => h('option', { value: r }, r + '%')));
  return card('Recurring entries', h('p', { class: 'mu small' }, 'Created automatically each month on the chosen day (1–28).'),
    ...S.recurring.map((r) => h('div', { class: 'up' }, h('div', {}, h('b', {}, r.party), h('small', {}, `${KIND[r.kind]} · ${inr(r.taxable)} + ${r.gst_rate}% · day ${r.day_of_month}`)), h('button', { onclick: () => A.removeRecurring(r.id) }, 'Stop'))),
    h('div', { class: 'row' }, kind, party, amt, rate, day, h('button', { class: 'pri', onclick: () => { if (!party.value.trim() || !+amt.value) return toast('Add a name and amount', '', 'bad'); A.addRecurring({ kind: kind.value, party: party.value.trim(), taxable: +amt.value, gst_rate: +rate.value, day_of_month: Math.min(28, Math.max(1, +day.value || 1)), gstin: null, category: null }); } }, 'Add')));
}

// ---------------------------------------------------------------- Settings
function settings(S, A) {
  const p = S.profile, i = (id, v = '', t = 'text', ex = {}) => h('input', { id, type: t, value: v ?? '', ...ex });
  const [name, gstin, ob, nick, goal] = [i('s-name', p.name), i('s-gstin', p.gstin, 'text', { maxLength: 15 }), i('s-ob', p.opening_balance ?? 0, 'number', { step: '0.01' }), i('s-nick', p.nickname, 'text', { maxLength: 20 }), i('s-goal', p.monthly_goal ?? 0, 'number', { min: 0, step: '1000' })];
  const opt = h('input', { type: 'checkbox', checked: !!p.leaderboard_opt_in });
  gstin.oninput = () => { gstin.value = gstin.value.toUpperCase(); };
  if (!S.can('admin')) [name, gstin, ob, goal].forEach((x) => { x.disabled = true; });
  return h('div', { class: 'grid2' },
    card('Company profile', h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); if (gstin.value && !validGstin(gstin.value)) return toast('Invalid GSTIN', 'Check all 15 characters.', 'bad'); A.saveProfile({ name: name.value.trim(), gstin: gstin.value.trim() || null, opening_balance: +ob.value || 0, monthly_goal: +goal.value || 0, nickname: nick.value.trim() || null, leaderboard_opt_in: opt.checked && !!nick.value.trim() }); } },
      h('label', { class: 'full' }, 'Company name', name), h('label', { class: 'full' }, 'Company GSTIN', gstin), h('label', { class: 'full' }, 'Opening cash balance ₹', ob), h('label', { class: 'full' }, 'Monthly collection goal ₹', goal),
      h('label', { class: 'full' }, 'Leaderboard nickname', nick), h('label', { class: 'full chk' }, opt, ' Show me on the leaderboard (nickname, XP and health only)'), h('button', { class: 'pri full', type: 'submit' }, 'Save'))),
    h('div', { class: 'stack' },
      card('Account & storage', h('p', {}, h('b', {}, S.repo.mode === 'cloud' ? 'Supabase cloud database' : 'Demo mode (this browser only)')), h('p', { class: 'mu' }, `${S.user.email} · role: ${S.repo.role}`),
        S.repo.mode === 'demo' && h('p', { class: 'al med' }, 'Demo mode does not sync. Sign in to store everything in your Supabase database.'), h('button', { onclick: A.signOut }, S.repo.mode === 'cloud' ? 'Sign out' : 'Exit demo')),
      S.can('write') && recurringCard(S, A),
      card('Sample data', h('p', { class: 'mu' }, 'Load a realistic set of invoices, bills and expenses (with an overdue invoice and a bad GSTIN) to explore the app.'), S.can('write') ? h('button', { onclick: A.demo }, 'Load sample data') : h('p', { class: 'mu' }, 'Your role is read-only.')),
      card('Export', h('button', { onclick: () => download(`transactions-${today()}.csv`, toCsv(S.sum.rows)) }, 'Download all transactions (CSV)'))));
}

export const VIEWS = { dashboard, transactions, compliance, insights, rewards, audit, settings };

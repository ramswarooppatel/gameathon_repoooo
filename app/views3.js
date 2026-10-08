// Guided workflow pages: Today (daily / weekly / month-end routines), Cash planner, Learn.
import { h, inr, today as todayStr, toast } from './util.js';
import { forecast, gstReserve, payPriority, collectionPlan, budgetStatus, monthCloseItems, tips, reminderFor, categoryOf } from '../workspace/planner.js';
import { prevMonth, daysBetween } from '../workspace/calc.js';
import { LESSONS, PASS, scoreQuiz } from './lessons.js';
import { icon } from './icons.js';

const card = (title, ...kids) => h('section', { class: 'card' }, title && h('h3', {}, title), ...kids);
const empty = (t) => h('p', { class: 'mu' }, t);
const short = (n) => { const a = Math.abs(n); const s = a >= 1e7 ? (a / 1e7).toFixed(1) + 'Cr' : a >= 1e5 ? (a / 1e5).toFixed(1) + 'L' : a >= 1e3 ? Math.round(a / 1e3) + 'k' : String(Math.round(a)); return (n < 0 ? '−' : '') + '₹' + s; };

const once = new Set();
const award1 = (A, kind, ref, xp, label) => { const k = kind + ref; if (once.has(k)) return; once.add(k); A.award(kind, ref, xp, label); };

// ---------------------------------------------------------------- shared helpers
function makePlan(S) {
  const rows = S.sum.rows, today = S.ctx.today, ctx = { today, cash: S.sum.cash, recurring: S.recurring, filings: S.filings, horizon: 60 };
  const reserve = gstReserve(rows, today, S.filings);
  return { today, base: forecast(rows, ctx, 'base'), late: forecast(rows, ctx, 'late'), ontime: forecast(rows, ctx, 'ontime'), ctx, reserve,
    pay: payPriority(rows, S.sum.cash, today, reserve.amount), collect: collectionPlan(rows, today), budget: budgetStatus(rows, S.profile.budgets, today.slice(0, 7), today), get firstNegative() { return this.base.firstNegative; } };
}
const ticked = (S, period, item) => (S.ticks || []).find((t) => t.period === period && t.item === item);
function weekKey(d) { const t = new Date(d + 'T00:00:00Z'), day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3); const y = t.getUTCFullYear(), w = 1 + Math.round(((t - new Date(Date.UTC(y, 0, 4))) / 864e5 - 3 + ((new Date(Date.UTC(y, 0, 4)).getUTCDay() + 6) % 7)) / 7); return `${y}-W${String(w).padStart(2, '0')}`; }
function openAddTransaction() { setTimeout(() => { const b = [...document.querySelectorAll('button')].find((x) => /add transaction/i.test(x.textContent)); b?.click(); }, 350); }

function lineChart(lines, { w = 640, h: hh = 220, today }) {
  const pts = lines.flatMap((l) => l.points.map((p) => p.cash)), lo = Math.min(0, ...pts), hi = Math.max(1, ...pts), pad = 8, L = 48, B = 22, W = w - L - pad, H = hh - B - pad;
  const x = (i, n) => L + (i / (n - 1)) * W, y = (v) => pad + (1 - (v - lo) / (hi - lo)) * H;
  let s = `<svg viewBox="0 0 ${w} ${hh}" role="img" aria-label="Cash forecast chart" class="fc-chart">`;
  for (const v of [lo, (lo + hi) / 2, hi]) s += `<line x1="${L}" x2="${w - pad}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="currentColor" opacity=".12"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="currentColor" opacity=".7">${short(v)}</text>`;
  if (lo < 0) s += `<line x1="${L}" x2="${w - pad}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" stroke="#ef5b5b" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  for (const l of lines) {
    const n = l.points.length; s += `<polyline fill="none" stroke="${l.color}" stroke-width="${l.bold ? 3 : 2}" stroke-linejoin="round" ${l.dash ? 'stroke-dasharray="6 4"' : ''} points="${l.points.map((p, i) => `${x(i, n).toFixed(1)},${y(p.cash).toFixed(1)}`).join(' ')}"/>`;
  }
  const n = lines[0].points.length; for (const i of [0, Math.floor((n - 1) / 2), n - 1]) s += `<text x="${x(i, n).toFixed(1)}" y="${hh - 4}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}" font-size="11" fill="currentColor" opacity=".7">${lines[0].points[i].date.slice(5)}</text>`;
  const el = h('div', { class: 'fc-wrap' }); el.innerHTML = s + '</svg>'; return el;
}
const chipTone = (t) => h('span', { class: 'chip ' + t.cls }, t.text);

// ---------------------------------------------------------------- TODAY (guided workflow)
let tab = 'daily';
export function workflow(S, A) {
  const P = makePlan(S), T = S.ctx.today, entriesToday = S.events.filter((e) => e.kind === 'entry_added' && e.day === T).length;
  const remindedToday = (id) => S.events.some((e) => e.kind === 'alert_resolved' && e.day === T && e.ref === id + ':remind');
  const overdue = P.collect.filter((c) => c.late > 0), dueSoonPay = P.pay.filter((p) => p.late > 0 || daysBetween(T, p.due) <= 3);
  const filingsSoon = S.filingsView.filter((f) => !f.saved && daysBetween(T, f.due_date) <= 7);
  const nothing = ticked(S, T, 'nothing-to-record');
  const steps = [
    { id: 'cash', n: 1, title: 'Check your cash', done: !P.firstNegative && P.base.min.cash >= P.reserve.amount, state: P.firstNegative ? 'bad' : P.base.min.cash < P.reserve.amount ? 'warn' : 'ok' },
    { id: 'collect', n: 2, title: 'Collect what you are owed', done: overdue.every((c) => remindedToday(c.row.id)), state: overdue.length ? 'warn' : 'ok' },
    { id: 'pay', n: 3, title: 'Pay in the right order', done: dueSoonPay.length === 0, state: dueSoonPay.some((p) => p.action === 'cash-short') ? 'bad' : dueSoonPay.length ? 'warn' : 'ok' },
    { id: 'comply', n: 4, title: 'Stay compliant', done: filingsSoon.length === 0, state: filingsSoon.some((f) => f.status === 'overdue') ? 'bad' : filingsSoon.length ? 'warn' : 'ok' },
    { id: 'record', n: 5, title: "Record today's money", done: entriesToday > 0 || !!nothing, state: entriesToday > 0 || nothing ? 'ok' : 'warn' },
  ];
  const doneN = steps.filter((s) => s.done).length;
  if (doneN === steps.length && S.entries.length) award1(A, 'daily_routine', T, 20, 'Daily routine complete');
  const stateChip = (s) => h('span', { class: 'chip ' + (s.done ? 'good' : s.state === 'bad' ? 'bad' : 'warn') }, s.done ? 'Done' : s.state === 'bad' ? 'Needs attention' : 'To do');

  const spark = (() => { const d = P.base.series.slice(0, 31); return lineChart([{ points: d, color: '#19c37d', bold: true }], { w: 420, h: 150 }); })();
  const bodies = {
    cash: [h('div', { class: 'step-row' }, h('div', {}, h('small', { class: 'mu' }, 'Cash in hand'), h('b', { class: 'big' }, inr(S.sum.cash))), h('div', {}, h('small', { class: 'mu' }, 'Runway'), h('b', { class: 'big' }, `${S.sum.runwayMonths} mo`)), h('div', {}, h('small', { class: 'mu' }, 'Lowest in 60 days'), h('b', { class: 'big ' + (P.base.min.cash < 0 ? 'neg' : '') }, inr(P.base.min.cash)), h('small', { class: 'mu' }, P.base.min.date))),
      P.firstNegative ? h('p', { class: 'al high' }, `Your forecast goes negative on ${P.firstNegative}. Chase the invoices below or negotiate the biggest bill.`) : h('p', { class: 'mu' }, `Keep at least ${inr(P.reserve.amount)} aside for GST. Forecast uses each customer's usual payment delay.`),
      spark, h('div', { class: 'acts' }, h('button', { onclick: () => A.go('planner') }, 'Open Cash planner'))],
    collect: [...(P.collect.length ? P.collect.slice(0, 4).map((c) => h('div', { class: 'wf-item' }, h('div', { class: 'grow' }, h('b', {}, `${c.row.party} · ${inr(c.row.total)}`), h('small', { class: 'mu block' }, `${c.row.number || 'invoice'} · ${c.late > 0 ? c.late + ' days overdue' : 'due ' + c.row.due_date}${c.usual != null ? ` · usually pays ${Math.round(c.usual)}d late` : ''}`), h('span', { class: 'chip ' + (c.stage.key === 'escalate' || c.stage.key === 'call' ? 'bad' : 'warn') }, c.stage.label), h('small', { class: 'mu block' }, c.stage.action)),
        h('div', { class: 'acts' }, S.can('write') && h('button', { class: remindedToday(c.row.id) ? '' : 'pri', onclick: () => A.remindStage(c.row.id, reminderFor(c.stage, c.row, S.profile.name, inr)) }, remindedToday(c.row.id) ? 'Sent today' : 'Send reminder'), S.can('write') && h('button', { onclick: () => A.markPaid(c.row.id) }, 'Mark paid')))) : [h('p', { class: 'mu' }, 'No overdue or due-soon invoices. Nothing to chase today.')]),
      P.collect.length > 4 && h('small', { class: 'mu' }, `+${P.collect.length - 4} more in Transactions`)],
    pay: [h('p', { class: 'mu' }, `Cash ${inr(S.sum.cash)} − GST reserve ${inr(P.reserve.amount)} = ${inr(Math.max(0, S.sum.cash - P.reserve.amount))} available to pay out.`),
      ...(P.pay.length ? P.pay.slice(0, 4).map((p) => h('div', { class: 'wf-item' }, h('div', { class: 'grow' }, h('b', {}, `${p.row.party} · ${inr(p.row.total)}`), h('small', { class: 'mu block' }, `${p.row.number || p.row.kind} · due ${p.due}${p.flags.length ? ' · ' + p.flags[0] : ''}`),
        h('span', { class: 'chip ' + (p.action === 'pay' ? 'good' : p.action === 'cash-short' ? 'bad' : 'info') }, p.action === 'pay' ? 'Pay now' : p.action === 'cash-short' ? 'Cash short' : 'Schedule'), h('small', { class: 'mu block' }, p.why)),
        h('div', { class: 'acts' }, S.can('write') && p.action === 'pay' && h('button', { class: 'pri', onclick: () => A.markPaid(p.row.id) }, 'Mark paid')))) : [h('p', { class: 'mu' }, 'No unpaid bills. Nice.')])],
    comply: [...(filingsSoon.length ? filingsSoon.map((f) => h('div', { class: 'wf-item' }, h('div', { class: 'grow' }, h('b', {}, `${f.type === 'GSTR1' ? 'GSTR-1' : 'GSTR-3B'} for ${f.period}`), h('small', { class: 'mu block' }, `${f.status === 'overdue' ? 'Overdue since' : 'Due'} ${f.due_date}`)), h('div', { class: 'acts' }, h('button', { onclick: () => A.go('compliance') }, 'Open')))) : [h('p', { class: 'mu' }, 'No returns due in the next 7 days.')]),
      h('p', { class: 'small mu' }, `GST set-aside suggestion: ${inr(P.reserve.amount)} (estimate, verify with your CA).`)],
    record: [h('p', { class: 'mu' }, entriesToday ? `${entriesToday} transaction(s) logged today. Great.` : 'Log sales, bills and expenses from today, or import your bank statement.'),
      h('div', { class: 'acts' }, S.can('write') && h('button', { class: 'pri', onclick: () => { A.go('transactions'); openAddTransaction(); } }, '+ Add transaction'), S.can('write') && h('button', { onclick: () => { A.go('transactions'); setTimeout(() => [...document.querySelectorAll('button')].find((x) => /import bank/i.test(x.textContent))?.click(), 350); } }, 'Import bank CSV'),
        S.can('write') && !entriesToday && !nothing && h('button', { onclick: () => A.tick(T, 'nothing-to-record', true) }, 'Nothing to record today'))],
  };
  const daily = h('div', { class: 'stack' }, ...steps.map((s) => h('section', { class: 'card wf-step ' + (s.done ? 'is-done' : '') }, h('div', { class: 'wf-head' }, h('span', { class: 'wf-n' }, s.done ? icon('check', { size: 16 }) : String(s.n)), h('h3', {}, s.title), stateChip(s)), ...bodies[s.id])));

  // weekly (manual ticks keyed by ISO week)
  const wk = weekKey(T), WEEKLY = [['forecast', 'Review the 60-day cash forecast', 'planner'], ['bank', 'Reconcile bank transactions', 'transactions'], ['aging', 'Follow up every invoice over 30 days old', 'reports'], ['budget', 'Check budget vs actual', 'planner'], ['backup', 'Export transactions (CSV) as a backup', 'transactions']];
  const check = (period, id, title, hint, go, auto) => { const t = ticked(S, period, id), done = auto ?? !!t;
    return h('div', { class: 'wf-check ' + (done ? 'done' : '') }, h('input', { type: 'checkbox', checked: done, disabled: auto !== undefined || !S.can('write'), 'aria-label': title, onchange: (e) => A.tick(period, id, e.target.checked) }), h('div', { class: 'grow' }, h('b', {}, title), hint && h('small', { class: 'mu block' }, hint)), go && h('button', { class: 'sm', onclick: () => A.go(go) }, 'Open')); };
  const weekly = h('div', { class: 'stack' }, card(`This week · ${wk}`, h('p', { class: 'mu' }, 'Ten minutes once a week keeps surprises away.'), ...WEEKLY.map(([id, t, go]) => check(wk, id, t, '', go))));

  // monthly close
  const period = prevMonth(T.slice(0, 7)), items = monthCloseItems(S, period), closed = items.filter((i) => (i.auto !== undefined ? i.auto : !!ticked(S, period, i.id))).length;
  if (closed === items.length && S.entries.length) award1(A, 'month_close', period, 50, `Month ${period} closed`);
  const monthly = h('div', { class: 'stack' }, card(`Close ${period}`, h('i', { class: 'bar' }, h('u', { style: `width:${Math.round((closed / items.length) * 100)}%` })), h('p', { class: 'mu' }, `${closed} of ${items.length} steps complete. Automatic steps tick themselves from your data; the rest you confirm.`),
    ...items.map((i) => check(period, i.id, i.title, i.hint, i.go, i.auto))));

  const pct = Math.round((doneN / steps.length) * 100), hour = new Date().getHours(), greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const nextLesson = LESSONS.find((l) => !S.events.some((e) => e.kind === 'lesson' && e.ref === l.id));
  const tabs = h('div', { class: 'seg tabs-seg', role: 'tablist' }, ...[['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Month-end close']].map(([id, label]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === id), 'aria-pressed': String(tab === id), onclick: () => { tab = id; A.render(); } }, label)));
  const side = h('div', { class: 'stack' },
    card('Smart tips', ...tips(S, { ...P, reserve: P.reserve }).slice(0, 4).map((t) => h('div', { class: 'tip ' + t.tone }, h('b', {}, t.title), h('p', {}, t.body), h('small', { class: 'mu' }, 'Why: ' + t.why)))),
    card('GST set-aside', h('b', { class: 'big' }, inr(P.reserve.amount)), h('p', { class: 'mu small' }, 'Estimated tax for open periods. Keep it out of daily spending until you file.')),
    nextLesson ? card('Learn something new', h('b', {}, nextLesson.title), h('p', { class: 'mu small' }, `${nextLesson.mins} min · earn 25 XP`), h('button', { class: 'pri', onclick: () => A.go('learn') }, 'Start lesson')) : null);
  return h('div', { class: 'stack' },
    h('section', { class: 'card wf-hero' }, h('div', {}, h('small', { class: 'mu' }, new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })), h('h2', { class: 'wf-title' }, `${greet}, ${S.profile.nickname || (S.repo.displayName && S.repo.displayName !== 'You' ? S.repo.displayName : 'there')}`), h('p', { class: 'mu' }, doneN === steps.length ? 'Daily routine complete. See you tomorrow.' : `${steps.length - doneN} step(s) left in today's 5-minute routine.`)),
      h('div', { class: 'wf-ring', style: `--p:${pct}` }, h('b', {}, `${doneN}/${steps.length}`), h('small', {}, 'today'))),
    tabs, h('div', { class: 'wf-grid' }, h('div', {}, tab === 'daily' ? daily : tab === 'weekly' ? weekly : monthly), side));
}

// ---------------------------------------------------------------- CASH PLANNER
let extraDays = 7;
export function planner(S, A) {
  const P = makePlan(S), rows = S.sum.rows, custom = forecast(rows, P.ctx, extraDays);
  const lines = [{ points: P.ontime.series, color: '#38bdf8', dash: true }, { points: P.base.series, color: '#19c37d', bold: true }, { points: P.late.series, color: '#ef5b5b' }];
  if (extraDays && extraDays !== 15) lines.push({ points: custom.series, color: '#f5b942' });
  const rowOf = (name, f, color) => h('tr', {}, h('td', {}, h('span', { class: 'dot', style: `background:${color}` }), ' ' + name), h('td', { class: 'n ' + (f.min.cash < 0 ? 'neg' : '') }, inr(f.min.cash)), h('td', {}, f.min.date), h('td', { class: 'n' }, inr(f.endCash)), h('td', {}, f.firstNegative || 'None'));
  const slider = h('input', { type: 'range', min: 0, max: 30, value: extraDays, 'aria-label': 'Extra days customers take to pay', oninput: (e) => { extraDays = +e.target.value; A.render(); } });
  const budgets = S.profile.budgets || {}, edits = {};
  const BS = P.budget;
  const budgetRows = BS.map((b) => { const inp = h('input', { type: 'number', min: 0, step: '1000', value: b.budget || '', placeholder: 'No budget', class: 'amt', 'aria-label': `${b.category} monthly budget`, disabled: !S.can('admin'), oninput: (e) => { edits[b.category] = +e.target.value || 0; } });
    return h('tr', {}, h('td', {}, b.category), h('td', { class: 'n' }, inr(b.actual)), h('td', {}, inp), h('td', { style: 'min-width:140px' }, b.budget ? h('div', {}, h('i', { class: 'bar ' + b.status }, h('u', { style: `width:${Math.min(100, b.pct)}%` })), h('small', { class: 'mu' }, `${b.pct}% used · month-end ≈ ${inr(b.projected)}`)) : h('small', { class: 'mu' }, 'Set a budget')), h('td', {}, b.status === 'over' ? chipTone({ cls: 'bad', text: 'Over' }) : b.status === 'watch' ? chipTone({ cls: 'warn', text: 'On track to exceed' }) : b.status === 'ok' ? chipTone({ cls: 'good', text: 'On track' }) : '')); });
  return h('div', { class: 'stack' },
    card('60-day cash forecast', h('p', { class: 'mu' }, 'Uses each customer\'s usual payment delay, your bills, recurring entries and GST due dates. Dashed blue = everyone pays on time; red = everyone pays 15 days late.'),
      lineChart(lines, { w: 760, h: 260 }),
      h('div', { class: 'legend' }, h('span', {}, h('span', { class: 'dot', style: 'background:#19c37d' }), ' Expected'), h('span', {}, h('span', { class: 'dot', style: 'background:#38bdf8' }), ' Everyone on time'), h('span', {}, h('span', { class: 'dot', style: 'background:#ef5b5b' }), ' 15 days late'), extraDays && extraDays !== 15 ? h('span', {}, h('span', { class: 'dot', style: 'background:#f5b942' }), ` +${extraDays} days (what-if)`) : null),
      h('label', { class: 'whatif' }, h('b', {}, `What if customers pay ${extraDays} days later?`), slider),
      h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Scenario', 'Lowest cash', 'On', 'Cash in 60 days', 'First negative'].map((t) => h('th', {}, t)))), h('tbody', {}, rowOf('Expected', P.base, '#19c37d'), rowOf('Everyone on time', P.ontime, '#38bdf8'), rowOf('15 days late', P.late, '#ef5b5b'), extraDays && extraDays !== 15 ? rowOf(`+${extraDays} days`, custom, '#f5b942') : null)))),
    h('div', { class: 'grid2' },
      card('Next money movements', ...(P.base.events.length ? P.base.events.slice(0, 10).map((e) => h('div', { class: 'up' }, h('span', { class: 'dot ' + (e.amt > 0 ? 'in' : 'out') }), h('div', {}, h('b', {}, e.label), h('small', {}, e.date)), h('em', {}, (e.amt > 0 ? '+' : '−') + inr(Math.abs(e.amt))))) : [empty('Nothing scheduled in the next 60 days.')])),
      card('Who to pay first', h('p', { class: 'mu small' }, `Available after GST reserve: ${inr(Math.max(0, S.sum.cash - P.reserve.amount))}`), ...(P.pay.length ? P.pay.slice(0, 8).map((p) => h('div', { class: 'up' }, h('div', { class: 'grow' }, h('b', {}, `${p.row.party} · ${inr(p.row.total)}`), h('small', { class: 'block' }, `due ${p.due}${p.flags.length ? ' · ' + p.flags[0] : ''}`)), h('span', { class: 'chip ' + (p.action === 'pay' ? 'good' : p.action === 'cash-short' ? 'bad' : 'info') }, p.action === 'pay' ? 'Pay now' : p.action === 'cash-short' ? 'Cash short' : 'Schedule'))) : [empty('No unpaid bills.')]))),
    card(`Budget vs actual · ${P.today.slice(0, 7)}`, h('p', { class: 'mu' }, 'Set a monthly limit per category (before GST). Bars turn amber when you are on track to exceed it.'),
      BS.length ? h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Category', 'Spent', 'Budget', 'Progress', ''].map((t, i) => h('th', { class: i === 1 ? 'n' : '' }, t)))), h('tbody', {}, ...budgetRows))) : empty('Add expenses to see categories here.'),
      S.can('admin') && BS.length ? h('div', { class: 'acts' }, h('button', { class: 'pri', onclick: () => A.saveBudgets({ ...budgets, ...edits }) }, 'Save budgets')) : null),
    card('Collections ladder', ...(P.collect.length ? P.collect.map((c) => h('div', { class: 'wf-item' }, h('div', { class: 'grow' }, h('b', {}, `${c.row.party} · ${inr(c.row.total)}`), h('small', { class: 'mu block' }, `${c.late > 0 ? c.late + ' days overdue' : 'due ' + c.row.due_date}`), h('span', { class: 'chip warn' }, c.stage.label), h('small', { class: 'mu block' }, c.stage.action)), h('div', { class: 'acts' }, S.can('write') && h('button', { onclick: () => A.remindStage(c.row.id, reminderFor(c.stage, c.row, S.profile.name, inr)) }, 'Send reminder')))) : [empty('Nothing overdue. Keep it that way.')]),
      h('p', { class: 'small mu' }, 'Stages: friendly (1–7 days), firm (8–30), personal call (31–60), then escalate (60+). Confirm formal notices with your CA or lawyer.')));
}

// ---------------------------------------------------------------- LEARN
export function learn(S, A) {
  const done = new Set(S.events.filter((e) => e.kind === 'lesson').map((e) => e.ref)), pct = Math.round((done.size / LESSONS.length) * 100);
  const open = (l) => {
    const old = document.getElementById('lesson-modal'); if (old) old.remove();
    const ans = [], overlay = h('div', { id: 'lesson-modal', class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': l.title });
    const close = () => { overlay.remove(); document.removeEventListener('keydown', esc); }; const esc = (e) => e.key === 'Escape' && close(); document.addEventListener('keydown', esc);
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    const result = h('p', { class: 'small', role: 'status' });
    const quiz = l.quiz.map((q, qi) => h('fieldset', { class: 'q' }, h('legend', {}, `${qi + 1}. ${q.q}`), ...q.o.map((o, oi) => h('label', { class: 'opt' }, h('input', { type: 'radio', name: `q${qi}`, value: oi, onchange: () => { ans[qi] = oi; } }), ' ' + o))));
    const submit = h('button', { class: 'pri', type: 'button', onclick: async () => {
      if (ans.filter((x) => x !== undefined).length < l.quiz.length) return toast('Answer all three questions', '', 'bad');
      const sc = scoreQuiz(l, ans); result.textContent = sc >= PASS ? `Score ${sc}/3. Passed!` : `Score ${sc}/3. You need ${PASS}. Review the lesson and try again.`; result.className = 'small ' + (sc >= PASS ? 'ok' : 'neg');
      if (sc >= PASS) { await A.completeLesson(l.id, sc); setTimeout(close, 1200); }
    } }, 'Check answers');
    overlay.append(h('div', { class: 'modal lesson-modal' }, h('span', { class: 'chip info' }, `${l.tag} · ${l.mins} min`), h('h2', {}, l.title), ...l.body.map((p) => h('p', {}, p)), h('div', { class: 'takeaway' }, h('b', {}, 'Takeaway: '), l.takeaway), h('h3', {}, 'Quick quiz'), ...quiz, result, h('div', { class: 'row' }, h('button', { type: 'button', onclick: close }, 'Close'), submit)));
    document.body.append(overlay);
  };
  return h('div', { class: 'stack' },
    card('Money skills', h('p', { class: 'mu' }, 'Short lessons with a quick quiz. Pass (2 of 3) to earn 25 XP and work toward the Scholar badge. Plain language, simplified; confirm tax points with your CA.'),
      h('div', { class: 'row' }, h('b', {}, `${done.size} of ${LESSONS.length} complete`), h('i', { class: 'bar grow' }, h('u', { style: `width:${pct}%` })))),
    h('div', { class: 'grid g-lessons' }, ...LESSONS.map((l) => h('article', { class: 'card lesson ' + (done.has(l.id) ? 'is-done' : '') }, h('span', { class: 'chip ' + (done.has(l.id) ? 'good' : 'info') }, done.has(l.id) ? 'Completed' : l.tag), h('h3', {}, l.title), h('p', { class: 'mu small' }, l.body[0].slice(0, 120) + '…'), h('div', { class: 'row' }, h('small', { class: 'mu' }, `${l.mins} min · 3 questions`), h('button', { class: done.has(l.id) ? '' : 'pri', onclick: () => open(l) }, done.has(l.id) ? 'Review' : 'Start'))))));
}

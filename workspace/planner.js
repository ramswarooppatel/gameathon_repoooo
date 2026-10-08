// Planning engine for the guided workflow: cash forecast + scenarios, who-to-pay-first, collection ladder, GST set-aside,
// budgets, month-end close and rule-based money tips. Pure functions (no DOM, no network). Dates are local ISO 'YYYY-MM-DD'.
import { gstFor, addDays, daysBetween, prevMonth, OUT, nextDom } from './calc.js';

const r0 = (n) => Math.round(n);
const sum = (a, f = (x) => x) => a.reduce((s, x) => s + f(x), 0);
const monthOf = (d) => d.slice(0, 7);
const R = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

// ---- customer payment behaviour (days late, from paid invoices) ---------------------------------
export function customerDelays(rows) {
  const by = new Map(), all = [];
  for (const r of rows) if (r.kind === 'sale' && r.paid_date && r.due_date) {
    const d = daysBetween(r.due_date, r.paid_date); all.push(d);
    if (!by.has(r.party)) by.set(r.party, []); by.get(r.party).push(d);
  }
  const avg = (a) => (a.length ? sum(a) / a.length : 0);
  return { overall: Math.max(0, avg(all)), samples: all.length, of: (p) => (by.has(p) ? Math.max(0, avg(by.get(p))) : null), count: (p) => (by.get(p) || []).length };
}

// ---- cash forecast ---------------------------------------------------------------------------------
// scenario: 'base' (customers pay as they usually do) | 'late' (everyone 15 days later) | 'ontime' (everyone pays on the due date) | a number of extra days
export function forecast(rows, ctx, scenario = 'base') {
  const { today, cash, horizon = 60, recurring = [], filings = [] } = ctx, delays = customerDelays(rows), ev = [];
  const extra = scenario === 'late' ? 15 : typeof scenario === 'number' ? scenario : 0;
  const push = (date, amt, label, kind) => { if (amt) ev.push({ date: date <= today ? addDays(today, date < today ? 1 : 0) : date, amt: r0(amt), label, kind }); };
  for (const r of rows.filter((x) => !x.paid_date)) {
    const due = r.due_date || addDays(r.date, 30);
    if (r.kind === 'sale') {
      let at = scenario === 'ontime' ? due : addDays(due, r0(delays.of(r.party) ?? delays.overall));
      if (scenario !== 'ontime' && at <= today) at = addDays(today, 5);              // overdue: assume a nudge lands within a week
      if (extra) at = addDays(at, extra);
      push(at, r.total, `${r.party} pays ${r.number || 'invoice'}`, 'in');
    } else if (OUT.includes(r.kind)) push(due, -r.total, `${r.party} ${r.kind === 'salary' ? 'payroll' : 'bill'} ${r.number || ''}`.trim(), 'out');
  }
  const end = addDays(today, horizon);
  for (const t of recurring.filter((x) => x.active !== false)) {                      // months not yet generated
    for (let m = monthOf(today), i = 0; i < 4; i++, m = nextMonthStr(m)) {
      const date = `${m}-${String(Math.min(t.day_of_month, 28)).padStart(2, '0')}`;
      if (date <= today || date > end || rows.some((e) => e.number === `REC-${m}` && e.party === t.party)) continue;
      const amt = t.taxable * (1 + (+t.gst_rate || 0) / 100);
      push(date, t.kind === 'sale' ? amt : -amt, `${t.party} (recurring)`, t.kind === 'sale' ? 'in' : 'out');
    }
  }
  const filed = new Set(filings.filter((f) => f.type === 'GSTR3B').map((f) => f.period));   // GST for month M is due on the 20th of M+1
  for (let d = nextDom(addDays(today, -40), 20); d <= end; d = nextDom(addDays(d, 1), 20)) {
    const period = prevMonth(monthOf(d)); if (filed.has(period)) continue;
    const net = gstFor(rows, period).net.total; if (net > 0) push(d, -net, `GST for ${period}`, 'gst');
  }
  ev.sort((a, b) => a.date.localeCompare(b.date));
  const series = []; let c = cash, min = { date: today, cash }, firstNeg = null;
  for (let i = 0; i <= horizon; i++) {
    const d = addDays(today, i); c += sum(ev.filter((e) => e.date === d), (e) => e.amt); series.push({ date: d, cash: r0(c) });
    if (c < min.cash) min = { date: d, cash: r0(c) }; if (c < 0 && !firstNeg) firstNeg = d;
  }
  return { series, min, firstNegative: firstNeg, endCash: r0(c), events: ev, scenario };
}
const nextMonthStr = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };

// ---- GST set-aside --------------------------------------------------------------------------------
export function gstReserve(rows, today, filings = []) {
  const filed = new Set(filings.filter((f) => f.type === 'GSTR3B').map((f) => f.period));
  const cur = monthOf(today), prev = prevMonth(cur), items = [];
  if (!filed.has(prev)) items.push({ period: prev, due: nextDom(today, 20) >= today ? nextDom(today, 20) : addDays(today, 0), net: gstFor(rows, prev).net.total });
  items.push({ period: cur, due: nextDom(addDays(`${cur}-28`, 5), 20), net: gstFor(rows, cur).net.total });
  return { items, amount: r0(sum(items, (i) => i.net)), nextDue: items[0].due };
}

// ---- who to pay first ------------------------------------------------------------------------------
export function payPriority(rows, cash, today, reserve = 0) {
  const open = rows.filter((r) => !r.paid_date && OUT.includes(r.kind));
  const scored = open.map((r) => {
    const due = r.due_date || addDays(r.date, 30), late = daysBetween(due, today), age = daysBetween(r.date, today);
    const flags = [];
    if (late > 0) flags.push(`${late} day(s) overdue`);
    if (r.kind === 'salary') flags.push('payroll: pay on time');
    if (r.kind === 'purchase' && age > 45) flags.push('over 45 days old: if the vendor is an MSME, s.43B(h) can disallow the deduction until paid');
    if (r.kind === 'purchase' && +r.gst_rate > 0 && !r.gstin) flags.push('no supplier GSTIN: input credit at risk');
    const rank = (r.kind === 'salary' ? 0 : 1) * 1e6 + (late > 0 ? 0 : 5e5) + Math.max(0, daysBetween(today, due)) * 100 + (age > 45 ? -50 : 0);
    return { row: r, due, late, flags, rank };
  }).sort((a, b) => a.rank - b.rank);
  let avail = cash - reserve;
  return scored.map((s) => {
    const amt = s.row.total, soon = daysBetween(today, s.due) <= 3;
    if (amt <= avail) { avail -= amt; return { ...s, action: 'pay', why: s.late > 0 ? 'Overdue and you have the cash' : soon ? 'Due soon and covered by cash after your reserve' : 'Covered by cash after your reserve' }; }
    return { ...s, action: soon || s.late > 0 ? 'cash-short' : 'defer', why: soon || s.late > 0 ? 'Due now but cash after reserve is short: chase receivables or ask for a few extra days' : 'Not due yet and cash after reserve is short: schedule it closer to the due date' };
  });
}

// ---- collections ladder ------------------------------------------------------------------------------
export const STAGES = [
  { max: 0, key: 'upcoming', label: 'Due soon', action: 'Send the invoice copy with a friendly heads-up' },
  { max: 7, key: 'friendly', label: 'Friendly reminder', action: 'Polite reminder on WhatsApp or email' },
  { max: 30, key: 'firm', label: 'Firm follow-up', action: 'Reminder plus a phone call; agree a payment date' },
  { max: 60, key: 'call', label: 'Personal call', action: 'Call the decision-maker; offer a short payment plan' },
  { max: Infinity, key: 'escalate', label: 'Escalate', action: 'Pause new credit; send a formal notice (take your CA or lawyer’s advice)' },
];
export function collectionPlan(rows, today) {
  const d = customerDelays(rows);
  return rows.filter((r) => r.kind === 'sale' && !r.paid_date && r.due_date && daysBetween(today, r.due_date) <= 3).map((r) => {
    const late = daysBetween(r.due_date, today), stage = STAGES.find((s) => late <= s.max);
    return { row: r, late: Math.max(0, late), stage, usual: d.of(r.party), score: r.total * (1 + Math.max(0, late) / 30) };
  }).sort((a, b) => b.score - a.score);
}

// ---- budgets -------------------------------------------------------------------------------------------
export function categoryOf(r) { return r.kind === 'salary' ? 'Payroll' : r.category || (r.kind === 'purchase' ? 'Purchases' : 'Other expenses'); }
export function budgetStatus(rows, budgets, month, today) {
  const act = {}; for (const r of rows.filter((x) => OUT.includes(x.kind) && x.date.startsWith(month))) act[categoryOf(r)] = (act[categoryOf(r)] || 0) + +r.taxable;
  const day = Math.max(1, +today.slice(8, 10)), dim = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate(), frac = month === monthOf(today) ? day / dim : 1;
  return [...new Set([...Object.keys(act), ...Object.keys(budgets || {})])].map((c) => {
    const actual = r0(act[c] || 0), budget = +(budgets || {})[c] || 0, projected = r0(actual / frac);
    const status = !budget ? 'none' : actual > budget ? 'over' : projected > budget ? 'watch' : 'ok';
    return { category: c, actual, budget, projected, pct: budget ? Math.round((actual / budget) * 100) : null, status };
  }).sort((a, b) => b.actual - a.actual);
}

// ---- month-end close -------------------------------------------------------------------------------------
export function monthCloseItems(S, period) {
  const f = (t) => S.filings.some((x) => x.type === t && x.period === period);
  const g = gstFor(S.sum.rows, period);
  return [
    { id: 'record', title: 'Record every invoice, bill and expense', hint: 'Anything missing makes GST and profit wrong', manual: true, go: 'transactions' },
    { id: 'collect', title: 'Chase or settle overdue invoices', hint: `${S.sum.overdueCount} overdue now`, auto: S.sum.overdueCount === 0, go: 'today' },
    { id: 'bank', title: 'Reconcile the bank statement', hint: 'Import the CSV and match payments', manual: true, go: 'transactions' },
    { id: 'itc', title: 'Fix input credit at risk', hint: g.itcAtRisk > 0 ? `${g.itcRiskRows.length} bill(s) without a valid GSTIN` : 'No issues found', auto: g.itcAtRisk === 0, go: 'compliance' },
    { id: 'gstr1', title: 'File GSTR-1', hint: `Due ${nextDom(`${period}-28`, 11) > `${period}-28` ? nextDom(`${period}-28`, 11) : ''}`.trim(), auto: f('GSTR1'), go: 'compliance' },
    { id: 'gstr3b', title: 'File GSTR-3B and pay tax', hint: `Net payable ${r0(g.net.total)}`, auto: f('GSTR3B'), go: 'compliance' },
    { id: 'payroll', title: 'Run payroll and statutory dues (PF, ESI, TDS)', hint: 'Confirm with your accountant', manual: true, go: 'transactions' },
    { id: 'pnl', title: 'Review profit & loss and aging', hint: 'Spot margins slipping early', manual: true, go: 'reports' },
    { id: 'plan', title: 'Set next month’s budget and goal', hint: 'Budgets live in Cash planner', auto: Object.keys(S.profile.budgets || {}).length > 0 && +S.profile.monthly_goal > 0, go: 'planner' },
  ];
}

// ---- rule-based money tips (each carries its reason) -------------------------------------------------------
export function tips(S, plan) {
  const out = [], s = S.sum, rows = s.rows;
  if (s.runwayMonths < 1 && rows.length) out.push({ tone: 'bad', title: 'Runway under one month', body: `Cash covers about ${s.runwayMonths} month of spending. Aim for three: collect faster, delay non-critical bills, or pause new commitments.`, why: 'Runway = cash ÷ average monthly outflow' });
  else if (s.runwayMonths < 3 && rows.length) out.push({ tone: 'warn', title: 'Build a 3-month buffer', body: `You have ${s.runwayMonths} months of runway. Saving about ${R(Math.max(0, (3 - s.runwayMonths) * (s.cash / Math.max(0.1, s.runwayMonths))))} more would reach three.`, why: 'Small firms with thin buffers are the first to miss payroll in a bad month' });
  if (plan.firstNegative) out.push({ tone: 'bad', title: `Cash goes negative on ${plan.firstNegative}`, body: 'Your own forecast shows a shortfall. Chase the top invoices, negotiate the biggest bill, or time payments after receipts.', why: 'Based on expected payment dates from each customer’s history' });
  const top = {}; for (const r of rows.filter((x) => x.kind === 'sale' && !x.paid_date)) top[r.party] = (top[r.party] || 0) + r.total;
  const tot = sum(Object.values(top)), big = Object.entries(top).sort((a, b) => b[1] - a[1])[0];
  if (big && tot > 0 && big[1] / tot > 0.5 && Object.keys(top).length > 1) out.push({ tone: 'warn', title: `${big[0]} is ${Math.round((big[1] / tot) * 100)}% of what you are owed`, body: 'One late payer can stall the business. Agree dates in writing and spread risk across customers.', why: 'Customer concentration' });
  if (s.gst.itcAtRisk > 0) out.push({ tone: 'warn', title: `${R(s.gst.itcAtRisk)} of input credit at risk`, body: 'Get a valid GSTIN and tax invoice from those suppliers before you file, so you can claim the credit.', why: 'Credit needs a valid supplier GSTIN and invoice' });
  if (plan.reserve && plan.reserve.amount > 0) out.push({ tone: 'info', title: `Set aside ${R(plan.reserve.amount)} for GST`, body: `That is your estimated tax payable for the open periods. Keep it out of day-to-day spending until you file.`, why: 'Output tax − input credit; due by the 20th' });
  const m = monthOf(S.ctx.today), prevM = prevMonth(m);
  if (prevM) {
    const a = sum(rows.filter((r) => OUT.includes(r.kind) && r.date.startsWith(m)), (r) => r.taxable), b = sum(rows.filter((r) => OUT.includes(r.kind) && r.date.startsWith(prevM)), (r) => r.taxable);
    if (b > 0 && a > b * 1.2) out.push({ tone: 'warn', title: 'Spending is up more than 20% on last month', body: `${R(a)} so far against ${R(b)} last month. Check the biggest categories in Cash planner.`, why: 'Month-over-month comparison' });
  }
  if (!out.length) out.push({ tone: 'good', title: 'You are on track', body: 'No risks found. Keep logging transactions daily and filing on time.', why: 'All checks passed' });
  return out;
}

// ---- messages -----------------------------------------------------------------------------------------------
export function reminderFor(stage, r, company, inrFmt) {
  const base = `invoice ${r.number || ''} for ${inrFmt(r.total)} (due ${r.due_date})`.replace(/\s+/g, ' ');
  const sign = company ? ` Thank you, ${company}.` : ' Thank you.';
  if (stage.key === 'upcoming') return `Hi ${r.party}, a quick heads-up that ${base} is coming up. Please confirm the payment date.${sign}`;
  if (stage.key === 'friendly') return `Hi ${r.party}, a gentle reminder that ${base} is now past due. Could you share the payment status?${sign}`;
  if (stage.key === 'firm') return `Dear ${r.party}, ${base} is overdue. Please pay today or tell us the exact date you will, so we can plan accordingly.${sign}`;
  if (stage.key === 'call') return `Dear ${r.party}, we have not received ${base}. We would like to speak today and agree a payment plan.${sign}`;
  return `Dear ${r.party}, ${base} remains unpaid after repeated reminders. Please settle it immediately; further credit is on hold until then.${sign}`;
}

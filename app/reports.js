// Management reports (pure). Rows are enriched entries (with .total, .tax) that are approved.
import { OUT, addDays, daysBetween } from '../workspace/calc.js';

const r0 = (n) => Math.round(n);

// Monthly profit & loss on an invoice-date (accrual) basis. GST is excluded from income/expense (it is a pass-through).
export function pnl(rows, months) {
  return months.map((m) => {
    const inM = rows.filter((r) => r.date.startsWith(m));
    const income = inM.filter((r) => r.kind === 'sale').reduce((s, r) => s + +r.taxable, 0);
    const byCat = {};
    for (const r of inM.filter((x) => OUT.includes(x.kind))) { const c = r.kind === 'salary' ? 'Payroll' : r.category || (r.kind === 'purchase' ? 'Purchases' : 'Other expenses'); byCat[c] = (byCat[c] || 0) + +r.taxable; }
    const spend = Object.values(byCat).reduce((a, b) => a + b, 0);
    return { month: m, income: r0(income), spend: r0(spend), net: r0(income - spend), byCat };
  });
}

const BUCKETS = [['Current', (d) => d <= 0], ['1–30 days', (d) => d <= 30], ['31–60 days', (d) => d <= 60], ['60+ days', () => true]];
// Aging of unpaid items by days past due. kind: 'in' (receivables) or 'out' (payables).
export function aging(rows, today, dir) {
  const open = rows.filter((r) => !r.paid_date && (dir === 'in' ? r.kind === 'sale' : OUT.includes(r.kind)));
  const out = BUCKETS.map(([label]) => ({ label, amount: 0, count: 0 }));
  for (const r of open) {
    const late = r.due_date ? daysBetween(r.due_date, today) : 0;
    const i = BUCKETS.findIndex(([, f]) => f(late));
    out[i].amount += r.total; out[i].count++;
  }
  return out.map((b) => ({ ...b, amount: r0(b.amount) }));
}

export function topParties(rows, dir, n = 5) {
  const m = new Map();
  for (const r of rows.filter((x) => (dir === 'in' ? x.kind === 'sale' : OUT.includes(x.kind) && x.kind !== 'salary'))) m.set(r.party, (m.get(r.party) || 0) + r.total);
  return [...m].map(([party, amount]) => ({ party, amount: r0(amount) })).sort((a, b) => b.amount - a.amount).slice(0, n);
}

export { addDays };

// Pure bookkeeping math for the finance manager. Dates are local ISO 'YYYY-MM-DD'. No DOM, no network.
import { split, validGstin, netPayable, addHeads, supplyType } from '../tax/gst.js';

const r2 = (n) => Math.round(n * 100) / 100;
const DAY = 86400000;
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
export const addDays = (d, n) => new Date(Date.parse(d) + n * DAY).toISOString().slice(0, 10);
const heads0 = () => ({ cgst: 0, sgst: 0, igst: 0 });
export const OUT = ['purchase', 'expense', 'salary']; // money-out kinds

export function enrich(e) {
  const tax = split(+e.taxable, +e.gst_rate, e.supply);
  return { ...e, tax, total: r2(+e.taxable + tax.total) };
}

// Next occurrence of a day-of-month on or after `today`.
export function nextDom(today, dom) {
  const [y, m, d] = today.split('-').map(Number);
  const t = (yy, mm) => `${yy + Math.floor((mm - 1) / 12)}-${String(((mm - 1) % 12) + 1).padStart(2, '0')}-${String(dom).padStart(2, '0')}`;
  return d <= dom ? t(y, m) : t(y, m + 1);
}

export const prevMonth = (ym, n = 1) => { let [y, m] = ym.split('-').map(Number); m -= n; while (m < 1) { m += 12; y--; } return `${y}-${String(m).padStart(2, '0')}`; };
// GSTR-1 due 11th, GSTR-3B due 20th of the month after the period.
export const filingDue = (type, period) => { const [y, m] = period.split('-').map(Number); const nm = m === 12 ? 1 : m + 1, ny = m === 12 ? y + 1 : y; return `${ny}-${String(nm).padStart(2, '0')}-${type === 'GSTR1' ? '11' : '20'}`; };

export function guessSupply(ownGstin, partyGstin) {
  return validGstin(ownGstin) && validGstin(partyGstin) ? supplyType(ownGstin, partyGstin) : 'intra';
}

// GST position for one month (by invoice date).
export function gstFor(rows, month) {
  const out = rows.filter((r) => r.kind === 'sale' && r.date.startsWith(month)).reduce((h, r) => addHeads(h, r.tax), heads0());
  const inRows = rows.filter((r) => OUT.includes(r.kind) && +r.gst_rate > 0 && r.date.startsWith(month));
  const itc = inRows.filter((r) => validGstin(r.gstin)).reduce((h, r) => addHeads(h, r.tax), heads0());
  const atRisk = r2(inRows.filter((r) => !validGstin(r.gstin)).reduce((s, r) => s + r.tax.total, 0));
  return { output: out, itc, net: netPayable(out, itc), itcAtRisk: atRisk, itcRiskRows: inRows.filter((r) => !validGstin(r.gstin)) };
}

export function summarize(entries, profile, today, month = today.slice(0, 7)) {
  const rows = entries.map(enrich);
  const sales = rows.filter((r) => r.kind === 'sale'), outs = rows.filter((r) => OUT.includes(r.kind));
  const sum = (a) => r2(a.reduce((s, r) => s + r.total, 0));
  const gst = gstFor(rows, month);

  const cash = r2((+profile.opening_balance || 0) + sum(sales.filter((r) => r.paid_date)) - sum(outs.filter((r) => r.paid_date)));
  const recvOpen = sales.filter((r) => !r.paid_date), payOpen = outs.filter((r) => !r.paid_date);
  const overdue = recvOpen.filter((r) => r.due_date && r.due_date < today);
  const dueSoon = payOpen.filter((r) => r.due_date && daysBetween(today, r.due_date) <= 7);
  const receivable = sum(recvOpen), payable = sum(payOpen), overdueAmt = sum(overdue);

  const alerts = [], add = (sev, type, text, id) => alerts.push({ sev, type, text, id });
  if (cash < 0) add('high', 'cash', `Cash balance is negative (₹${Math.round(cash)}). Collect receivables or defer payables.`);
  for (const r of overdue) add('high', 'overdue', `Invoice ${r.number || ''} from ${r.party} is ${daysBetween(r.due_date, today)} days overdue (₹${Math.round(r.total)}). Send a reminder.`, r.id);
  for (const r of dueSoon) add(r.due_date < today ? 'high' : 'med', 'payable', `${r.due_date < today ? 'Overdue: pay' : 'Pay'} ${r.party} ₹${Math.round(r.total)} by ${r.due_date}.`, r.id);
  if (gst.itcAtRisk > 0) add('med', 'itc', `₹${Math.round(gst.itcAtRisk)} input tax credit at risk: ${gst.itcRiskRows.length} bill(s) with missing/invalid supplier GSTIN.`);
  const seen = new Set();
  for (const r of rows) { const k = `${r.kind}|${r.party.toLowerCase()}|${r.number}`; if (r.number && seen.has(k)) add('med', 'dup', `Possible duplicate invoice ${r.number} for ${r.party}.`, r.id); seen.add(k); }
  const spend = outs.filter((r) => r.kind === 'purchase').map((r) => r.total), mean = spend.reduce((a, b) => a + b, 0) / (spend.length || 1);
  for (const r of outs) if (r.kind === 'purchase' && spend.length >= 4 && r.total > mean * 3 && !r.paid_date) add('med', 'large', `Unusually large unpaid bill from ${r.party} (₹${Math.round(r.total)}). Verify before paying.`, r.id);

  const burn = Math.max(1, sum(outs.filter((r) => r.date >= addDays(today, -90))) / 3);
  const runwayMonths = r2(Math.max(0, cash) / burn);
  const overdueShare = receivable ? overdueAmt / receivable : 0;
  const allItc = rows.filter((r) => OUT.includes(r.kind) && +r.gst_rate > 0 && r.date.startsWith(month)).reduce((s, r) => s + r.tax.total, 0);
  const itcShare = allItc ? gst.itcAtRisk / allItc : 0;
  const health = Math.round(100 * (0.4 * Math.min(runwayMonths / 3, 1) + 0.35 * (1 - overdueShare) + 0.25 * (1 - itcShare)));
  alerts.sort((a, b) => ({ high: 0, med: 1 }[a.sev] - { high: 0, med: 1 }[b.sev]));

  const monthly = [];
  for (let i = 5; i >= 0; i--) {
    const m = prevMonth(today.slice(0, 7), i);
    monthly.push({ m, income: r2(sum(sales.filter((r) => r.date.startsWith(m)))), spend: r2(sum(outs.filter((r) => r.date.startsWith(m)))) });
  }
  const upcoming = [...recvOpen.map((r) => ({ ...r, dir: 'in' })), ...payOpen.map((r) => ({ ...r, dir: 'out' }))]
    .filter((r) => r.due_date && daysBetween(today, r.due_date) <= 14).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const in30 = sum(recvOpen.filter((r) => r.due_date && daysBetween(today, r.due_date) <= 30)), out30 = sum(payOpen.filter((r) => r.due_date && daysBetween(today, r.due_date) <= 30));
  return { rows, cash, receivable, payable, overdueAmt, gst, alerts, runwayMonths, health, monthly, upcoming, in30, out30, collectedMonth: sum(sales.filter((r) => r.paid_date && r.paid_date.startsWith(today.slice(0, 7)))), paidSales: sales.filter((r) => r.paid_date).length, overdueCount: overdue.length };
}

export function toCsv(rows) {
  const cols = ['kind', 'number', 'party', 'gstin', 'category', 'date', 'due_date', 'taxable', 'gst_rate', 'supply', 'cgst', 'sgst', 'igst', 'total', 'paid_date'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map((r) => cols.map((c) => q(['cgst', 'sgst', 'igst'].includes(c) ? r.tax[c] : r[c])).join(','))].join('\n');
}

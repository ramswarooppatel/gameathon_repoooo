// Pure bookkeeping math for the real-business workspace. Dates are ISO 'YYYY-MM-DD'. No DOM, no network.
import { split, validGstin, netPayable, addHeads, supplyType } from '../tax/gst.js';

const r2 = (n) => Math.round(n * 100) / 100;
const DAY = 86400000;
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
export const addDays = (d, n) => new Date(Date.parse(d) + n * DAY).toISOString().slice(0, 10);
const heads0 = () => ({ cgst: 0, sgst: 0, igst: 0 });

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

export function guessSupply(ownGstin, partyGstin) {
  return validGstin(ownGstin) && validGstin(partyGstin) ? supplyType(ownGstin, partyGstin) : 'intra';
}

export function summarize(entries, profile, today) {
  const rows = entries.map(enrich), month = today.slice(0, 7);
  const sales = rows.filter((r) => r.kind === 'sale'), buys = rows.filter((r) => r.kind === 'purchase');
  const sum = (a) => r2(a.reduce((s, r) => s + r.total, 0));

  const outHeads = sales.filter((r) => r.date.startsWith(month)).reduce((h, r) => addHeads(h, r.tax), heads0());
  const itcRows = buys.filter((r) => r.date.startsWith(month));
  const itcOk = itcRows.filter((r) => validGstin(r.gstin));
  const itcHeads = itcOk.reduce((h, r) => addHeads(h, r.tax), heads0());
  const itcAtRisk = r2(itcRows.filter((r) => !validGstin(r.gstin)).reduce((s, r) => s + r.tax.total, 0));
  const gst = { output: outHeads, itc: itcHeads, net: netPayable(outHeads, itcHeads), itcAtRisk };

  const cash = r2((+profile.opening_balance || 0) + sum(sales.filter((r) => r.paid_date)) - sum(buys.filter((r) => r.paid_date)));
  const recvOpen = sales.filter((r) => !r.paid_date), payOpen = buys.filter((r) => !r.paid_date);
  const overdue = recvOpen.filter((r) => r.due_date && r.due_date < today);
  const dueSoon = payOpen.filter((r) => r.due_date && daysBetween(today, r.due_date) <= 7);
  const receivable = sum(recvOpen), payable = sum(payOpen), overdueAmt = sum(overdue);

  const gstr1 = nextDom(today, 11), gstr3b = nextDom(today, 20);
  const alerts = [];
  const add = (sev, text) => alerts.push({ sev, text });
  if (cash < 0) add('high', `Cash balance is negative (₹${cash}). Collect receivables or defer payables.`);
  for (const r of overdue) add('high', `Invoice ${r.number || ''} from ${r.party} is ${daysBetween(r.due_date, today)} days overdue (₹${r.total}). Send a reminder.`);
  for (const r of dueSoon) add(r.due_date < today ? 'high' : 'med', `Pay ${r.party} ₹${r.total} by ${r.due_date}.`);
  if (daysBetween(today, gstr3b) <= 5 && gst.net.total > 0) add('high', `GSTR-3B due ${gstr3b}: ₹${gst.net.total} payable${cash < gst.net.total ? ' (cash is short)' : ''}.`);
  if (daysBetween(today, gstr1) <= 3) add('med', `GSTR-1 due ${gstr1}.`);
  if (itcAtRisk > 0) add('med', `₹${itcAtRisk} input tax credit at risk: purchase(s) with missing/invalid supplier GSTIN.`);
  const seen = new Set();
  for (const r of rows) { const k = `${r.kind}|${r.party.toLowerCase()}|${r.number}`; if (r.number && seen.has(k)) add('med', `Possible duplicate invoice ${r.number} for ${r.party}.`); seen.add(k); }
  const buyAmts = buys.map((r) => r.total), mean = buyAmts.reduce((a, b) => a + b, 0) / (buyAmts.length || 1);
  for (const r of buys) if (buyAmts.length >= 4 && r.total > mean * 3 && !r.paid_date) add('med', `Unusually large unpaid bill from ${r.party} (₹${r.total}). Verify before paying.`);

  const burn = Math.max(1, sum(buys.filter((r) => r.date >= addDays(today, -90))) / 3);
  const runwayMonths = r2(Math.max(0, cash) / burn);
  const overdueShare = receivable ? overdueAmt / receivable : 0;
  const itcShare = itcRows.length ? itcAtRisk / Math.max(1, itcRows.reduce((s, r) => s + r.tax.total, 0)) : 0;
  const health = Math.round(100 * (0.4 * Math.min(runwayMonths / 3, 1) + 0.35 * (1 - overdueShare) + 0.25 * (1 - itcShare)));
  alerts.sort((a, b) => ({ high: 0, med: 1 }[a.sev] - { high: 0, med: 1 }[b.sev]));
  return { rows, cash, receivable, payable, overdueAmt, gst, gstr1, gstr3b, alerts, runwayMonths, health };
}

export function toCsv(rows) {
  const cols = ['kind', 'number', 'party', 'gstin', 'date', 'due_date', 'taxable', 'gst_rate', 'supply', 'cgst', 'sgst', 'igst', 'total', 'paid_date'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map((r) => cols.map((c) => q(['cgst', 'sgst', 'igst'].includes(c) ? r.tax[c] : r[c])).join(','))].join('\n');
}

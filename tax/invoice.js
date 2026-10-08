// Pure invoice maths: totals per GST rate, HSN summary, amount in words, FY numbering. No DOM, no network.
import { split, supplyType, validGstin } from './gst.js';
const r2 = (n) => Math.round(n * 100) / 100;

// Indian financial year (Apr-Mar): '2026-10-09' -> '26-27'.
export function fy(date) { const y = +date.slice(0, 4), m = +date.slice(5, 7), a = m >= 4 ? y : y - 1; return `${String(a).slice(2)}-${String(a + 1).slice(2)}`; }
// Next number in the series PREFIX/FY/0001. Max 16 chars (GST rule 46), so the prefix is trimmed to 5.
export function nextNumber(existing, date, prefix = 'INV') {
  const pre = `${prefix.replace(/[^A-Za-z0-9]/g, '').slice(0, 5) || 'INV'}/${fy(date)}/`;
  const used = existing.filter((n) => n?.startsWith(pre)).map((n) => parseInt(n.slice(pre.length), 10)).filter(Number.isFinite);
  return pre + String((used.length ? Math.max(...used) : 0) + 1).padStart(4, '0');
}
export const validNumber = (n) => /^[A-Za-z0-9/-]{1,16}$/.test(n || '');

// Intra vs inter-state: seller's state (from GSTIN) vs place of supply (2-digit state code). Unknown => intra.
export const supplyFor = (sellerGstin, posState) => (validGstin(sellerGstin) && posState ? supplyType(sellerGstin, posState) : 'intra');

// items: [{desc,hsn,qty,unit,rate,disc,gst}]. bos = bill of supply (no tax charged).
export function calcInvoice(items, { supply = 'intra', bos = false } = {}) {
  const lines = items.map((it) => {
    const gross = r2((+it.qty || 0) * (+it.rate || 0)), disc = r2((gross * (+it.disc || 0)) / 100);
    return { ...it, gst: bos ? 0 : +it.gst || 0, gross, taxable: r2(gross - disc) };
  });
  const group = (keyOf) => {
    const m = new Map();
    for (const l of lines) { const k = keyOf(l), g = m.get(k) || { taxable: 0, gst: l.gst, hsn: l.hsn || '' }; g.taxable = r2(g.taxable + l.taxable); m.set(k, g); }
    return [...m.values()];
  };
  const withTax = (g) => ({ ...g, ...split(g.taxable, g.gst, supply) });
  const byRate = group((l) => l.gst).map(withTax), hsn = group((l) => `${l.hsn}|${l.gst}`).map(withTax);
  const sum = (a, k) => r2(a.reduce((s, x) => s + x[k], 0));
  const taxable = sum(lines, 'taxable'), cgst = sum(byRate, 'cgst'), sgst = sum(byRate, 'sgst'), igst = sum(byRate, 'igst');
  const grand = r2(taxable + cgst + sgst + igst), payable = Math.round(grand);
  return { lines, byRate, hsn, taxable, cgst, sgst, igst, tax: r2(cgst + sgst + igst), grand, roundOff: r2(payable - grand), payable };
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const below100 = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));
const below1000 = (n) => (n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : '') + (n % 100 ? below100(n % 100) : '');
const words = (n) => {                        // lakh/crore system; crores recurse so 100+ crore works
  const out = [];
  for (const [v, name] of [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand']]) { const q = Math.floor(n / v); if (q) { out.push((v === 10000000 ? words(q) : below100(q)) + ' ' + name); n %= v; } }
  if (n) out.push(below1000(n));
  return out.join(' ');
};
// 125000.5 -> "Rupees One Lakh Twenty Five Thousand and Fifty Paise Only"
export function inWords(amount) {
  const a = Math.abs(amount), rupees = Math.floor(a), paise = Math.round((a - rupees) * 100);
  return 'Rupees ' + (words(rupees) || 'Zero') + (paise ? ' and ' + below100(paise) + ' Paise' : '') + ' Only';
}

// ---- invoice files: exchange between organisations (also used by the shared-invoice inbox) ----
const SLABS = [0, 5, 12, 18, 28, 40], FORMAT = 'myf-invoice/1';
export const exportInvoice = (inv) => JSON.stringify({ format: FORMAT, exported_at: new Date().toISOString(), invoice: { id: inv.id, number: inv.number, doc_type: inv.doc_type, date: inv.date, due_date: inv.due_date, seller: inv.seller, buyer: inv.buyer, supply: inv.supply, pos_state: inv.pos_state, reverse_charge: inv.reverse_charge, items: inv.items, claimed_total: inv.totals.grand, notes: inv.notes } }, null, 2);
// Never trust a received file: validate the shape, then recompute every figure from the line items.
export function parseShared(text) {
  let j; try { j = JSON.parse(text); } catch { return { error: 'This is not a valid JSON file.' }; }
  const i = j?.invoice; if (j?.format !== FORMAT || !i) return { error: 'This file is not a Mind Your Funds invoice.' };
  const str = (x, n = 200) => typeof x === 'string' && x.length <= n;
  if (!str(i.id, 64) || !i.id || !validNumber(i.number) || !/^\d{4}-\d{2}-\d{2}$/.test(i.date) || !['tax', 'bos'].includes(i.doc_type) || !['intra', 'inter'].includes(i.supply)) return { error: 'Invoice header is incomplete.' };
  if (i.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(i.due_date)) return { error: 'Due date is invalid.' };
  if (!i.seller || !str(i.seller.name) || !i.seller.name || (i.seller.gstin && !str(i.seller.gstin, 15))) return { error: 'Seller details are missing.' };
  if (!Array.isArray(i.items) || !i.items.length || i.items.length > 200) return { error: 'The invoice has no lines, or too many.' };
  const items = [];
  for (const x of i.items) {
    if (!str(x?.desc, 300) || !(+x.qty > 0) || !(+x.rate >= 0) || !SLABS.includes(+x.gst) || !(+x.disc >= 0 && +x.disc <= 100)) return { error: 'A line item is invalid.' };
    items.push({ desc: x.desc, hsn: str(x.hsn, 8) ? x.hsn : '', qty: +x.qty, unit: str(x.unit, 5) ? x.unit : 'OTH', rate: +x.rate, disc: +x.disc || 0, gst: +x.gst });
  }
  const totals = calcInvoice(items, { supply: i.supply, bos: i.doc_type === 'bos' });
  const clean = (o = {}) => Object.fromEntries(['name', 'gstin', 'address', 'city', 'pincode', 'email', 'phone'].map((k) => [k, str(o[k]) ? o[k] : '']));
  return { doc: { id: i.id, number: i.number, doc_type: i.doc_type, date: i.date, due_date: i.due_date || null, seller: clean(i.seller), buyer: clean(i.buyer), supply: i.supply, pos_state: str(i.pos_state, 2) ? i.pos_state : null, reverse_charge: !!i.reverse_charge, items, totals, notes: str(i.notes, 2000) ? i.notes : null, mismatch: Math.abs(totals.grand - (+i.claimed_total || totals.grand)) > 1 ? +i.claimed_total : 0 } };
}

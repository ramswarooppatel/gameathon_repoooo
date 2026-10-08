import { CFG, CLIENTS, OWN_GSTIN } from './state.js';
import { split, supplyType, addHeads, makeGstin } from '../tax/gst.js';

// Scripted surprise waves (deterministic drama); amounts vary with the seed.
export const SCRIPT = { 10: 'late_pay', 17: 'big_expense', 24: 'fraud', 33: 'opportunity', 40: 'late_pay', 47: 'big_expense', 55: 'fraud', 62: 'opportunity', 70: 'late_pay', 78: 'fraud' };

export function issueInvoice(g) {
  const { s, rng: r } = g;
  const c = CLIENTS[Math.floor(r() * CLIENTS.length)];
  const taxable = Math.round(20000 + r() * 30000);
  const supply = supplyType(OWN_GSTIN, c.gstin);
  const tax = split(taxable, CFG.rate, supply);
  const delay = c.delay + Math.floor(r() * 3);
  const inv = { id: `INV${g.n.inv++}`, client: c.name, gstin: c.gstin, taxable, gstRate: CFG.rate, supply, amt: taxable + tax.total, dueDay: s.day + 15, payDay: s.day + 15 + delay, lateRisk: c.delay / 7, paid: false };
  s.receivables.push(inv);
  s.gst.output = addHeads(s.gst.output, tax);
}

// Mutates state for the event and returns it (or null if nothing to do).
export function applyEvent(g, type) {
  const { s, rng: r } = g, id = `e${g.n.ev++}`, a = r(), b = r(); // fixed rng draws => ghost stays in sync
  if (type === 'late_pay') {
    const inv = s.receivables.filter((i) => !i.paid && i.payDay > s.day).sort((x, y) => y.amt - x.amt)[0];
    if (!inv) return null;
    const extraDays = 18;
    inv.payDay += extraDays;
    return { id, day: s.day, type, severity: 2, payload: { invoiceId: inv.id, extraDays } };
  }
  if (type === 'big_expense') {
    const taxable = Math.round(45000 + a * 30000), tax = split(taxable, CFG.rate, 'intra');
    const bill = { id: `B${g.n.bill++}`, vendor: 'Apex Machinery', gstin: makeGstin('27', 'AAECA5566M'), taxable, amt: taxable + tax.total, dueDay: s.day + 5, paid: false, itcEligible: true };
    s.payables.push(bill);
    s.gst.itc = addHeads(s.gst.itc, tax);
    return { id, day: s.day, type, severity: 2, payload: { billId: bill.id } };
  }
  if (type === 'fraud') {
    const bad = makeGstin('29', 'AAGCQ1190B'), amt = 20000 + Math.floor(a * 3) * 5000;
    const bill = { id: `B${g.n.bill++}`, vendor: 'Apex Machinery Ltd', gstin: bad.slice(0, 14) + (bad[14] === 'A' ? 'B' : 'A'), taxable: amt, amt, dueDay: s.day + 2, paid: false, fake: true, bankChanged: true };
    s.payables.push(bill);
    return { id, day: s.day, type, severity: 3, payload: { billId: bill.id } };
  }
  if (type === 'opportunity') {
    const cost = 30000 + Math.floor(b * 3) * 5000;
    return { id, day: s.day, type, severity: 1, payload: { cost, payout: Math.round(cost * 1.7), payDay: s.day + 20 } };
  }
  return null;
}

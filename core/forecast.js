import { CFG } from './state.js';
import { netPayable } from '../tax/gst.js';

// Agents only "know" due dates + client history, not the hidden payDay.
export const expectedPayDay = (inv) => inv.dueDay + Math.round(inv.lateRisk * 7);

export function projectCash(s, toDay) {
  let c = s.cash;
  for (const i of s.receivables) if (!i.paid && expectedPayDay(i) <= toDay) c += i.amt;
  for (const x of s.inflows) if (x.day <= toDay) c += x.amt;
  for (const b of s.payables) if (!b.paid && !b.blocked && b.dueDay <= toDay) c -= b.amt;
  for (let d = s.payroll.nextDay; d <= toDay; d += 30) c -= s.payroll.amt;
  if (s.gst.nextDue <= toDay) c -= netPayable(s.gst.output, s.gst.itc).total;
  return Math.round(c + (CFG.sales - CFG.opex) * Math.max(0, toDay - s.day));
}

export const dailyBurn = (s) => CFG.opex + s.payroll.amt / 30;

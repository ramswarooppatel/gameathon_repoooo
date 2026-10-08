// Practice Lab coach: turns a decision card into a short story (what, why it matters), explains the recommendation, and after a decision
// shows its real consequence from engine state, then points at the EXISTING lesson. No lesson text, XP or state lives here.
import { LESSONS } from '../app/lessons.js';
import { projectCash } from '../core/forecast.js';
import { computeHealth } from '../core/health.js';
import { inr } from '../agents/card.js';

export const SKILL = { collector: 'Receivables and payment timing', treasurer: 'Runway and cash buffer', sentinel: 'Fraud and vendor checks', scout: 'Margin and affordability' };
const LESSON_FOR = { late_payment: 'cash-vs-profit', cash_gap_payroll: 'runway', cash_gap_gst: 'gst-basics', big_bill: 'itc', fraud: 'fraud', opportunity: 'margin' };
export const lessonFor = (c) => LESSONS.find((l) => l.id === LESSON_FOR[c.topic]) || null;

// ---- before the decision: what is happening, why it matters, why the first option is recommended -------------------
export function story(c) {
  const f = c.facts || {};
  switch (c.topic) {
    case 'late_payment': return { happening: `${f.client} is now expected to pay invoice ${f.invoiceId} (${inr(f.amt)}) on day ${f.payDay}, ${f.extraDays} days later than usual.`, matters: `A sale is not cash until it is collected. Late money shrinks what you have for payroll (day ${f.payrollDay}), GST (day ${f.gstDay}) and bills, even while the business looks profitable.` };
    case 'big_bill': return { happening: `${f.vendor} sent a bill of ${inr(f.amt)} due on day ${f.dueDay}. Projected cash on that day: ${inr(f.proj)}.`, matters: `A large bill paid from thin cash can leave nothing for payroll (day ${f.payrollDay}) or GST (day ${f.gstDay}). It also carries ${inr(f.itc)} of input tax credit, which lowers your GST bill if the invoice is valid.` };
    case 'cash_gap_gst': return { happening: `Cash is projected at ${inr(f.proj)} on day ${f.day}, when your GSTR-3B payment of ${inr(f.gstDue)} is due.`, matters: 'Paying GST late costs 18% a year in interest plus a penalty. Cash timing, not profit, decides whether you can pay.' };
    case 'cash_gap_payroll': return { happening: `Cash is projected at ${inr(f.proj)} on day ${f.day}, when payroll is due.`, matters: 'Payroll cannot wait. Late salaries damage trust and can cost you your team, however good the quarter looks on paper.' };
    case 'fraud': return { happening: `${f.vendor} sent a bill for ${inr(f.amt)} due on day ${f.dueDay}. Red flags: ${(f.flags || []).join('; ').toLowerCase()}.`, matters: 'Money paid to a fake bill is almost never recovered. Fraudsters copy real vendors and change the bank details.' };
    case 'opportunity': return { happening: `A bulk order needs ${inr(f.cost)} now and pays ${inr(f.payout)} on day ${f.payDay}, a ${Math.round(((f.payout - f.cost) / f.cost) * 100)}% margin.`, matters: `You spend first and are paid ${f.payDay - f.day} days later. After the spend your cash would be about ${inr(f.after)} (12-day view), so the question is affordability, not only margin.` };
    default: return null;
  }
}

// Why options[0] is recommended, from the numbers on the card. Honest when the alternative is also fine.
export function recommendWhy(c) {
  const f = c.facts || {}, rec = c.options[0], other = c.options.slice(1).filter((o) => o.costInr > 0).sort((a, b) => a.costInr - b.costInr)[0];
  switch (c.topic) {
    case 'late_payment': return `Brings the payment forward at no cost${other ? `, without giving away ${inr(other.costInr)} (2%) of the invoice` : ''}.`;
    case 'big_bill': return f.tight ? `Cash would be only ${inr(f.proj)} on the due date. A 10-day delay costs ${inr(rec.costInr)} (2%) but protects payroll and GST.` : `Projected cash on the due date is ${inr(f.proj)}, enough to pay without straining payroll or GST. A delay would cost ${inr(f.fee)} (2%) for no need.`;
    case 'cash_gap_gst': case 'cash_gap_payroll': return rec.effect.type === 'chase' ? `Chasing ${f.topClient} (${inr(f.topAmt)}) pulls the money in within 3 days and costs nothing.` : `Delaying ${f.billVendor} 10 days frees cash before day ${f.day} for a 2% fee.`;
    case 'fraud': return `Costs nothing, and a call to a number you already hold settles it. Paying anyway risks losing ${inr(f.amt)}.`;
    case 'opportunity': return f.ok ? `Cash would still be ${inr(f.after)} after the spend, above the ₹25,000 safety line, so the margin is worth taking.` : `Cash would drop to ${inr(f.after)}, below the ₹25,000 safety line. Margin means little if payroll or GST goes unpaid.`;
    default: return null;
  }
}

// ---- around the decision: real before/after from the engine ------------------------------------------------------
const copy = (o) => (o ? { ...o } : null);
export function snapshot(g, c) {
  const f = c.facts || {}, s = g.s;
  return { health: s.health, cash: s.cash, runway: s.runwayDays, blocked: s.stats.fraudBlocked, proj14: projectCash(s, s.day + 14),
    inv: copy(s.receivables.find((i) => i.id === f.invoiceId)), bill: copy(s.payables.find((b) => b.id === f.billId)) };
}
const day = (n) => `day ${n}`;
export function impact(g, c, option, before) {
  const f = c.facts || {}, s = g.s, e = option.effect, lines = [];
  computeHealth(s);                                                  // same pure function the engine runs every day, so health shows now, not tomorrow
  const inv = s.receivables.find((i) => i.id === f.invoiceId), bill = s.payables.find((b) => b.id === f.billId);
  switch (e.type) {
    case 'reminder': case 'chase': if (inv && before.inv) lines.push(`${inr(inv.amt)} from ${inv.client} now expected on ${day(inv.payDay)}, ${Math.max(0, before.inv.payDay - inv.payDay)} days earlier (was ${day(before.inv.payDay)}).`); break;
    case 'discount': if (inv && before.inv) { lines.push(`${inr(inv.amt)} now expected on ${day(inv.payDay)} instead of ${day(before.inv.payDay)}.`); lines.push(`You gave up ${inr(before.inv.amt - inv.amt)} (2%) to get paid sooner.`); } break;
    case 'delayBill': if (bill && before.bill) { lines.push(`${bill.vendor} bill now due ${day(bill.dueDay)} instead of ${day(before.bill.dueDay)}.`); lines.push(`It costs ${inr(bill.amt - before.bill.amt)} more (2% fee).`); } break;
    case 'block': lines.push(`${inr(s.stats.fraudBlocked - before.blocked)} fraudulent payment blocked.`); lines.push('Potential loss avoided.'); break;
    case 'accept': lines.push(`${inr(e.cost)} spent now. ${inr(e.payout)} arrives on ${day(e.payDay)}, a profit of ${inr(e.payout - e.cost)}.`); lines.push(`Cash is now ${inr(s.cash)}.`); break;
    default:
      if (c.topic === 'fraud' && bill) lines.push(`${inr(bill.amt)} will leave your account on ${day(bill.dueDay)}. The bill was fraudulent: that money is lost.`);
      else if (c.topic === 'late_payment' && inv) lines.push(`${inr(inv.amt)} stays expected on ${day(inv.payDay)}, ${f.extraDays} days late.`);
      else if (c.topic === 'opportunity') lines.push(`You kept ${inr(s.cash)} in cash and skipped ${inr(f.payout - f.cost)} of profit.`);
      else if (c.topic === 'big_bill' && bill) lines.push(`${inr(bill.amt)} will be paid on ${day(bill.dueDay)} with about ${inr(f.proj)} projected cash.`);
      else lines.push('Nothing changes. The cash gap stays open.');
  }
  const dh = s.health - before.health;
  lines.push(dh ? `Business health ${dh > 0 ? '+' : ''}${dh} (now ${s.health}).` : `Business health unchanged for now (${s.health}). It moves as invoices are paid and bills fall due.`);
  return { lines, good: option === c.options[0] || dh > 0, learned: lessonFor(c)?.takeaway || null, lesson: lessonFor(c) };
}
// When the owner did not answer in time (or a specialist acted alone within the cap), there is no before snapshot, so only the facts are shown.
export function impactWithoutSnapshot(c, option, by) {
  const f = c.facts || {};
  const lead = by === 'timeout' ? `No decision in time, so the default happened: ${option.label}.` : `${c.agent[0].toUpperCase() + c.agent.slice(1)} acted alone within your cap: ${option.label}.`;
  const lines = [lead];
  if (by === 'timeout' && c.topic === 'fraud') lines.push(`${inr(f.amt)} will go to a flagged vendor on day ${f.dueDay}.`);
  return { lines, good: by !== 'timeout', learned: lessonFor(c)?.takeaway || null, lesson: lessonFor(c) };
}

// Styles live here so the coach works without touching style.css (uses the lab's own tokens).
export function injectStyles() {
  if (document.getElementById('coach-css')) return;
  document.head.append(Object.assign(document.createElement('style'), { id: 'coach-css', textContent: `
.story{margin:10px 0 4px;display:grid;gap:8px}.story h5,.rec-why h5,.impact h5{margin:0 0 2px;font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--mu)}
.story p,.rec-why p{margin:0;font-size:13px;line-height:1.45}.skill{display:block;font-size:11px;color:var(--mu);margin:-2px 0 6px}
.rec-why{margin:10px 0 8px;padding:8px 10px;border-radius:var(--r-md);background:var(--acc-glow,rgba(25,195,125,.12))}.rec-why p b{color:var(--acc2)}
.nothing{margin:8px 0 0;font-size:12px;color:var(--mu)}
.impact{margin:0 0 12px;padding:12px 14px;border:1px solid var(--line);border-left:3px solid var(--acc);border-radius:var(--r-lg);background:var(--card)}.impact.warn{border-left-color:var(--warn)}
.impact ul{list-style:none;margin:6px 0;padding:0;display:grid;gap:4px;font-size:13px}.impact li{display:flex;gap:8px;align-items:flex-start}.impact li .ico{color:var(--acc2);flex:none;margin-top:2px}
.impact .learned{margin:8px 0 0;font-size:13px}.impact .learned b{display:block;font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--mu);font-weight:600}
.impact .more{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid var(--line-subtle,var(--line))}.impact .more small{color:var(--mu)}
.impact a.btn{display:inline-block;padding:7px 14px;border:1px solid var(--acc);border-radius:99px;color:var(--acc2);text-decoration:none;font-size:13px;font-weight:600}.impact a.btn:hover{background:var(--acc-glow,rgba(25,195,125,.12))}
.compare{display:grid;gap:10px;margin:10px 0}.compare .vs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.compare .side{padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-md)}.compare .side.you{border-color:var(--acc)}
.compare .side b.big{display:block;font-size:26px}.compare .side small{display:block;color:var(--mu)}.compare .tag{font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--mu)}.compare .verdict{margin:0;font-weight:600}
` }));
}

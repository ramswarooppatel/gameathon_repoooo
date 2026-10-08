import { makeCard, opt, inr } from './card.js';
import { projectCash } from '../core/forecast.js';
import { netPayable } from '../tax/gst.js';

export function treasurer(g, events) {
  const s = g.s, cards = [];
  for (const e of events.filter((x) => x.type === 'big_expense')) {
    const b = s.payables.find((p) => p.id === e.payload.billId);
    const proj = projectCash(s, b.dueDay), tight = proj < 20000;                      // same pressure line as the 'Pay on due date' risk below
    const negotiate = opt('Negotiate +10 days (2% fee)', b.amt * 0.02, { type: 'delayBill', billId: b.id });
    const pay = opt('Pay on due date', 0, { type: 'none' }, tight ? 'high' : 'low');
    const options = tight ? [negotiate, pay] : [pay, negotiate];                       // options[0] = the recommendation for THIS situation
    cards.push(makeCard(g, {
      agent: 'treasurer', eventId: e.id, topic: 'big_bill',
      facts: { billId: b.id, vendor: b.vendor, amt: b.amt, dueDay: b.dueDay, itc: b.amt - b.taxable, proj, tight, fee: negotiate.costInr, payrollDay: s.payroll.nextDay, gstDay: s.gst.nextDue },
      title: `Big bill ${inr(b.amt)} from ${b.vendor} due day ${b.dueDay}`,
      why: [`ITC available ${inr(b.amt - b.taxable)}`, `Projected cash at due date ${inr(proj)}`],
      options, defaultOption: options.indexOf(pay),                                    // unanswered = pay on the due date, exactly as before
    }));
  }
  const gstDue = netPayable(s.gst.output, s.gst.itc).total;
  for (const d of [{ n: 'GSTR-3B payment', day: s.gst.nextDue }, { n: 'Payroll', day: s.payroll.nextDay }]) {
    const left = d.day - s.day, key = `t${d.n}${d.day}`;
    if (left < 0 || left > 3 || g.flags[key]) continue;
    const proj = projectCash(s, d.day);
    if (proj >= 20000) continue;
    g.flags[key] = 1;
    const inv = s.receivables.filter((i) => !i.paid).sort((a, b) => b.amt - a.amt)[0];
    const bill = s.payables.filter((p) => !p.paid && p.dueDay > s.day && !p.fake).sort((a, b) => a.dueDay - b.dueDay)[0];
    const options = [];
    if (inv) options.push(opt(`Chase ${inv.client} now (${inr(inv.amt)})`, 0, { type: 'chase', invoiceId: inv.id }));
    if (bill) options.push(opt(`Delay ${bill.vendor} bill 10 days (2% fee)`, bill.amt * 0.02, { type: 'delayBill', billId: bill.id }));
    options.push(opt('Do nothing', 0, { type: 'none' }, 'high'));
    cards.push(makeCard(g, {
      agent: 'treasurer', urgent: true, topic: d.n === 'Payroll' ? 'cash_gap_payroll' : 'cash_gap_gst',
      facts: { obligation: d.n, day: d.day, proj, gstDue, topClient: inv?.client, topAmt: inv?.amt, billVendor: bill?.vendor },
      title: `Cash gap before ${d.n} on day ${d.day}`,
      why: [`Projected cash on day ${d.day}: ${inr(proj)}`, `GST payable now ${inr(gstDue)}`, 'Late GST attracts 18% p.a. interest + penalty'], options,
    }));
  }
  return cards;
}

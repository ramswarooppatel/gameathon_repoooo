import { makeCard, opt, inr } from './card.js';

export function collector(g, events) {
  return events.filter((e) => e.type === 'late_pay').map((e) => {
    const inv = g.s.receivables.find((i) => i.id === e.payload.invoiceId);
    return makeCard(g, {
      agent: 'collector', eventId: e.id, urgent: true, ttl: 4, topic: 'late_payment',
      facts: { invoiceId: inv.id, client: inv.client, amt: inv.amt, extraDays: e.payload.extraDays, payDay: inv.payDay, dueDay: inv.dueDay, payrollDay: g.s.payroll.nextDay, gstDay: g.s.gst.nextDue },
      title: `${inv.client} will pay ${e.payload.extraDays} days late (${inr(inv.amt)})`,
      why: [`Invoice ${inv.id} due day ${inv.dueDay}`, `Client history delay ${Math.round(inv.lateRisk * 7)}d`, `Now expected day ${inv.payDay}`],
      options: [
        opt('Send firm reminder + call', 0, { type: 'reminder', invoiceId: inv.id }),
        opt('Offer 2% early-pay discount', inv.amt * 0.02, { type: 'discount', invoiceId: inv.id }),
        opt('Wait', 0, { type: 'none' }, 'high'),
      ],
    });
  });
}

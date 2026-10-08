import { makeCard, opt, inr } from './card.js';
import { validGstin } from '../tax/gst.js';

export function sentinel(g, events) {
  return events.filter((e) => e.type === 'fraud').map((e) => {
    const b = g.s.payables.find((p) => p.id === e.payload.billId);
    const why = [];
    if (b.bankChanged) why.push('Vendor bank account changed since last payment');
    if (!validGstin(b.gstin)) why.push('GSTIN checksum invalid');
    if (b.amt % 1000 === 0) why.push('Round amount, no PO reference');
    return makeCard(g, {
      agent: 'sentinel', eventId: e.id, urgent: true, ttl: 2, confidence: 0.9, defaultOption: 1, topic: 'fraud',
      facts: { billId: b.id, vendor: b.vendor, amt: b.amt, dueDay: b.dueDay, flags: why },
      title: `Suspicious bill ${inr(b.amt)} from "${b.vendor}"`, why,
      options: [opt('Block and verify by phone', 0, { type: 'block', billId: b.id }), opt('Pay anyway', b.amt, { type: 'none' }, 'high')],
    });
  });
}

import { makeCard, opt, inr } from './card.js';
import { projectCash } from '../core/forecast.js';

export function scout(g, events) {
  return events.filter((e) => e.type === 'opportunity').map((e) => {
    const { cost, payout, payDay } = e.payload, s = g.s;
    const after = projectCash(s, s.day + 12) - cost, ok = after > 25000;
    const accept = opt(`Accept: spend ${inr(cost)}, earn ${inr(payout)} on day ${payDay}`, cost, { type: 'accept', cost, payout, payDay }, ok ? 'low' : 'high');
    const decline = opt('Decline', 0, { type: 'none' });
    return makeCard(g, {
      agent: 'scout', eventId: e.id, ttl: 4, defaultOption: ok ? 1 : 0, confidence: 0.7, topic: 'opportunity',
      facts: { cost, payout, payDay, after, ok, day: s.day },
      title: `Bulk order: ${Math.round(((payout - cost) / cost) * 100)}% margin`,
      why: [`Cash after spend (12d view): ${inr(after)}`, ok ? 'Runway stays safe' : 'Would strain payroll/GST — risky'],
      options: ok ? [accept, decline] : [decline, accept],
    });
  });
}

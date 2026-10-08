import { CFG, createState } from './state.js';
import { mulberry32 } from './rng.js';
import { SCRIPT, issueInvoice, applyEvent } from './events.js';
import { computeHealth } from './health.js';
import { netPayable, addHeads } from '../tax/gst.js';
import { collector } from '../agents/collector.js';
import { treasurer } from '../agents/treasurer.js';
import { sentinel } from '../agents/sentinel.js';
import { scout } from '../agents/scout.js';

const AGENT_FNS = [collector, treasurer, sentinel, scout];

// crew=false builds the Ghost Twin: same seed + same surprises, nobody to react.
export function createGame(seed, { crew = true } = {}) {
  return { s: createState(seed), rng: mulberry32(seed), crew, cards: [], flags: {}, nextCardId: 1, n: { inv: 1, bill: 1, ev: 1 } };
}

const find = (arr, id) => arr.find((x) => x.id === id);

// The ONLY place card effects change state.
const EFFECTS = {
  none() {},
  reminder(g, e) { const i = find(g.s.receivables, e.invoiceId); if (i && !i.paid) i.payDay = Math.max(g.s.day + 1, i.payDay - 10); },
  chase(g, e) { const i = find(g.s.receivables, e.invoiceId); if (i && !i.paid) i.payDay = Math.min(i.payDay, g.s.day + 3); },
  discount(g, e) { const i = find(g.s.receivables, e.invoiceId); if (i && !i.paid) { i.amt = Math.round(i.amt * 0.98); i.payDay = g.s.day + 2; } },
  delayBill(g, e) { const b = find(g.s.payables, e.billId); if (b && !b.paid) { b.dueDay += 10; b.amt = Math.round(b.amt * 1.02); } },
  block(g, e) { const b = find(g.s.payables, e.billId); if (b && !b.paid) { b.blocked = true; g.s.stats.fraudBlocked += b.amt; } },
  accept(g, e) { g.s.stats.grown++; g.s.cash -= e.cost; g.s.inflows.push({ day: e.payDay, amt: e.payout }); },
};

export function decide(g, cardId, optionIdx, by = 'owner') {
  const card = find(g.cards, cardId);
  if (!card) return null;
  const option = card.options[optionIdx];
  EFFECTS[option.effect.type](g, option.effect);
  g.cards = g.cards.filter((c) => c !== card);
  const reactionDays = g.s.day - card.createdDay;
  g.s.stats.decisions++; g.s.stats.reactionSum += reactionDays; if (reactionDays <= 1) g.s.stats.fast++;
  return { card, option, by, reactionDays, day: g.s.day };
}

// Advance one day. Returns { events, cards (new), decided (auto/timeouts) }.
export function nextDay(g) {
  const s = g.s;
  if (s.over) return { events: [], cards: [], decided: [] };
  s.day++;
  s.cash += CFG.sales + Math.round((g.rng() - 0.5) * 1000) - CFG.opex;
  if (s.day % 4 === 0) issueInvoice(g);

  const events = [];
  if (SCRIPT[s.day]) { const e = applyEvent(g, SCRIPT[s.day]); if (e) events.push(e); }

  for (const i of s.receivables) if (!i.paid && i.payDay <= s.day) {
    i.paid = true; s.cash += i.amt; s.stats.invPaid++; if (s.day <= i.dueDay) s.stats.invOnTime++;
  }
  for (const x of s.inflows) if (x.day === s.day) s.cash += x.amt;
  for (const b of s.payables) if (!b.paid && !b.blocked && b.dueDay <= s.day) {
    b.paid = true; s.cash -= b.amt;
    if (b.fake) s.stats.fraudLost += b.amt; else s.stats.ok++;
  }
  if (s.day === s.payroll.nextDay) {
    if (s.cash < s.payroll.amt) s.stats.miss++; else s.stats.ok++;
    s.cash -= s.payroll.amt; s.payroll.nextDay += 30;
  }
  if (s.day === s.gst.nextDue) {
    const n = netPayable(s.gst.output, s.gst.itc);
    if (s.cash < n.total) { s.stats.miss++; const pen = Math.round(n.total * 0.1); s.cash -= pen; s.stats.penalties += pen; } else s.stats.ok++;
    s.cash -= n.total;
    s.gst.output = { cgst: 0, sgst: 0, igst: 0 }; s.gst.itc = n.carry; s.gst.nextDue += 30;
  }

  const decided = [], cards = [];
  if (g.crew) {
    for (const c of g.cards.filter((c) => c.expiresDay < s.day)) decided.push(decide(g, c.id, c.defaultOption, 'timeout'));
    for (const fn of AGENT_FNS) cards.push(...fn(g, events));
    g.cards.push(...cards);
    for (const c of cards) {
      const t = s.trust[c.agent];
      if (t.mode === 'auto' && c.options[0].costInr <= t.cap) decided.push(decide(g, c.id, 0, 'auto'));
    }
  }

  computeHealth(s);
  s.stats.minCash = Math.min(s.stats.minCash, s.cash);
  if (s.cash < 0) { s.over = true; s.won = false; }
  else if (s.day >= CFG.days) { s.over = true; s.won = s.health >= 60; }
  return { events, cards, decided };
}

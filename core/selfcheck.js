import assert from 'node:assert/strict';
import { split, validGstin, makeGstin, netPayable } from '../tax/gst.js';
import { createLedger } from '../ledger/blackbox.js';
import { createGame, nextDay, decide } from './engine.js';

// GST
assert.deepEqual(split(10000, 18, 'intra'), { cgst: 900, sgst: 900, igst: 0, total: 1800 });
assert.deepEqual(split(10000, 18, 'inter'), { cgst: 0, sgst: 0, igst: 1800, total: 1800 });
const g1 = makeGstin('27', 'AAPFU0939F');
assert.ok(validGstin(g1) && validGstin('27AAPFU0939F1ZV'));
assert.ok(!validGstin(g1.slice(0, 14) + (g1[14] === 'A' ? 'B' : 'A')));
assert.equal(netPayable({ cgst: 900, sgst: 900, igst: 0 }, { cgst: 0, sgst: 0, igst: 1000 }).total, 800);

// Ledger tamper detection
const L = createLedger();
for (let i = 1; i <= 3; i++) await L.append({ day: i, agent: 'x', cardId: `c${i}`, decision: { o: i }, why: 'w' });
assert.equal(await L.verify(), 0);
L.entries[1].why = 'edited';
assert.equal(await L.verify(), 2);

// Workspace math
import { summarize, nextDom, toCsv } from '../workspace/calc.js';
const own = makeGstin('27', 'AABCF1234F'), sup = makeGstin('29', 'AAPFS0939F');
const E = [
  { id: 1, kind: 'sale', number: 'S1', party: 'A', gstin: sup, date: '2026-10-02', due_date: '2026-10-05', taxable: 10000, gst_rate: 18, supply: 'inter' },
  { id: 2, kind: 'purchase', number: 'P1', party: 'B', gstin: own, date: '2026-10-03', due_date: '2026-10-20', taxable: 4000, gst_rate: 18, supply: 'inter', paid_date: '2026-10-04' },
  { id: 3, kind: 'purchase', number: 'P2', party: 'C', gstin: null, date: '2026-10-03', due_date: '2026-10-09', taxable: 1000, gst_rate: 18, supply: 'intra' },
];
const W = summarize(E, { opening_balance: 5000 }, '2026-10-08');
assert.equal(W.gst.net.total, 1080);          // out 1800 IGST - ITC 720 IGST (invalid-GSTIN bill excluded)
assert.equal(W.gst.itcAtRisk, 180);
assert.equal(W.cash, 5000 - 4720);             // opening - paid purchase (4000+720); sale unpaid
assert.ok(W.alerts.some((a) => /overdue/.test(a.text)) && W.alerts.some((a) => /GSTR-3B/.test(a.text)) === false);
assert.equal(nextDom('2026-10-21', 20), '2026-11-20');
assert.equal(toCsv(W.rows).split(String.fromCharCode(10)).length, 4);

// Determinism + Ghost Twin: crew (always takes recommended option) must beat a passive ghost.
function run(crew, policy) {
  const g = createGame(42, { crew });
  while (!g.s.over) { nextDay(g); if (policy) for (const c of [...g.cards]) decide(g, c.id, 0); }
  return g.s;
}
const a = run(true, true), b = run(true, true), ghost = run(false);
assert.equal(a.cash, b.cash);
for (const s of [a, ghost]) assert.ok(s.health >= 0 && s.health <= 100 && Number.isFinite(s.cash));
console.log(`crew  : health ${a.health} cash ${a.cash} won ${a.won} fraudLost ${a.stats.fraudLost}`);
console.log(`ghost : health ${ghost.health} cash ${ghost.cash} won ${ghost.won} fraudLost ${ghost.stats.fraudLost}`);
assert.ok(a.health > ghost.health, 'crew must beat ghost');
console.log('selfcheck OK');

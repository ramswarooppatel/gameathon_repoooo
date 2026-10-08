import assert from 'node:assert/strict';
import { split, validGstin, makeGstin, netPayable } from '../tax/gst.js';
import { calcInvoice, inWords, nextNumber, fy, supplyFor, parseShared, exportInvoice } from '../tax/invoice.js';
import * as EW from '../tax/eway.js';
import { invoicePdf, wrap, textWidth } from '../app/pdf.js';
import { calcPayslip, annualTax, tdsMonthly } from '../tax/payroll.js';
import { buildRun, entriesFor, dueDates, paidOnTime, parseEmployeesCsv, payrollStreak, ecrText, bankCsv } from '../workspace/payroll.js';
import { createLedger } from '../ledger/blackbox.js';
import { createGame, nextDay, decide } from './engine.js';
import { treasurer } from '../agents/treasurer.js';

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

// Bank import + recurring
import { parseBank, matchBank, parseDate } from '../app/bank.js';
import { dueMonths } from '../app/recurring.js';
assert.equal(parseDate('08/10/2026'), '2026-10-08');
const csv = ['Date,Narration,Debit,Credit,Balance', '05-10-2026,NEFT Sharma Traders,,11800.00,1', '06/10/2026,"Apex, Machinery",4720.00,,2', '07-10-2026,Unknown,100,,3'].join(String.fromCharCode(10));
const bank = parseBank(csv);
assert.deepEqual(bank.map((r) => r.amount), [11800, -4720, -100]);
const BM = matchBank(bank, W.rows.map((r) => ({ ...r })).concat([{ id: 9, kind: 'sale', party: 'Sharma Traders', total: 11800, due_date: '2026-10-05', paid_date: null }]));
assert.equal(BM[0].entry?.kind, 'sale');
assert.equal(BM[2].entry, null);
assert.deepEqual(dueMonths({ day_of_month: 5, start_month: '2026-08', last_generated: null }, '2026-10-08').map((x) => x.date), ['2026-08-05', '2026-09-05', '2026-10-05']);
assert.deepEqual(dueMonths({ day_of_month: 25, start_month: '2026-10', last_generated: null }, '2026-10-08'), []);
assert.deepEqual(dueMonths({ day_of_month: 5, start_month: '2026-08', last_generated: '2026-10' }, '2026-10-08'), []);

// Reports + invoice
import { pnl, aging, topParties } from '../app/reports.js';
import { invoiceHtml } from '../app/invoice.js';
const P = pnl(W.rows, ['2026-10']);
assert.equal(P[0].income, 10000); assert.equal(P[0].spend, 5000); assert.equal(P[0].net, 5000);
const AG = aging(W.rows, '2026-10-20', 'in');
assert.equal(AG.find((b) => b.label === '1–30 days').amount, 11800);
assert.equal(topParties(W.rows, 'out')[0].party, 'B');
const html = invoiceHtml({ ...W.rows[0], party: '<script>x</script>' }, { name: 'Oxro Labs', gstin: null }, null);
assert.ok(html.includes('&lt;script&gt;') && !html.includes('<script>x'));

// Planner: forecast, scenarios, pay priority, collection ladder, budgets
import { forecast, payPriority, collectionPlan, budgetStatus, customerDelays } from '../workspace/planner.js';
import { enrich } from '../workspace/calc.js';
const T = '2026-10-08';
const mk = (o) => enrich({ id: Math.random(), gst_rate: 0, supply: 'intra', date: '2026-09-01', number: null, gstin: null, paid_date: null, ...o });
const PR = [mk({ kind: 'sale', party: 'A', taxable: 118000, due_date: '2026-10-18' }), mk({ kind: 'purchase', party: 'V', taxable: 59000, due_date: '2026-10-13' })];
const F = forecast(PR, { today: T, cash: 100000, horizon: 12 }, 'base');
assert.equal(F.min.cash, 41000); assert.equal(F.endCash, 159000); assert.equal(F.firstNegative, null);
assert.equal(forecast(PR, { today: T, cash: 100000, horizon: 12 }, 'late').endCash, 41000);   // customer pays 15 days later: nothing arrives in 12 days
const OVD = [mk({ kind: 'sale', party: 'Slow', taxable: 1000, due_date: '2026-09-20', paid_date: '2026-10-05' })];
assert.equal(Math.round(customerDelays(OVD).of('Slow')), 15);
const PP = payPriority([mk({ kind: 'purchase', party: 'A', taxable: 30000, due_date: '2026-10-10' }), mk({ kind: 'purchase', party: 'B', taxable: 40000, due_date: '2026-10-09' }), mk({ kind: 'purchase', party: 'C', taxable: 20000, due_date: '2026-10-01' })], 50000, T, 0);
assert.deepEqual(PP.map((x) => x.row.party), ['C', 'B', 'A']); assert.equal(PP[0].action, 'pay'); assert.equal(PP[1].action, 'cash-short');
const ago = (n) => new Date(Date.parse(T) - n * 86400000).toISOString().slice(0, 10);
const CP = collectionPlan([3, 20, 45, 90].map((n) => mk({ kind: 'sale', party: 'P' + n, taxable: 1000, due_date: ago(n) })), T);
assert.deepEqual(CP.map((c) => c.stage.key).sort(), ['call', 'escalate', 'firm', 'friendly']);
const BS = budgetStatus([mk({ kind: 'expense', party: 'R', taxable: 25000, category: 'Rent', date: '2026-10-01' })], { Rent: 20000, Travel: 5000 }, '2026-10', T);
assert.equal(BS.find((b) => b.category === 'Rent').status, 'over'); assert.equal(BS.find((b) => b.category === 'Travel').actual, 0);

// Invoice generator + e-way bill
const INV = calcInvoice([{ desc: 'Phone', hsn: '8517', qty: 2, rate: 1000, disc: 10, gst: 18 }, { desc: 'Install', hsn: '9983', qty: 1, rate: 500, gst: 5 }, { desc: 'Cable', hsn: '8544', qty: 1, rate: 200, gst: 18 }], { supply: 'intra' });
assert.equal(INV.taxable, 2500); assert.deepEqual(INV.byRate.map((r) => [r.gst, r.taxable, r.total]), [[18, 2000, 360], [5, 500, 25]]);
assert.equal(INV.cgst, 192.5); assert.equal(INV.grand, 2885); assert.equal(INV.payable, 2885); assert.equal(INV.hsn.length, 3);
assert.deepEqual((({ grand, payable, roundOff }) => [grand, payable, roundOff])(calcInvoice([{ desc: 'x', hsn: '1', qty: 1, rate: 100.4, gst: 18 }], { supply: 'inter' })), [118.47, 118, -0.47]);
assert.equal(calcInvoice([{ desc: 'x', hsn: '1', qty: 3, rate: 100, gst: 18 }], { bos: true }).tax, 0);
assert.equal(inWords(125000.5), 'Rupees One Lakh Twenty Five Thousand and Fifty Paise Only');
assert.equal(inWords(1234567), 'Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Only'); assert.equal(inWords(0), 'Rupees Zero Only');
assert.equal(fy('2026-03-31'), '25-26'); assert.equal(fy('2026-04-01'), '26-27');
assert.equal(nextNumber(['INV/26-27/0009', 'INV/25-26/0120'], '2026-10-09'), 'INV/26-27/0010'); assert.equal(nextNumber([], '2027-01-05', 'AC ME!'), 'ACME/26-27/0001');
assert.ok(nextNumber([], '2026-10-09', 'LONGPREFIXX').length <= 16);
assert.equal(supplyFor('27AAPFU0939F1ZV', '29'), 'inter'); assert.equal(supplyFor('27AAPFU0939F1ZV', '27'), 'intra');
assert.equal(EW.validityDays(201), 2); assert.equal(EW.validityDays(0), 1); assert.equal(EW.validityDays(250, true), 3);
assert.ok(EW.validVehicle('MH 12 AB 1234') && !EW.validVehicle('XX')); assert.equal(EW.required({ items: [{ hsn: '8517' }], totals: { grand: 60000 } }).need, true);
assert.equal(EW.required({ items: [{ hsn: '9983' }], totals: { grand: 60000 } }).need, false); assert.equal(EW.required({ items: [{ hsn: '8517' }], totals: { grand: 50000 } }).need, false);
assert.equal(EW.check({ mode: 'road', fromPincode: '400001', toPincode: '560001', distance: 980 }).length, 1);
const NIC = EW.nicJson({ number: 'INV/26-27/0001', date: '2026-10-09', supply: 'inter', pos_state: '29', seller: { gstin: '27AAPFU0939F1ZV', name: 'S' }, buyer: { name: 'B', gstin: '29AAPFU0939F1ZW' }, totals: { ...INV, grand: 2885 } }, { fromPincode: '400001', toPincode: '560001', distance: 980, mode: 'road', vehicle: 'mh12ab1234' }).billLists[0];
assert.equal(NIC.docDate, '09/10/2026'); assert.equal(NIC.toStateCode, 29); assert.equal(NIC.vehicleNo, 'MH12AB1234'); assert.equal(NIC.itemList[0].igstRate, 18);
const FILE = exportInvoice({ id: 'abc', number: 'INV/26-27/0001', doc_type: 'tax', date: '2026-10-09', due_date: null, seller: { name: 'S', gstin: '27AAPFU0939F1ZV' }, buyer: { name: 'B' }, supply: 'intra', pos_state: '27', reverse_charge: false, items: [{ desc: 'Phone', hsn: '8517', qty: 2, rate: 1000, disc: 10, gst: 18 }], totals: { grand: 99999 }, notes: null });
const PS = parseShared(FILE); assert.equal(PS.doc.totals.grand, 2124); assert.ok(PS.doc.mismatch > 0);   // totals are recomputed, tampering is flagged
assert.ok(parseShared('nope').error && parseShared('{"format":"x"}').error && parseShared(FILE.replace('"gst": 18', '"gst": 7')).error);
const PDF = new TextDecoder('latin1').decode(invoicePdf({ number: 'INV/26-27/0001', doc_type: 'tax', date: '2026-10-09', supply: 'intra', pos_state: '27', seller: { name: 'S', gstin: '27AAPFU0939F1ZV', bank: {} }, buyer: { name: 'B' }, notes: 'a\nb', totals: INV }));
assert.ok(PDF.startsWith('%PDF-1.4') && PDF.trimEnd().endsWith('%%EOF') && PDF.includes('Rs. 2,885.00') && PDF.includes('INV/26-27/0001'));
const XO = +PDF.match(/startxref\n(\d+)/)[1]; assert.equal(PDF.slice(XO, XO + 4), 'xref');   // the xref offset points at the table
assert.deepEqual(wrap('a\nb c', 500, 9), ['a', 'b c']); assert.ok(textWidth('Hello', 10) > 20 && textWidth('Hello', 10) < 30);

// Payroll
const PEMP = { id: 'a', code: 'E1', name: 'Asha', basic: 30000, hra: 12000, allowances: 8000, pf_on: true, pf_cap: true, esi_on: false, pt_state: '27', tds_on: true };
const PSLIP = calcPayslip(PEMP, { days: 31, lop: 0, month: 10 });
assert.equal(PSLIP.gross, 50000); assert.equal(PSLIP.pfEmp, 1800); assert.equal(PSLIP.employer.eps, 1250); assert.equal(PSLIP.employer.epf, 550); assert.equal(PSLIP.pt, 200); assert.equal(PSLIP.net, 48000);
assert.equal(calcPayslip(PEMP, { days: 30, lop: 15, month: 2 }).gross, 25000); assert.equal(calcPayslip(PEMP, { days: 28, lop: 0, month: 2 }).pt, 300);   // loss of pay halves the pay; MH February PT is 300
assert.equal(annualTax(1500000), 97500); assert.equal(annualTax(1275000), 0); assert.equal(tdsMonthly(1500000), 8125);                                  // new regime, 87A rebate to 12 lakh taxable
const LOWPAID = { id: 'b', name: 'Ravi', basic: 12000, hra: 4000, allowances: 2000, pf_on: true, pf_cap: true, esi_on: true, pt_state: '29', join_date: '2026-10-11' };
const PRUN = buildRun([PEMP, LOWPAID, { id: 'c', name: 'Left', basic: 9000, left_date: '2026-09-30' }], {}, '2026-10');
assert.equal(PRUN.slips.length, 2); assert.equal(PRUN.slips[1].calc.lop, 10); assert.equal(PRUN.slips[1].calc.esiEmp, 92); assert.equal(PRUN.totals.net, 59127);   // joiner is prorated, leaver is off the run
const PENT = entriesFor('2026-10', PRUN.totals, '2026-10-31'); assert.deepEqual(PENT.map((x) => x.number), ['PAY-2026-10', 'PF-2026-10', 'ESI-2026-10', 'PT-2026-10']);
assert.equal(PENT.reduce((a, x) => a + x.taxable, 0), PRUN.totals.net + PRUN.totals.pfTotal + PRUN.totals.esiTotal + PRUN.totals.pt + PRUN.totals.tds);              // cash out = net pay + everything owed to authorities
assert.equal(dueDates('2026-12').pf, '2027-01-15'); assert.ok(paidOnTime('2026-10', '2026-11-07') && !paidOnTime('2026-10', '2026-11-08'));
assert.equal(parseEmployeesCsv('code,name,basic,pf\nE1,Neha,25000,yes\nE2,,1,').rows.length, 1); assert.equal(payrollStreak([{ kind: 'payroll_on_time', ref: '2026-09' }, { kind: 'payroll_on_time', ref: '2026-08' }], '2026-10'), 2);
assert.ok(ecrText(PRUN.slips).split('\n')[0].split('#~#').length === 11); assert.ok(bankCsv(PRUN.slips, '2026-10').includes('Salary 2026-10'));

// Treasurer big bill: recommend paying when cash is healthy, negotiating when tight; an unanswered card always pays on the due date.
for (const [cash, first, tight] of [[200000, 'Pay on due date', false], [1000, 'Negotiate +10 days (2% fee)', true]]) {
  const tg = createGame(42); tg.s.cash = cash; tg.s.day = 16; tg.s.payables.push({ id: 'B1', vendor: 'Apex', taxable: 50000, amt: 59000, dueDay: 21, paid: false });
  const [bc] = treasurer(tg, [{ id: 'e', type: 'big_expense', payload: { billId: 'B1' } }]).filter((x) => x.topic === 'big_bill');
  assert.equal(bc.options[0].label, first); assert.equal(bc.facts.tight, tight); assert.equal(bc.options[bc.defaultOption].label, 'Pay on due date');
}

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

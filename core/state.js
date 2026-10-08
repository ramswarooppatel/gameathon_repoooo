import { makeGstin } from '../tax/gst.js';

export const CFG = { days: 90, startCash: 150000, opex: 2500, payroll: 60000, sales: 3000, rate: 18, ownState: '27' };

export const OWN_GSTIN = makeGstin('27', 'AABCF1234F');
export const CLIENTS = [
  { name: 'Sharma Traders', gstin: makeGstin('27', 'AAPFS0939F'), delay: 0 },
  { name: 'Bluebird Retail', gstin: makeGstin('29', 'AABCB4521K'), delay: 2 },
  { name: 'Kaveri Foods', gstin: makeGstin('33', 'AAACK7788L'), delay: 5 },
];

const heads = () => ({ cgst: 0, sgst: 0, igst: 0 });
export const AGENTS = ['collector', 'treasurer', 'sentinel', 'scout'];

// State contract (GOD_PROMPT §5). Add fields only.
export function createState(seed) {
  return {
    seed, day: 0, cash: CFG.startCash,
    receivables: [], payables: [], inflows: [],
    payroll: { amt: CFG.payroll, nextDay: 30 },
    gst: { output: heads(), itc: heads(), nextDue: 20 },
    stats: { ok: 0, miss: 0, invPaid: 0, invOnTime: 0, fraudBlocked: 0, fraudLost: 0, decisions: 0, reactionSum: 0, penalties: 0, fast: 0, grown: 0, minCash: CFG.startCash },
    trust: Object.fromEntries(AGENTS.map((a) => [a, { mode: 'ask', cap: 5000 }])),
    health: 100, runwayDays: 0, over: false, won: null,
  };
}

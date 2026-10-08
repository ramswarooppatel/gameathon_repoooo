import { CFG } from './state.js';
import { dailyBurn } from './forecast.js';

const clamp = (x) => Math.max(0, Math.min(1, x));

// Runway 30 · On-time obligations 25 · Collections 20 · Fraud avoided 15 · Growth 10
export function computeHealth(s) {
  const st = s.stats;
  s.runwayDays = Math.max(0, Math.round(s.cash / dailyBurn(s)));
  const onTime = st.ok + st.miss ? st.ok / (st.ok + st.miss) : 1;
  const coll = st.invPaid ? st.invOnTime / st.invPaid : 1;
  const fraud = st.fraudBlocked + st.fraudLost ? st.fraudBlocked / (st.fraudBlocked + st.fraudLost) : 1;
  const growth = clamp(s.cash / CFG.startCash / 1.5);
  s.health = Math.round(100 * (0.3 * clamp(s.runwayDays / 60) + 0.25 * onTime + 0.2 * coll + 0.15 * fraud + 0.1 * growth));
  return s.health;
}

// Gamification layer: derived purely from state (no engine writes). XP -> rank, missions, badges.
export const RANKS = [[0, 'Apprentice'], [400, 'Analyst'], [900, 'Controller'], [1600, 'Finance Lead'], [2500, 'CFO']];

const MISSIONS = [
  { id: 'fraud', title: 'Fraud Shield', desc: 'Block a fraudulent payment', done: (s) => s.stats.fraudBlocked > 0 },
  { id: 'clean', title: 'Clean Filing Record', desc: 'No missed GST/payroll by day 45', done: (s) => s.day >= 45 && !s.stats.miss, failed: (s) => s.stats.miss > 0 },
  { id: 'liquid', title: 'Liquidity Guard', desc: 'Keep cash above ₹30,000 through day 60', done: (s) => s.day >= 60 && s.stats.minCash >= 30000, failed: (s) => s.stats.minCash < 30000 },
  { id: 'speed', title: 'Rapid Response', desc: 'Average decision time ≤ 1 day (5+ decisions)', done: (s) => s.stats.decisions >= 5 && s.stats.reactionSum / s.stats.decisions <= 1 },
  { id: 'growth', title: 'Growth Move', desc: 'Accept a profitable opportunity', done: (s) => s.stats.grown > 0 },
  { id: 'ghost', title: 'Beat the Ghost', desc: 'Lead the no-crew twin by 25+ health after day 30', done: (s, gs) => s.day >= 30 && s.health - gs.health >= 25 },
];

export function progress(g, ghost) {
  const s = g.s, st = s.stats;
  g.achieved ??= new Set();
  const fresh = [];
  const missions = MISSIONS.map((m) => {
    if (!g.achieved.has(m.id) && m.done(s, ghost.s)) { g.achieved.add(m.id); fresh.push(m); }
    const status = g.achieved.has(m.id) ? 'done' : m.failed?.(s) ? 'failed' : 'active';
    return { id: m.id, title: m.title, desc: m.desc, status };
  });
  const xp = Math.max(0, s.day * 8 + st.decisions * 15 + st.fast * 25 + Math.floor(st.fraudBlocked / 200) + st.grown * 60 + Math.max(0, s.health - 50) * 4 - st.miss * 120 + g.achieved.size * 100);
  let i = 0; while (i + 1 < RANKS.length && xp >= RANKS[i + 1][0]) i++;
  const lo = RANKS[i][0], hi = RANKS[i + 1]?.[0] ?? lo;
  return { xp, rank: RANKS[i][1], pct: hi > lo ? Math.round(((xp - lo) / (hi - lo)) * 100) : 100, nextRank: RANKS[i + 1]?.[1] ?? null, missions, fresh };
}

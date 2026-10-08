// Client for /api/groq. Every call has a fallback so the game never depends on the network.
const SYS = "You are Mind Your Funds' finance explainer for an Indian small business. Use only the facts provided. Plain English, max 60 words, include ₹ numbers, never invent tax rules, end with the next action.";

let warned = false;
export async function ask(messages, fallback) {
  try {
    const r = await fetch('/api/groq', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages }), signal: AbortSignal.timeout(9000) });
    if (!r.ok) { if (!warned) { warned = true; console.warn(r.status === 404 ? '[ai] /api/groq not found: this is a static server. Start the app with `npm run dev` (netlify dev) so the AI proxy runs.' : `[ai] /api/groq answered ${r.status}`); } return fallback; }
    return (await r.json()).text || fallback;
  } catch { return fallback; }
}

export const explain = (facts, fallback) => ask([{ role: 'system', content: SYS }, { role: 'user', content: facts }], fallback);

// No names/GSTINs leave the browser: only aggregate numbers.
export const cfo = (question, s, projected) =>
  ask([{ role: 'system', content: SYS }, { role: 'user', content: `Day ${s.day}/90. Cash ₹${Math.round(s.cash)}, runway ${s.runwayDays}d, health ${s.health}, projected cash in 14d ₹${projected}. Question: ${question.slice(0, 300)}` }],
    'AI CFO is offline. Rule of thumb: keep cash above one payroll plus the next GST payment before spending.');

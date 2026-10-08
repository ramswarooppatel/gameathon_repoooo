// Client for /api/groq. Every call has a fallback so the game never depends on the network.
const SYS = "You are Mind Your Funds' finance explainer for an Indian small business. Use only the facts provided. Plain English, max 60 words, include ₹ numbers, never invent tax rules, end with the next action.";

let warned = false;
export async function ask(messages, fallback) {
  try {
    const r = await fetch('/api/groq', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages }), signal: AbortSignal.timeout(20000) });
    if (!r.ok) {
      const e = await r.json().catch(() => ({})), why = r.status === 404 ? 'the AI proxy is not running: start the app with npm run dev' : r.status === 503 ? 'GROQ_API_KEY is missing in .env' : r.status === 429 ? 'too many questions, wait a minute'
        : e.tried ? `this Groq key cannot use: ${e.tried.join(', ')}` : `the AI proxy answered ${r.status}${e.detail ? ': ' + String(e.detail).slice(0, 80) : ''}`;
      if (!warned) { warned = true; console.warn('[ai] ' + why); } return `${fallback} (${why})`;
    }
    return (await r.json()).text || fallback;
  } catch (x) { return `${fallback} (${x?.name === 'TimeoutError' ? 'the AI took too long to answer' : 'cannot reach the AI proxy: start the app with npm run dev'})`; }
}

export const explain = (facts, fallback) => ask([{ role: 'system', content: SYS }, { role: 'user', content: facts }], fallback);

// No names/GSTINs leave the browser: only aggregate numbers.
export const cfo = (question, s, projected) =>
  ask([{ role: 'system', content: SYS }, { role: 'user', content: `Day ${s.day}/90. Cash ₹${Math.round(s.cash)}, runway ${s.runwayDays}d, health ${s.health}, projected cash in 14d ₹${projected}. Question: ${question.slice(0, 300)}` }],
    'AI CFO is offline. Rule of thumb: keep cash above one payroll plus the next GST payment before spending.');

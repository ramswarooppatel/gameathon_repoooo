// Groq proxy: keeps GROQ_API_KEY server-side. POST /api/groq { messages:[{role,content}], json?:bool } -> { text, model }
// Models come and go per account, so we try GROQ_MODEL first, then known chat models in order, and remember the one that works.
const hits = new Map(); // ponytail: in-memory per-instance limiter; use Upstash/Redis if abused
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const CANDIDATES = ['llama-3.1-8b-instant', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'llama-3.3-70b-versatile'];   // Llama 3.1 8B first; any model the key cannot use (404) is skipped
let working = null;                                   // last model that answered; skips repeated 404s on warm instances
const clean = (t) => String(t ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const key = process.env.GROQ_API_KEY;
  if (!key) return json({ error: 'GROQ_API_KEY not set' }, 503);

  const ip = req.headers.get('x-nf-client-connection-ip') || 'anon', now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (recent.length >= 20) return json({ error: 'rate limited' }, 429);
  hits.set(ip, [...recent, now]);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const m = body.messages;
  if (!Array.isArray(m) || m.length > 6 || m.some((x) => typeof x.content !== 'string' || x.content.length > 2000 || !['system', 'user', 'assistant'].includes(x.role)))
    return json({ error: 'bad messages' }, 400);

  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const models = [...new Set([working, process.env.GROQ_MODEL, ...CANDIDATES].filter(Boolean))], tried = [];
    let r, used;
    for (const model of models) {
      const gpt = model.startsWith('openai/gpt-oss');
      r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages: m, temperature: 0.2, max_tokens: gpt ? 900 : 400, ...(gpt ? { reasoning_effort: 'low' } : {}), ...(body.json ? { response_format: { type: 'json_object' } } : {}) }),
      });
      if (r.status !== 404) { used = model; break; }          // 404 = this account has no access to the model: try the next
      tried.push(model); if (model === working) working = null; console.warn('[groq] model not available:', model);
    }
    if (!used) return json({ error: 'no Groq model available for this API key', tried }, 502);
    if (!r.ok) { const detail = (await r.text()).slice(0, 300); console.error('[groq]', used, r.status, detail); return json({ error: `groq ${r.status}`, model: used, detail }, 502); }
    working = used;
    return json({ text: clean((await r.json()).choices?.[0]?.message?.content), model: used });
  } catch { return json({ error: 'upstream timeout' }, 504); } finally { clearTimeout(timer); }
};
export const config = { path: '/api/groq' };

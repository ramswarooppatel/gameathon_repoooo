// Groq proxy: keeps GROQ_API_KEY server-side. POST /api/groq { messages:[{role,content}], json?:bool } -> { text }
const hits = new Map(); // ponytail: in-memory per-instance limiter; use Upstash/Redis if abused
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

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

  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    // Some Groq projects restrict which models are enabled: on 404 try the next model.
    const models = [...new Set([process.env.GROQ_MODEL, 'llama-3.1-8b-instant', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b'].filter(Boolean))];
    let r;
    for (const model of models) {
      r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages: m, temperature: 0.2, max_tokens: model.startsWith('openai/gpt-oss') ? 800 : 200, ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}), ...(body.json ? { response_format: { type: 'json_object' } } : {}) }),
      });
      if (r.status !== 404) break;
      console.warn('[groq] model not available, trying next:', model);
    }
    if (!r.ok) { const detail = (await r.text()).slice(0, 300); console.error('[groq]', r.status, detail); return json({ error: `groq ${r.status}`, detail }, 502); }
    return json({ text: (await r.json()).choices?.[0]?.message?.content ?? '' });
  } catch { return json({ error: 'upstream timeout' }, 504); } finally { clearTimeout(timer); }
};
export const config = { path: '/api/groq' };

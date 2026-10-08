// Static files + the real Groq proxy function (netlify/functions/groq.js), no Netlify CLI needed. `npm start` serves http://localhost:3000 with the AI working; also used by scripts/ai_test.py. Usage: node scripts/ai_server.mjs <port>
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (fs.existsSync(path.join(root, '.env'))) for (const l of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) { const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim().replace(/^["']|["']$/g, ''); }
const handler = (await import('../netlify/functions/groq.js')).default;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
http.createServer(async (q, s) => {
  const u = new URL(q.url, 'http://x');
  if (u.pathname === '/api/groq') { const chunks = []; for await (const c of q) chunks.push(c); const r = await handler(new Request('http://x/api/groq', { method: q.method, headers: q.headers, body: q.method === 'POST' ? Buffer.concat(chunks) : undefined })); s.writeHead(r.status, { 'content-type': 'application/json' }); return s.end(await r.text()); }
  let f = path.join(root, decodeURIComponent(u.pathname)); if (f.endsWith(path.sep) || !path.extname(f)) f = path.join(f, 'index.html');
  if (!f.startsWith(root) || !fs.existsSync(f)) { s.writeHead(404); return s.end('not found'); }
  s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
}).listen(+process.argv[2] || 3138, () => console.log('ready'));

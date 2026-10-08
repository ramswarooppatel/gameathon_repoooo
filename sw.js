// Service worker: instant repeat loads (stale-while-revalidate for static assets) and always-fresh pages (network-first for HTML/data).
// Same-origin GETs only; /api/* and cross-origin calls (Supabase, Groq) are never touched.
const CACHE = 'myf-v4';
const SHELL = ['./', 'index.html', 'app/bundle.min.css', 'public/logo-64.png', 'public/logo-128.png', 'app/main.js'];
const STATIC = /\.(?:css|js|png|webp|jpg|jpeg|svg|woff2?)$/i;

self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (STATIC.test(u.pathname)) {                       // stale-while-revalidate
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});

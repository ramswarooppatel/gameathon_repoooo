// Service worker: instant repeat loads (stale-while-revalidate for static assets), fresh pages (network-first for HTML), offline page on failed navigation.
// Same-origin GETs only; /api/* and cross-origin calls (Supabase, Groq) are never touched.
const CACHE = 'myf-v7';
const SHELL = ['./', 'index.html', 'offline.html', 'manifest.webmanifest', 'app/bundle.min.css', 'public/logo-64.png', 'public/logo-128.png', 'public/icon-192.png', 'public/icon-512.png',
  'app/main.js', 'app/nav.js', 'app/pdf.js', 'app/views4.js', 'app/views5.js', 'app/standards.js'];
const STATIC = /\.(?:css|js|png|webp|jpg|jpeg|svg|woff2?)$/i;

// Cache each file on its own so one missing file cannot stop the rest from being cached.
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))); });
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
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(async () => (await caches.match(e.request)) || (e.request.mode === 'navigate' ? caches.match('offline.html') : undefined)));
});

const CACHE = 'flowlab-3.2.0';
const SHELL = ['/', '/index.html', '/config.js', '/manifest.json', '/icon-192.png', '/icon-512.png', '/src/styles.css'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).then(response => { if (response.ok && response.type !== 'opaque') caches.open(CACHE).then(c => c.put(event.request, response.clone())).catch(() => {}); return response; }).catch(() => caches.match(event.request).then(hit => hit || caches.match('/'))));
});

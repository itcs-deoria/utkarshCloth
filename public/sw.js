// Service worker: app "install" hone layak banata hai.
// Pages cache nahi karta (login wala private data hai), sirf design files. Internet na ho to "offline" page dikhata hai.
const CACHE = 'stock-v1', FILES = ['/offline.html', '/style.css', '/js/app.js', '/icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request, url = new URL(r.url);
  if (r.method !== 'GET' || url.origin !== location.origin) return;
  if (r.mode === 'navigate') { // page kholna: hamesha internet se, na chale to offline page
    e.respondWith(fetch(r).catch(() => caches.match('/offline.html')));
  } else if (FILES.includes(url.pathname)) { // design files: pehle internet (naya), na chale to purana
    e.respondWith(fetch(r).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); return res; }).catch(() => caches.match(r)));
  }
});

const VER = 'noor-v1.0.4';
const CORE = [
  './', 'index.html', 'styles.css', 'app.js', 'i18n.js', 'manifest.json',
  'fonts/amiri-quran.woff2', 'fonts/cairo.woff2',
  'data/meta.json', 'data/index.json', 'data/ar.json', 'data/ru.json', 'data/en.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VER).then(c => c.addAll(CORE)).then(() => self.skipWaiting()).catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // audio & external: network only

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) {
        // refresh in background for shell assets
        if (!/\.json$/.test(url.pathname)) {
          fetch(req).then(res => { if (res && res.ok) caches.open(VER).then(c => c.put(req, res.clone())); }).catch(() => {});
        }
        return hit;
      }
      return fetch(req).then(res => {
        if (res && res.ok && (res.type === 'basic' || res.type === 'default')) {
          const copy = res.clone();
          caches.open(VER).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});

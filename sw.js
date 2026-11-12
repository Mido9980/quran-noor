const VER = 'quran-v1.1.2';
const V = '1.1.2';
const CORE = [
  './', 'index.html', 'manifest.json',
  'styles.css?v=' + V, 'app.js?v=' + V, 'i18n.js?v=' + V,
  'fonts/amiri-quran.woff2', 'fonts/cairo.woff2',
  'data/meta.json', 'data/index.json', 'data/ar.json', 'data/ru.json', 'data/en.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VER).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
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
  if (url.origin !== location.origin) return;

  const isStatic = /\.json$|fonts\/|icons\//.test(url.pathname);

  const put = (r, res) => { if (res && res.ok) { const copy = res.clone(); caches.open(VER).then(c => c.put(r, copy)).catch(() => {}); } };

  const networkFirst = r => fetch(r, { cache: 'no-cache' }).then(res => {
    if (!res || !res.ok) throw new Error('bad');
    put(r, res);
    return res;
  }).catch(() => caches.match(r).then(hit => hit || caches.match('index.html')));

  const cacheFirst = r => caches.match(r).then(hit => hit || fetch(r).then(res => { put(r, res); return res; }));

  if (req.mode === 'navigate') { e.respondWith(networkFirst(req)); return; }
  e.respondWith(isStatic ? cacheFirst(req) : networkFirst(req));
});

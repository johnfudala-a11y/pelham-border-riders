/* Service worker: keeps the app, trail data and viewed map tiles available with no signal. */
const VERSION = 'pst-shell-v4';          // bump this when app files change
const TILE_CACHE = 'pst-tiles-v1';       // must match CFG.tileCache in app.js
const TILE_HOST = 'basemap.nationalmap.gov';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'members.js', 'config.js', 'vendor/supabase.js', 'manifest.webmanifest',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'vendor/leaflet/images/marker-icon.png', 'vendor/leaflet/images/marker-icon-2x.png', 'vendor/leaflet/images/marker-shadow.png',
  'data/trails.geojson', 'data/pois.json', 'data/townline.geojson', 'data/status.json', 'data/worksites.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('pst-shell-') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // map tiles: saved copy first, otherwise fetch and keep it
  if (url.hostname === TILE_HOST) {
    e.respondWith(caches.open(TILE_CACHE).then(async c => {
      const hit = await c.match(req.url);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req.url, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // trail status: always try the network so closures show up, fall back to the saved copy
  const live = ['status.json', 'worksites.json'].find(f => url.pathname.endsWith('/data/' + f));
  if (live) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put('data/' + live, copy)); }
      return res;
    }).catch(() => caches.match('data/' + live)));
    return;
  }

  // everything else: saved copy first, refresh it in the background
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});

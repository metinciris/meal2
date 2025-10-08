/* sw.js — cache-first (assets), network-first (data) */
const CACHE = 'meal2-v4';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // data dosyaları: network-first (güncel kalsın)
  if (url.pathname.endsWith('/data/normalized.json') || url.pathname.endsWith('/data/tts-dict.json')) {
    e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
    return;
  }
  // diğerleri: cache-first
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

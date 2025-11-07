/* PWA Service Worker — network-first veri, SW güncelleme bildirimi */
const CACHE_VERSION = 'v20251108-1';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest'
];

self.addEventListener('install', (evt)=>{
  evt.waitUntil((async()=>{
    const cache = await caches.open('shell-'+CACHE_VERSION);
    await cache.addAll(SHELL);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (evt)=>{
  evt.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k=> {
      if (!k.endsWith(CACHE_VERSION)) return caches.delete(k);
    }));
    await self.clients.claim();

  })());
});

self.addEventListener('message', (evt)=>{
  if (evt.data && evt.data.type === 'SKIP_WAITING'){ self.skipWaiting(); }
});

// Basit strateji: veri (data/*) için network-first; diğerleri stale-while-revalidate
self.addEventListener('fetch', (evt)=>{
  const req = evt.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isData = url.pathname.includes('/data/');

  if (isData){
    // network-first: çevrimdışıysa cache
    evt.respondWith((async()=>{
      try{
        const fresh = await fetch(req, { cache:'no-store' });
        const cache = await caches.open('data-'+CACHE_VERSION);
        cache.put(req, fresh.clone());
        return fresh;
      }catch(_){
        const cache = await caches.open('data-'+CACHE_VERSION);
        const hit = await cache.match(req);
        if (hit) return hit;
        throw _;
      }
    })());
    return;
  }

  // stale-while-revalidate for shell/assets
  evt.respondWith((async()=>{
    const cache = await caches.open('shell-'+CACHE_VERSION);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then(res=>{
      cache.put(req, res.clone()); return res;
    }).catch(_=> cached || Promise.reject(_));
    return cached || fetchPromise;
  })());
});

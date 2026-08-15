/**
 * Offline support.
 *
 * A tool that claims your document never leaves the device should be able to
 * prove it by working with the wifi off. That is the strongest demonstration
 * this product has, and it costs about forty lines (TRD §7).
 *
 * What is cached: the app itself — HTML, JS, CSS, the OCR engine, the WASM.
 * What is never cached: the user's document. It only ever exists in memory, and
 * nothing here touches it.
 *
 * ponytail: caches on demand rather than precaching a manifest. The build's
 * chunk filenames are hashed and unknown to this file, and a stale precache
 * list breaks the install silently. The cost is that offline works fully only
 * after one online run, which is exactly how the demo is performed anyway.
 */

const CACHE = 'pehchaan-v2';

self.addEventListener('install', (event) => {
  // The shell, so a cold offline load has something to open.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/')));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Same-origin GETs only. There are no cross-origin requests to handle, and
  // silently caching one would hide exactly the event we are trying to prove
  // never happens.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // The page itself goes to the network first, falling back to cache when
  // offline. Cache-first here looks fine until the app is rebuilt: the stale
  // shell asks for chunk hashes that no longer exist and the page comes up
  // blank, with no way out but clearing site data. Assets are content-hashed,
  // so only this one document needs the freshness check.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request)
          .then((response) => {
            // Only full, successful responses. A 206 or an opaque error page
            // cached here would break the app for as long as the cache lives.
            if (response.ok && response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => Promise.reject(new Error('offline'))),
    ),
  );
});

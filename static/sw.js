/*
 * ER NextDex service worker.
 *
 * Strategy
 *  - App shell (HTML, CSS, JS, vendor, fonts, icons): served fast and kept
 *    fresh with stale-while-revalidate. A small critical set is precached on
 *    install so the very first offline visit still boots.
 *  - Navigations & game data JSON: network-first, falling back to cache when
 *    offline, so a freshly deployed dex / new game version always wins online.
 *  - Sprites: cache-first (they are immutable per name) to spare bandwidth.
 *
 * Bump CACHE_VERSION whenever the precache list or strategy changes.
 */
const CACHE_VERSION = 'v3';
const SHELL_CACHE = `erdex-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `erdex-runtime-${CACHE_VERSION}`;
const DATA_CACHE = `erdex-data-${CACHE_VERSION}`;
const SPRITE_CACHE = `erdex-sprites-${CACHE_VERSION}`;

// Critical shell precached on install (relative to the SW scope).
const PRECACHE_URLS = [
  './',
  './index.html',
  './css/core.css',
  './css/main.css',
  './css/reset.css',
  './css/teambuilder.css',
  './css/radial.css',
  './css/insanity.css',
  './css/pwa.css',
  './css/redesign.css',
  './css/themes/blueish.css',
  './css/themes/rushed.css',
  './css/themes/wood.css',
  './css/themes/blahaj.css',
  './vendor/fastdom.js',
  './vendor/jquery3.7.1.min.js',
  './js/index.js',
  './js/settings.js',
  './js/pwa.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.webmanifest',
];

const KNOWN_CACHES = [SHELL_CACHE, RUNTIME_CACHE, DATA_CACHE, SPRITE_CACHE];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Don't let one missing file abort the whole precache.
      Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('erdex-') && !KNOWN_CACHES.includes(k))
            .map((k) => caches.delete(k))
      );
      if (self.registration.navigationPreload) {
        try { await self.registration.navigationPreload.enable(); } catch (_e) { /* noop */ }
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isSprite(url) {
  return url.pathname.includes('/sprites/');
}
function isGameData(url) {
  return url.pathname.includes('/js/data/') && url.pathname.endsWith('.json');
}

async function networkFirst(request, cacheName, preloadResponse) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = (await preloadResponse) || await fetch(request);
    if (fresh && fresh.ok && request.method === 'GET') {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (_e) {
    const cached = await cache.match(request, { ignoreSearch: false }) ||
                   await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw _e;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((fresh) => {
      if (fresh && fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => undefined);
  return cached || network || fetch(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only handle our own origin; let cross-origin (CDN libs) pass through.
  if (url.origin !== self.location.origin) return;

  // App navigations: network-first so deploys land immediately, offline falls
  // back to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, SHELL_CACHE, event.preloadResponse)
        .catch(async () => (await caches.match('./index.html')) || Response.error())
    );
    return;
  }

  if (isSprite(url)) {
    event.respondWith(cacheFirst(request, SPRITE_CACHE));
    return;
  }

  if (isGameData(url)) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // CSS / JS / fonts / icons and everything else same-origin.
  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

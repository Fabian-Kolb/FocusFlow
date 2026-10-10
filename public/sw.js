/* FocusFlow Service Worker
 * - App-Shell offline verfügbar (index.html: Network-first mit Cache-Fallback)
 * - Gehashte Build-Dateien (/assets/*): Cache-first, ändern sich nie
 * - Icons & Manifest: Network-first (neues Logo kommt sofort), Google Fonts: Stale-while-revalidate
 * - /api/* und Firebase/Google-APIs werden NIE gecacht (Daten-Cache übernimmt Firestore selbst)
 */
const VERSION = 'v2';
const SHELL_CACHE = `ff-shell-${VERSION}`;
const ASSET_CACHE = `ff-assets-${VERSION}`;
const STATIC_CACHE = `ff-static-${VERSION}`;
const KNOWN_CACHES = [SHELL_CACHE, ASSET_CACHE, STATIC_CACHE];

const SHELL_URL = '/index.html';
const ASSET_CACHE_LIMIT = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.add(new Request(SHELL_URL, { cache: 'reload' })))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KNOWN_CACHES.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)));
  }
}

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(SHELL_URL, response.clone());
    return response;
  } catch {
    return (await cache.match(SHELL_URL)) || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
    trimCache(cacheName, ASSET_CACHE_LIMIT);
  }
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request, { cache: 'reload' });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      // Opaque Antworten (Fonts von gstatic ohne CORS) ebenfalls cachen
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Seitenaufrufe (SPA): immer frisch laden, offline die gecachte Shell zeigen
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request));
    return;
  }

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) return;
    if (url.pathname.startsWith('/assets/')) {
      event.respondWith(cacheFirst(request, ASSET_CACHE));
      return;
    }
    if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
      event.respondWith(networkFirst(request, STATIC_CACHE));
    }
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});

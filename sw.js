// Bump this version whenever a precached file changes.
const scope = self.registration.scope;
const prefix = 'spider-dxb:' + scope + ':';
const cacheName = prefix + 'v0.3.0-flat';
const home = new URL('index.html', scope).href;
const assets = new Set([
  'index.html',
  'mark.svg',
  'dubai-skyline.webp',
  'styles.css',
  'tools.css',
  'app.js',
  'tools.js',
  'tool-translations.js',
  'finance.js',
  'broker.css',
  'broker-store.js',
  'broker-records.js',
  'broker-record-translations.js',
  'broker-records.css',
  'broker-plans.js',
  'broker-proposal.js',
  'broker-proposal-translations.js',
  'broker-proposal.css',
  'broker-metrics.js',
  'broker-sales.js',
  'broker-sales-translations.js',
  'broker-sales.css',
].map((path) => new URL(path, scope).href));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...assets].map((url) => new Request(url, { cache: 'reload' })));
    // Activate only after the entire version is available offline.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(prefix) && name !== cacheName).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const resource = url.origin + url.pathname;
  if (request.mode === 'navigate' && (resource === scope || resource === home)) {
    event.respondWith(caches.open(cacheName).then(async (cache) => (await cache.match(home)) || fetch(request)));
  } else if (assets.has(url.href)) {
    event.respondWith(caches.open(cacheName).then(async (cache) => (await cache.match(request)) || fetch(request)));
  }
});

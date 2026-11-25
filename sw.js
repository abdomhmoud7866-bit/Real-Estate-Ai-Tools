// Bump this version whenever a precached file changes.
const scope = self.registration.scope;
const prefix = 'spider-dxb:' + scope + ':';
const cacheName = prefix + 'v2-flat';
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
].map((path) => new URL(path, scope).href));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => (
    cache.addAll([...assets].map((url) => new Request(url, { cache: 'reload' })))
  )));
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

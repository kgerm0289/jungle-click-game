const CACHE = 'jungle-cache-v1';

/* Bestanden die offline in de cache moeten */
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'jungle_background.png'
];

/* Install → voeg alles toe aan cache */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

/* Fetch → eerst uit cache, anders netwerk */
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});

// Service worker minimal pour Convergence 5 (mode PWA)
const CACHE_NAME = 'convergence5-static-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/master.html',
  '/player.html',
  '/leader.html',
  '/style.css',
  '/game.css',
  '/common.js',
  '/player.js',
  '/leader.js',
  '/master.js',
  '/mj.js',
  '/popup.js',
  '/data.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});


const CACHE_NAME = 'turkish-vocab-v4';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './words.json',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      // Кэшируем все локальные фото для офлайн-режима
      try {
        const res = await fetch('./words.json');
        const words = await res.json();
        const images = words
          .map(w => w.image)
          .filter(u => u && u.startsWith('./images/'));
        await Promise.allSettled(images.map(u => cache.add(u)));
      } catch { /* offline install */ }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Same origin: cache-first (работает офлайн)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        });
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Внешние картинки (если остались)
  if (url.hostname.includes('wikimedia.org') || url.hostname.includes('wikipedia.org')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          return cached || Response.error();
        }
      })
    );
  }
});

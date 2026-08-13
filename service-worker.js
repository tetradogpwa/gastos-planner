// Service Worker para Mis Gastos PWA
//
// IMPORTANTE: la versión está DUPLICADA aquí a propósito.
// El navegador detecta cambios del SW comparando bytes de este archivo;
// si la versión sólo se leyera via importScripts('./version.js'), cambiar
// version.js NO provocaría la reinstalación del SW y los usuarios se
// quedarían con la versión vieja cacheada.
// Por eso APP_VERSION vive como literal aquí, y hay que mantenerla en
// sincronía con version.js al sacar un release.
const APP_VERSION = 'v3.0.5';

const CACHE_NAME = 'mis-gastos-' + APP_VERSION;
const ASSETS = [
  './',
  './index.html',
  './version.js',
  './css/styles.css',
  './js/models.js',
  './js/storage.js',
  './js/actions.js',
  './js/ui.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

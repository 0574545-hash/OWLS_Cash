/* Service worker OWLS Cash: оболочка приложения кешируется для офлайна. */
const VERSION = 'owls-cash-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/fonts.css', './css/owls.css', './css/app.css',
  './js/icons.js', './js/owls-motion.js', './js/store.js', './js/app.js',
  './fonts/manrope-cyrillic.woff2', './fonts/manrope-latin.woff2',
  './fonts/unbounded-cyrillic.woff2', './fonts/unbounded-latin.woff2',
  './assets/owls_owl.png', './assets/icon-192.png', './assets/icon-512.png', './assets/apple-touch-icon.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === self.location.origin) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => hit))
  );
});

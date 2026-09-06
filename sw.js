/* Service worker OWLS Cash: оболочка приложения кешируется для офлайна. */
const VERSION = 'owls-cash-v9';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/fonts.css?v=9', './css/owls.css?v=9', './css/app.css?v=9',
  './js/icons.js?v=9', './js/owls-motion.js?v=9', './js/store.js?v=9', './js/app.js?v=9',
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
/* Сеть вперёд, кеш — запасной путь: онлайн всегда свежая версия,
   офлайн открывается из кеша. Кеш обновляется на каждом успешном ответе. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })
      .then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});

/* Service worker OWLS Cash: оболочка приложения кешируется для офлайна. */
const VERSION = 'owls-cash-v4';
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

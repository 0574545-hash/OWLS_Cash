/* Service worker OWLS Cash: оболочка приложения кешируется для офлайна. */
const VERSION = 'owls-cash-v53';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/fonts.css?v=53', './css/owls.css?v=53', './css/app.css?v=53',
  './js/icons.js?v=53', './js/owls-motion.js?v=53', './js/store.js?v=53', './js/app.js?v=53',
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
  /* Страница — мимо кеша браузера: GitHub Pages разрешает держать её 10 минут,
     и после выкладки телефон открывал старую страницу со старым кодом. Остальное
     с номером версии в адресе, ему кеш браузера не мешает. */
  const path = new URL(req.url).pathname;
  const fresh = req.mode === 'navigate' || path.endsWith('/') || path.endsWith('/index.html');
  e.respondWith(
    fetch(req, fresh ? { cache: 'no-store' } : undefined).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })
      .then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});

// Service worker: sayt internetsiz ishlashi va eslatmalarni ko'rsatish uchun
const CACHE = 'hisob-app-v1';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];
const DEFAULT_TEXT = "Bugungi xarajatlarni yozib qo'ying ✍️";

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Avval keshdan beradi (tez va internetsiz ishlaydi), orqada yangi versiyani yuklab qo'yadi
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;

  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(e.request);
    const fresh = fetch(e.request)
      .then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; })
      .catch(() => cached);
    return cached || fresh;
  }));
});

// Server "vaqt bo'ldi" deb signal yuboradi, gapni esa shu yerda tasodifiy tanlaymiz
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let list = [];
    try {
      const saved = await caches.match(new URL('config/messages', self.registration.scope));
      if (saved) list = await saved.json();
    } catch (err) { /* gaplar topilmasa, standart gap */ }
    const body = list.length ? list[Math.floor(Math.random() * list.length)] : DEFAULT_TEXT;
    await self.registration.showNotification('Hisoblab yur', {
      body,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: 'eslatma'
    });
  })());
});

// Eslatma bosilsa, ilovani ochadi
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' })
      .then((wins) => (wins[0] ? wins[0].focus() : self.clients.openWindow('./')))
  );
});

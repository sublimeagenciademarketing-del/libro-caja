const VERSION = '20260916T124146';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await clients.claim();
    const windows = await clients.matchAll({ type: 'window' });
    windows.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: VERSION }));
  })());
});

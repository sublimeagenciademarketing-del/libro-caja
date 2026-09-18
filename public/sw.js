const VERSION = '20260918T190130';

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

// Aviso push: siempre se muestra una notificación (iPhone lo exige) y se
// actualiza el número del ícono con lo que mande el servidor.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  const opciones = {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || undefined,
    data: { url: d.url || '/' },
  };
  const tareas = [self.registration.showNotification(d.title || 'MiCaja', opciones)];
  if (typeof d.badge === 'number' && 'setAppBadge' in self.navigator) {
    tareas.push(self.navigator.setAppBadge(d.badge).catch(() => {}));
  }
  e.waitUntil(Promise.all(tareas));
});

// Al tocar la notificación se abre (o se trae al frente) el app en la pantalla indicada.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil((async () => {
    const ventanas = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const abierta = ventanas.find(c => 'focus' in c);
    if (abierta) {
      if ('navigate' in abierta) { try { await abierta.navigate(url); } catch {} }
      return abierta.focus();
    }
    return clients.openWindow(url);
  })());
});

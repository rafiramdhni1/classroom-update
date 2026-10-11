self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    image: data.image,
    data: data.data || {},
    actions: data.actions || [
      { action: 'open', title: 'Buka Dashboard' },
      { action: 'dismiss', title: 'Tutup' },
    ],
    requireInteraction: data.requireInteraction !== false,
    tag: data.tag || 'notification',
    renotify: data.renotify !== false,
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  if (action === 'dismiss') {
    return;
  }

  const url = data.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', url });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('notificationclose', event => {
  console.log('[SW] Notification closed:', event.notification.tag);
});

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

console.log('[SW] Service Worker loaded for push notifications');
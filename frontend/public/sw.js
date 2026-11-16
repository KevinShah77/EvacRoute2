// EvacRoute Service Worker - Web Push Notification Handler

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {
    title: 'EVACROUTE – EMERGENCY ALERT',
    body: 'Emergency reported on campus. Open application for safe evacuation route.',
    url: '/emergency'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/shield-alert.svg',
    badge: '/shield-alert.svg',
    tag: data.tag || 'evacroute-emergency',
    requireInteraction: true,
    renotify: true,
    vibrate: [300, 100, 400, 100, 400],
    data: data.data || { url: data.url || '/emergency' },
    actions: [
      { action: 'open_map', title: 'Open Safe Route' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) 
    ? event.notification.data.url 
    : '/emergency';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Find open browser client
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Service Worker for Care Close push notifications
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Care Close';
    const scheduleId = data.scheduleId || '';
    const confirmUrl = scheduleId ? `/patient/home?confirm=${scheduleId}` : (data.url || '/patient/home');
    const options = {
        body: data.body || 'Hora de tomar seu medicamento!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.tag || 'med-reminder',
        renotify: true,
        requireInteraction: true,
        actions: [
            { action: 'confirm', title: 'Já tomei ✓' },
        ],
        data: { url: confirmUrl, scheduleId },
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    // Both action='confirm' and bare click route to the same URL — the home page
    // detects the ?confirm=<id> param and runs the confirm flow.
    const url = event.notification.data?.url || '/patient/home';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(url);
            }
        })
    );
});

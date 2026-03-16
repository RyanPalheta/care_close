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
    const options = {
        body: data.body || 'Hora de tomar seu medicamento!',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: data.tag || 'med-reminder',
        renotify: true,
        requireInteraction: true,
        actions: [
            { action: 'confirm', title: '✅ Tomado' },
            { action: 'snooze', title: '⏰ Lembrar em 10min' },
        ],
        data: { url: data.url || '/patient/home', scheduleId: data.scheduleId },
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/patient/home';
    if (event.action === 'snooze') {
        // Re-show after 10 minutes via setTimeout trick
        event.waitUntil(
            new Promise((resolve) => {
                setTimeout(() => {
                    self.registration.showNotification(
                        event.notification.title,
                        { ...event.notification.options, tag: 'snooze-' + Date.now() }
                    );
                    resolve();
                }, 10 * 60 * 1000);
            })
        );
    } else {
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
    }
});

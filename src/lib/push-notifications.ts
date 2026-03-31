// Care Close — Push Notification Utilities
// Uses the Web Push API + service worker for medication reminders

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

/** Register our service worker */
export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null
    try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        return reg
    } catch (e) {
        console.error('SW registration failed:', e)
        return null
    }
}

/** Request notification permission + subscribe to push */
export async function subscribeToPush(): Promise<PushSubscription | null> {
    const reg = await registerServiceWorker()
    if (!reg) return null

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    // If no VAPID key, skip server push — local notifications still work
    if (!VAPID_PUBLIC_KEY) return null

    try {
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: VAPID_PUBLIC_KEY,
        })
        return sub
    } catch {
        return null
    }
}

/** Schedule a local (non-server-push) notification using setTimeout + SW showNotification */
export function scheduleLocalNotification(params: {
    title: string
    body: string
    delayMs: number
    tag?: string
    url?: string
}) {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    setTimeout(async () => {
        const reg = await navigator.serviceWorker.ready
        reg.showNotification(params.title, {
            body: params.body,
            icon: '/icon-192.png',
            tag: params.tag || 'med-reminder',
            requireInteraction: true,
            data: { url: params.url || '/patient/home' },
        } as NotificationOptions)
    }, params.delayMs)
}

/** Cancel all pending local notifications for a tag */
export async function cancelNotification(tag: string) {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    const notifications = await reg.getNotifications({ tag })
    notifications.forEach(n => n.close())
}

/** Schedule today's pending medications for local push */
export async function scheduleMedNotifications(
    schedules: Array<{ id: string; scheduled_time: string; medication: { name: string; dosage: string; unit: string } }>,
    leadMinutes = 5
) {
    const now = new Date()
    for (const s of schedules) {
        const scheduledAt = new Date(s.scheduled_time)
        const notifyAt = new Date(scheduledAt.getTime() - leadMinutes * 60 * 1000)
        const delayMs = notifyAt.getTime() - now.getTime()
        if (delayMs <= 0) continue

        scheduleLocalNotification({
            title: `💊 ${s.medication.name}`,
            body: `${s.medication.dosage} ${s.medication.unit} — ${scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
            delayMs,
            tag: `med-${s.id}`,
            url: '/patient/home',
        })
    }
}

// Care Close — Web Push Notifications
// Persistent server-driven push via VAPID + service worker

import { supabase } from './supabase'

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

/** Register our service worker */
export async function registerServiceWorker() {
    if (typeof window === 'undefined') return null
    if (!('serviceWorker' in navigator)) return null
    try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        return reg
    } catch (e) {
        console.error('SW registration failed:', e)
        return null
    }
}

/** Convert base64 URL-safe string to ArrayBuffer (required by pushManager.subscribe) */
function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4)
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = atob(b64)
    const buf = new ArrayBuffer(raw.length)
    const view = new Uint8Array(buf)
    for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)
    return buf
}

/** Subscribe + persist on server. Returns true on success. */
export async function enablePushNotifications(leadMinutes = 5): Promise<{ ok: boolean; reason?: string }> {
    if (typeof window === 'undefined') return { ok: false, reason: 'ssr' }
    if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no-sw' }
    if (!('PushManager' in window)) return { ok: false, reason: 'no-push' }
    if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'no-vapid-key' }

    const reg = await registerServiceWorker()
    if (!reg) return { ok: false, reason: 'sw-register-failed' }

    // Wait until the SW is active
    await navigator.serviceWorker.ready

    // Permission
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, reason: 'permission-denied' }

    // Subscribe (or reuse existing subscription)
    let sub: PushSubscription | null = await reg.pushManager.getSubscription()
    if (!sub) {
        try {
            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
            })
        } catch (e: any) {
            console.error('pushManager.subscribe failed:', e)
            return { ok: false, reason: 'subscribe-failed' }
        }
    }

    // Persist on server
    const json = sub.toJSON()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { ok: false, reason: 'no-session' }

    const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
            endpoint: json.endpoint,
            keys: json.keys,
            leadMinutes,
        }),
    })

    if (!res.ok) {
        const err = await res.text()
        console.error('Failed to save subscription:', err)
        return { ok: false, reason: 'save-failed' }
    }

    return { ok: true }
}

/** Unsubscribe and clean up on server */
export async function disablePushNotifications(): Promise<void> {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return

    const sub = await reg.pushManager.getSubscription()
    if (!sub) return

    const endpoint = sub.endpoint

    try {
        await sub.unsubscribe()
    } catch { /* ignore */ }

    // Tell server to drop it
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
    }).catch(() => { })
}

/** Update lead_minutes for the current device's subscription (re-upserts) */
export async function updatePushLeadMinutes(leadMinutes: number) {
    return enablePushNotifications(leadMinutes)
}

/** Show an immediate local notification (used by "Testar" button) */
export async function showTestNotification() {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Care Close — Teste', { body: 'As notificações estão funcionando! 🎉' })
        }
        return
    }
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification('Care Close — Teste', {
        body: 'As notificações estão funcionando! 🎉',
        icon: '/icon-192.png',
        tag: 'test-notification',
    } as NotificationOptions)
}

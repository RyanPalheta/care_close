'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { enablePushNotifications } from '@/lib/push-notifications'

/**
 * Checks on every app entry whether medication reminders can actually reach
 * this device, and guides the user to fix whatever is wrong:
 *
 *  - permission never asked  → "Ativar lembretes" button (triggers the prompt)
 *  - permission denied       → step-by-step guide to unblock in the browser
 *  - iOS Safari (not PWA)    → guide to add to home screen first
 *  - granted but no device   → silent self-heal; visible retry if it fails
 *
 * Dismissable per session ("Agora não") — reappears on the next app entry,
 * because a patient without working reminders is a silent failure.
 */

type Issue = 'none' | 'ask' | 'denied' | 'ios-install' | 'unsupported' | 'sync-failed'

function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream
}

function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
        || (navigator as any).standalone === true
}

const DISMISS_KEY = 'cc_notif_nudge_dismissed'

export default function NotificationGuard() {
    const { user, profile } = useAuth()
    const [issue, setIssue] = useState<Issue>('none')
    const [showGuide, setShowGuide] = useState(false)
    const [working, setWorking] = useState(false)
    const [success, setSuccess] = useState(false)

    const evaluate = useCallback(async () => {
        if (typeof window === 'undefined') return
        if (sessionStorage.getItem(DISMISS_KEY)) { setIssue('none'); return }

        if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) {
            if (isIOS() && !isStandalone()) { setIssue('ios-install'); return }
            setIssue('unsupported')
            return
        }

        const perm = Notification.permission
        if (perm === 'default') { setIssue('ask'); return }
        if (perm === 'denied') { setIssue('denied'); return }

        // Permission granted — make sure this device actually has a live
        // push subscription (they expire / get pruned).
        try {
            const reg = await navigator.serviceWorker.getRegistration()
            const sub = reg ? await reg.pushManager.getSubscription() : null
            if (sub) { setIssue('none'); return }
            const r = await enablePushNotifications()
            setIssue(r.ok ? 'none' : 'sync-failed')
        } catch {
            setIssue('sync-failed')
        }
    }, [])

    useEffect(() => {
        if (!user) return
        // Only the personas that receive reminders — family/guests never do.
        if (profile && profile.role !== 'patient' && profile.role !== 'caregiver') return
        evaluate()
    }, [user, profile, evaluate])

    async function handleActivate() {
        setWorking(true)
        const r = await enablePushNotifications()
        setWorking(false)
        if (r.ok) {
            setSuccess(true)
            setTimeout(() => { setSuccess(false); setIssue('none') }, 2500)
        } else if (r.reason === 'permission-denied') {
            setIssue('denied')
        } else {
            setIssue('sync-failed')
        }
    }

    async function handleRecheck() {
        setShowGuide(false)
        await evaluate()
        if (Notification.permission === 'granted') {
            setSuccess(true)
            setTimeout(() => { setSuccess(false); setIssue('none') }, 2500)
        }
    }

    function dismiss() {
        sessionStorage.setItem(DISMISS_KEY, '1')
        setIssue('none')
        setShowGuide(false)
    }

    if (!user) return null
    if (issue === 'none' && !success) return null

    const S = {
        card: {
            position: 'fixed' as const,
            left: 16, right: 16, bottom: 92,
            maxWidth: 416, margin: '0 auto',
            zIndex: 45,
            background: 'white',
            borderRadius: 20,
            boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
            padding: '14px 16px',
            fontFamily: 'Lexend, sans-serif',
        },
        primaryBtn: {
            flex: 1,
            padding: '11px 14px',
            borderRadius: 14,
            border: 'none',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #42b6f0 0%, #7bc843 100%)',
            color: 'white',
            fontWeight: 800 as const,
            fontSize: 14,
            fontFamily: 'Lexend, sans-serif',
        },
        ghostBtn: {
            padding: '11px 14px',
            borderRadius: 14,
            border: 'none',
            cursor: 'pointer',
            background: '#f3f4f6',
            color: '#6b7280',
            fontWeight: 700 as const,
            fontSize: 13,
            fontFamily: 'Lexend, sans-serif',
        },
    }

    // Success flash
    if (success) {
        return (
            <div style={{ ...S.card, border: '2px solid #86efac', background: '#f0fdf4' }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#15803d' }}>
                    ✅ Lembretes ativados! Você receberá os avisos dos remédios neste celular.
                </p>
            </div>
        )
    }

    const copy: Record<Exclude<Issue, 'none'>, { title: string; body: string; action: string }> = {
        'ask': {
            title: '🔔 Ative os lembretes de remédios',
            body: 'Seus avisos ainda não estão ativados neste celular. Sem isso, o app não consegue te lembrar dos horários.',
            action: 'Ativar agora',
        },
        'denied': {
            title: '🔕 Os lembretes estão bloqueados',
            body: 'O navegador está bloqueando os avisos do Care Close. Leva menos de 1 minuto para liberar.',
            action: 'Ver como liberar',
        },
        'ios-install': {
            title: '📲 Instale o app para receber lembretes',
            body: 'No iPhone, os avisos só funcionam com o Care Close instalado na tela de início.',
            action: 'Ver como instalar',
        },
        'unsupported': {
            title: '⚠️ Navegador sem suporte a lembretes',
            body: 'Este navegador não recebe avisos. Abra o Care Close no Chrome para ativar os lembretes.',
            action: 'Entendi',
        },
        'sync-failed': {
            title: '🔔 Reative seus lembretes',
            body: 'O registro deste celular expirou e os avisos podem não chegar. Toque para reativar.',
            action: 'Reativar agora',
        },
    }

    const c = copy[issue as Exclude<Issue, 'none'>]

    return (
        <>
            <div style={S.card}>
                <p style={{ fontSize: 14.5, fontWeight: 800, color: '#111827', marginBottom: 4 }}>{c.title}</p>
                <p style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.5, marginBottom: 12 }}>{c.body}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        style={{ ...S.primaryBtn, opacity: working ? 0.7 : 1 }}
                        disabled={working}
                        onClick={() => {
                            if (issue === 'ask' || issue === 'sync-failed') handleActivate()
                            else if (issue === 'denied' || issue === 'ios-install') setShowGuide(true)
                            else dismiss()
                        }}
                    >
                        {working
                            ? <span style={{ width: 16, height: 16, border: '3px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.75s linear infinite', display: 'inline-block' }} />
                            : c.action}
                    </button>
                    <button style={S.ghostBtn} onClick={dismiss}>Agora não</button>
                </div>
            </div>

            {/* Step-by-step guide overlay (denied / iOS install) */}
            {showGuide && (
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
                    onClick={() => setShowGuide(false)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'white', width: '100%', maxWidth: 448,
                            borderRadius: '24px 24px 0 0', padding: '22px 22px 34px',
                            fontFamily: 'Lexend, sans-serif',
                        }}
                    >
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb', margin: '0 auto 18px' }} />
                        <p style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 14 }}>
                            {issue === 'denied' ? 'Como liberar os avisos' : 'Como instalar o Care Close'}
                        </p>

                        {(issue === 'denied' ? [
                            'Toque no cadeado 🔒 (ou nos três pontos ⋮) na barra de endereço do navegador',
                            'Entre em "Permissões" e procure "Notificações"',
                            'Mude para "Permitir"',
                            'Volte aqui e toque em "Já liberei"',
                        ] : [
                            'Toque no botão Compartilhar do Safari (quadrado com seta ↑)',
                            'Escolha "Adicionar à Tela de Início" e confirme',
                            'Abra o Care Close pelo novo ícone na tela de início',
                            'Ative os lembretes quando o app pedir',
                        ]).map((step, i) => (
                            <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                                <div style={{
                                    width: 26, height: 26, borderRadius: 9, flexShrink: 0,
                                    background: 'linear-gradient(135deg, #42b6f0, #7bc843)',
                                    color: 'white', fontWeight: 800, fontSize: 13,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>{i + 1}</div>
                                <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.5, paddingTop: 3 }}>{step}</p>
                            </div>
                        ))}

                        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                            {issue === 'denied' && (
                                <button style={S.primaryBtn} onClick={handleRecheck}>
                                    Já liberei ✓
                                </button>
                            )}
                            <button
                                style={issue === 'denied' ? S.ghostBtn : S.primaryBtn}
                                onClick={() => setShowGuide(false)}
                            >
                                {issue === 'denied' ? 'Fechar' : 'Entendi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

'use client'

import { useEffect, useRef, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'cc_install_dismissed'

export default function InstallPrompt() {
    const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)
    const [visible, setVisible] = useState(false)
    const [installing, setInstalling] = useState(false)

    useEffect(() => {
        // Capture the browser install prompt before it auto-fires
        const handler = (e: Event) => {
            e.preventDefault()
            deferredPrompt.current = e as BeforeInstallPromptEvent
        }
        window.addEventListener('beforeinstallprompt', handler)

        // Listen for signal from onboarding tour
        const showHandler = () => {
            if (deferredPrompt.current && !localStorage.getItem(STORAGE_KEY)) {
                setVisible(true)
            }
        }
        window.addEventListener('cc-show-install', showHandler)

        return () => {
            window.removeEventListener('beforeinstallprompt', handler)
            window.removeEventListener('cc-show-install', showHandler)
        }
    }, [])

    async function handleInstall() {
        if (!deferredPrompt.current) return
        setInstalling(true)
        await deferredPrompt.current.prompt()
        const { outcome } = await deferredPrompt.current.userChoice
        if (outcome === 'accepted') {
            localStorage.setItem(STORAGE_KEY, '1')
        }
        deferredPrompt.current = null
        setInstalling(false)
        setVisible(false)
    }

    function handleDismiss() {
        localStorage.setItem(STORAGE_KEY, '1')
        setVisible(false)
    }

    if (!visible) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[9998]"
                onClick={handleDismiss}
            />

            {/* Bottom sheet */}
            <div
                style={{
                    position: 'fixed',
                    bottom: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '100%',
                    maxWidth: '28rem',
                    zIndex: 9999,
                    animation: 'slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
                    fontFamily: 'Lexend, sans-serif',
                }}
            >
                <div style={{
                    background: 'white',
                    borderRadius: '24px 24px 0 0',
                    padding: '20px 20px 32px',
                    boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
                }}>
                    {/* Handle */}
                    <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb', margin: '0 auto 20px' }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                        {/* App icon */}
                        <div style={{
                            width: 60, height: 60, borderRadius: 16,
                            background: 'white', flexShrink: 0,
                            boxShadow: '0 4px 16px rgba(66,182,240,0.25), 0 2px 8px rgba(123,200,67,0.20)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden',
                        }}>
                            <img src="/icon-only.png" alt="Care Close" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
                        </div>

                        {/* Text */}
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 2 }}>
                                Instale o Care Close
                            </p>
                            <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>
                                Acesso rápido na tela inicial,{' '}
                                sem barra do navegador.
                            </p>
                        </div>

                        {/* Dismiss */}
                        <button
                            onClick={handleDismiss}
                            style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: '#f3f4f6', border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, fontSize: 14, color: '#9ca3af',
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Install button */}
                    <button
                        onClick={handleInstall}
                        disabled={installing}
                        style={{
                            width: '100%',
                            padding: '14px 20px',
                            borderRadius: 16,
                            border: 'none',
                            cursor: installing ? 'not-allowed' : 'pointer',
                            background: 'linear-gradient(135deg, #42b6f0 0%, #7bc843 100%)',
                            color: 'white',
                            fontWeight: 800,
                            fontSize: 15,
                            fontFamily: 'Lexend, sans-serif',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            boxShadow: '0 6px 20px rgba(66,182,240,0.35)',
                            opacity: installing ? 0.7 : 1,
                        }}
                    >
                        {installing ? (
                            <span style={{
                                width: 18, height: 18,
                                border: '3px solid rgba(255,255,255,0.4)',
                                borderTopColor: 'white',
                                borderRadius: '50%',
                                animation: 'spin 0.75s linear infinite',
                                display: 'inline-block',
                            }} />
                        ) : (
                            <>
                                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                Instalar
                            </>
                        )}
                    </button>
                </div>
            </div>
        </>
    )
}

'use client'

import { useEffect, useRef, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'cc_install_dismissed'

function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream
}

function isInStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches
        || (navigator as any).standalone === true
}

export default function InstallPrompt() {
    const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)
    const [visible, setVisible] = useState(false)
    const [installing, setInstalling] = useState(false)
    const [ios, setIos] = useState(false)

    useEffect(() => {
        if (localStorage.getItem(STORAGE_KEY)) return
        if (isInStandaloneMode()) return // already installed

        const onIOS = isIOS()
        setIos(onIOS)

        function tryShow() {
            if (onIOS) {
                // iOS doesn't support beforeinstallprompt — show manual guide
                setVisible(true)
                return
            }
            const early = (window as any).__deferredInstallPrompt as BeforeInstallPromptEvent | undefined
            if (early) {
                deferredPrompt.current = early
                delete (window as any).__deferredInstallPrompt
            }
            if (deferredPrompt.current) setVisible(true)
        }

        const onTourDone = () => tryShow()
        window.addEventListener('cc-show-install', onTourDone)

        // Existing users: show 3s after page load
        if (localStorage.getItem('cc_onboarding_done') || localStorage.getItem('cc_caregiver_onboarding_done')) {
            const t = setTimeout(tryShow, 3000)
            return () => {
                clearTimeout(t)
                window.removeEventListener('cc-show-install', onTourDone)
            }
        }

        // Listen for the event firing after mount (Android/Chrome)
        const handler = (e: Event) => {
            e.preventDefault()
            deferredPrompt.current = e as BeforeInstallPromptEvent
        }
        window.addEventListener('beforeinstallprompt', handler)

        return () => {
            window.removeEventListener('beforeinstallprompt', handler)
            window.removeEventListener('cc-show-install', onTourDone)
        }
    }, [])

    async function handleInstall() {
        if (!deferredPrompt.current) return
        setInstalling(true)
        await deferredPrompt.current.prompt()
        const { outcome } = await deferredPrompt.current.userChoice
        if (outcome === 'accepted') {
            localStorage.setItem(STORAGE_KEY, '1')
            setVisible(false)
        }
        deferredPrompt.current = null
        setInstalling(false)
    }

    function handleDismiss() {
        localStorage.setItem(STORAGE_KEY, '1')
        setVisible(false)
    }

    if (!visible) return null

    return (
        <>
            <div className="fixed inset-0 z-[9998]" onClick={handleDismiss} />

            <div style={{
                position: 'fixed',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '100%',
                maxWidth: '28rem',
                zIndex: 9999,
                animation: 'slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
                fontFamily: 'Lexend, sans-serif',
            }}>
                <div style={{
                    background: 'white',
                    borderRadius: '24px 24px 0 0',
                    padding: '20px 20px 36px',
                    boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
                }}>
                    {/* Handle */}
                    <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb', margin: '0 auto 20px' }} />

                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: ios ? 20 : 20 }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: 14, background: 'white', flexShrink: 0,
                            boxShadow: '0 4px 16px rgba(66,182,240,0.25), 0 2px 8px rgba(123,200,67,0.20)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                        }}>
                            <img src="/icon-only.png" alt="Care Close" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 2 }}>
                                Instale o Care Close
                            </p>
                            <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>
                                Acesso rápido na tela inicial, sem barra do navegador.
                            </p>
                        </div>
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

                    {ios ? (
                        /* iOS manual guide */
                        <div>
                            <div style={{
                                background: '#f8fafc',
                                borderRadius: 16,
                                padding: '14px 16px',
                                marginBottom: 14,
                                border: '1px solid #e2e8f0',
                            }}>
                                {[
                                    { icon: ShareIcon, text: 'Toque no botão Compartilhar  na barra do Safari' },
                                    { icon: PlusIcon, text: 'Selecione "Adicionar à Tela de Início"' },
                                    { icon: CheckIcon, text: 'Toque em "Adicionar" no canto superior direito' },
                                ].map((step, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < 2 ? 12 : 0 }}>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: 10,
                                            background: 'linear-gradient(135deg, #42b6f0 0%, #7bc843 100%)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        }}>
                                            <step.icon />
                                        </div>
                                        <p style={{ fontSize: 13, color: '#374151', fontWeight: 600, lineHeight: 1.4 }}>
                                            {step.text}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={handleDismiss}
                                style={{
                                    width: '100%', padding: '13px 20px', borderRadius: 16,
                                    border: 'none', cursor: 'pointer',
                                    background: 'linear-gradient(135deg, #42b6f0 0%, #7bc843 100%)',
                                    color: 'white', fontWeight: 800, fontSize: 15,
                                    fontFamily: 'Lexend, sans-serif',
                                    boxShadow: '0 6px 20px rgba(66,182,240,0.35)',
                                }}
                            >
                                Entendido!
                            </button>
                        </div>
                    ) : (
                        /* Android/Chrome install button */
                        <button
                            onClick={handleInstall}
                            disabled={installing}
                            style={{
                                width: '100%', padding: '14px 20px', borderRadius: 16,
                                border: 'none', cursor: installing ? 'not-allowed' : 'pointer',
                                background: 'linear-gradient(135deg, #42b6f0 0%, #7bc843 100%)',
                                color: 'white', fontWeight: 800, fontSize: 15,
                                fontFamily: 'Lexend, sans-serif',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
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
                    )}
                </div>
            </div>
        </>
    )
}

function ShareIcon() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
    )
}

function PlusIcon() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
    )
}

function CheckIcon() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}

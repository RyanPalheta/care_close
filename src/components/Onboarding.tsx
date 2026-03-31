'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface TourStep {
    id: string
    route: string
    title: string
    description: string
    accentColor: string
    // Hint shown inside the highlight (e.g. "Toque aqui")
    hint?: string
}

const STEPS: TourStep[] = [
    {
        id: 'next-med',
        route: '/patient/home',
        accentColor: '#42b6f0',
        title: 'Confirme seus remédios',
        description: 'Toque neste card para registrar que tomou o remédio. O horário e o estoque são atualizados automaticamente.',
        hint: 'Toque para confirmar',
    },
    {
        id: 'daily-goal',
        route: '/patient/home',
        accentColor: '#7c3aed',
        title: 'Sua meta diária',
        description: 'Este círculo mostra sua aderência do dia. Quanto mais cheio, melhor! Clique em "Agenda Completa" para ver o histórico.',
        hint: 'Veja seu progresso',
    },
    {
        id: 'add-med-fab',
        route: '/patient/medications',
        accentColor: '#7c3aed',
        title: 'Adicione um remédio',
        description: 'Toque aqui para cadastrar um novo medicamento: nome, dose, tipo e horário de uso. Você também define quantos comprimidos tem em estoque.',
        hint: 'Toque para adicionar',
    },
    {
        id: 'manage-tab',
        route: '/patient/medications',
        accentColor: '#f59e0b',
        title: 'Gerencie e acompanhe o estoque',
        description: 'Na aba "Gerenciar" você edita ou exclui remédios. O app avisa automaticamente quando o estoque estiver chegando ao fim!',
        hint: 'Editar · Excluir · Estoque',
    },
    {
        id: 'routine-water',
        route: '/patient/routine',
        accentColor: '#0ea5e9',
        title: 'Registre sua rotina',
        description: 'Anote aqui quantos copos de água tomou. Abaixo você também registra caminhada, exercício e qualidade da alimentação.',
        hint: 'Toque nos copinhos',
    },
    {
        id: 'reports-period',
        route: '/patient/reports',
        accentColor: '#6366f1',
        title: 'Acompanhe sua evolução',
        description: 'Escolha o período e veja gráficos de aderência. Você pode compartilhar o relatório por WhatsApp direto com seu médico ou familiar.',
        hint: 'Selecione o período',
    },
    {
        id: 'team-link',
        route: '/patient/profile',
        accentColor: '#0ea5e9',
        title: 'Convide sua equipe',
        description: 'Adicione familiares ou cuidadores para que possam acompanhar e registrar dados em tempo real. Cada pessoa recebe um link exclusivo.',
        hint: 'Compartilhar acesso',
    },
]

const PADDING = 10

export default function OnboardingTour() {
    const router = useRouter()
    const pathname = usePathname()
    const [active, setActive] = useState(false)
    const [step, setStep] = useState(0)
    const [rect, setRect] = useState<DOMRect | null>(null)
    const [tooltipBelow, setTooltipBelow] = useState(true)

    // Auto-start on first visit + listen for manual trigger
    useEffect(() => {
        if (!localStorage.getItem('cc_onboarding_done')) {
            setActive(true)
        }
        const handleStart = () => {
            setStep(0)
            setRect(null)
            setActive(true)
        }
        window.addEventListener('cc-start-tour', handleStart)
        return () => window.removeEventListener('cc-start-tour', handleStart)
    }, [])

    const findAndHighlight = useCallback(() => {
        if (!active) return
        const current = STEPS[step]

        if (pathname !== current.route) {
            router.push(current.route)
            return
        }

        let attempts = 0
        const tryFind = () => {
            const el = document.querySelector(`[data-onboarding="${current.id}"]`) as HTMLElement | null
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                setTimeout(() => {
                    const r = el.getBoundingClientRect()
                    setRect(r)
                    // Put tooltip below element if element is in top half of screen
                    setTooltipBelow(r.top < window.innerHeight * 0.55)
                }, 420)
            } else if (attempts < 20) {
                attempts++
                setTimeout(tryFind, 150)
            } else {
                // Element not found — skip this step silently
                handleNext()
            }
        }
        tryFind()
    }, [active, step, pathname]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (active) {
            setRect(null) // clear old highlight while transitioning
            findAndHighlight()
        }
    }, [active, step, pathname, findAndHighlight])

    // Re-measure on resize / scroll
    useEffect(() => {
        if (!active || !rect) return
        const current = STEPS[step]
        const onUpdate = () => {
            const el = document.querySelector(`[data-onboarding="${current.id}"]`) as HTMLElement | null
            if (el) {
                const r = el.getBoundingClientRect()
                setRect(r)
                setTooltipBelow(r.top < window.innerHeight * 0.55)
            }
        }
        window.addEventListener('resize', onUpdate)
        window.addEventListener('scroll', onUpdate, true)
        return () => {
            window.removeEventListener('resize', onUpdate)
            window.removeEventListener('scroll', onUpdate, true)
        }
    }, [active, rect, step])

    function handleNext() {
        if (step < STEPS.length - 1) {
            setStep(s => s + 1)
        } else {
            handleClose()
        }
    }

    function handleClose() {
        localStorage.setItem('cc_onboarding_done', '1')
        setActive(false)
        setRect(null)
    }

    if (!active) return null

    const current = STEPS[step]
    const isLast = step === STEPS.length - 1
    const tooltipWidth = Math.min(300, window.innerWidth - 32)

    // Tooltip horizontal position: center on highlighted element, but keep inside screen
    const tooltipLeft = rect
        ? Math.max(16, Math.min(
            rect.left + rect.width / 2 - tooltipWidth / 2,
            window.innerWidth - tooltipWidth - 16
        ))
        : 16

    // Arrow horizontal offset relative to tooltip left
    const arrowLeft = rect
        ? Math.max(16, Math.min(
            rect.left + rect.width / 2 - tooltipLeft - 8,
            tooltipWidth - 24
        ))
        : 20

    return (
        <>
            {/* Full-screen click-blocker (tap outside = next) */}
            <div
                style={{ position: 'fixed', inset: 0, zIndex: 9990, cursor: 'pointer' }}
                onClick={handleNext}
            />

            {/* Spotlight */}
            {rect && (
                <div
                    style={{
                        position: 'fixed',
                        top: rect.top - PADDING,
                        left: rect.left - PADDING,
                        width: rect.width + PADDING * 2,
                        height: rect.height + PADDING * 2,
                        borderRadius: 18,
                        boxShadow: `0 0 0 9999px rgba(0,0,0,0.72)`,
                        border: `2.5px solid ${current.accentColor}`,
                        zIndex: 9991,
                        pointerEvents: 'none',
                        transition: 'top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease',
                        animation: 'tourPulse 2s ease-in-out infinite',
                    }}
                />
            )}

            {/* Hint label inside spotlight */}
            {rect && current.hint && (
                <div
                    style={{
                        position: 'fixed',
                        top: rect.bottom + PADDING + 6,
                        left: rect.left + PADDING,
                        zIndex: 9992,
                        pointerEvents: 'none',
                        background: current.accentColor,
                        color: 'white',
                        fontSize: 11,
                        fontWeight: 800,
                        fontFamily: 'Lexend, sans-serif',
                        padding: '3px 10px',
                        borderRadius: 100,
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.03em',
                        boxShadow: `0 4px 12px ${current.accentColor}55`,
                    }}
                >
                    {current.hint}
                </div>
            )}

            {/* Tooltip card */}
            {rect && (
                <div
                    style={{
                        position: 'fixed',
                        zIndex: 9993,
                        width: tooltipWidth,
                        left: tooltipLeft,
                        fontFamily: 'Lexend, sans-serif',
                        ...(tooltipBelow
                            ? { top: rect.bottom + PADDING + (current.hint ? 32 : 12) }
                            : { bottom: window.innerHeight - rect.top + PADDING + 12 }
                        ),
                        animation: 'fadeInUp 0.25s ease forwards',
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Arrow pointing UP toward element (when tooltip is below) */}
                    {tooltipBelow && (
                        <div style={{
                            width: 0, height: 0,
                            borderLeft: '9px solid transparent',
                            borderRight: '9px solid transparent',
                            borderBottom: '9px solid white',
                            marginLeft: arrowLeft,
                            marginBottom: -1,
                            filter: 'drop-shadow(0 -2px 2px rgba(0,0,0,0.08))',
                        }} />
                    )}

                    {/* Card */}
                    <div style={{
                        background: 'white',
                        borderRadius: 24,
                        padding: '18px 20px 16px',
                        boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
                    }}>
                        {/* Header row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ display: 'flex', gap: 5 }}>
                                {STEPS.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setStep(i)}
                                        style={{
                                            width: i === step ? 20 : 6,
                                            height: 6,
                                            borderRadius: 3,
                                            background: i === step ? current.accentColor : '#e5e7eb',
                                            border: 'none',
                                            padding: 0,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    />
                                ))}
                            </div>
                            <button
                                onClick={handleClose}
                                style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px' }}
                            >
                                Pular tour
                            </button>
                        </div>

                        <p style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginBottom: 6, lineHeight: 1.3 }}>
                            {current.title}
                        </p>
                        <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.55, marginBottom: 16 }}>
                            {current.description}
                        </p>

                        <button
                            onClick={handleNext}
                            style={{
                                width: '100%',
                                padding: '11px 16px',
                                borderRadius: 14,
                                background: isLast ? '#4ade80' : current.accentColor,
                                color: 'white',
                                fontWeight: 800,
                                fontSize: 14,
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: isLast ? '0 6px 20px rgba(74,222,128,0.3)' : `0 6px 20px ${current.accentColor}44`,
                                fontFamily: 'Lexend, sans-serif',
                            }}
                        >
                            {isLast ? '✅ Tudo certo, obrigado!' : `Próximo →`}
                        </button>
                    </div>

                    {/* Arrow pointing DOWN toward element (when tooltip is above) */}
                    {!tooltipBelow && (
                        <div style={{
                            width: 0, height: 0,
                            borderLeft: '9px solid transparent',
                            borderRight: '9px solid transparent',
                            borderTop: '9px solid white',
                            marginLeft: arrowLeft,
                            marginTop: -1,
                            filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.08))',
                        }} />
                    )}
                </div>
            )}

            {/* Loading spinner while navigating / finding element */}
            {!rect && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9994,
                    background: 'rgba(0,0,0,0.72)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                }}>
                    <div style={{
                        width: 44, height: 44,
                        border: '4px solid rgba(255,255,255,0.2)',
                        borderTopColor: 'white',
                        borderRadius: '50%',
                        animation: 'spin 0.75s linear infinite',
                    }} />
                </div>
            )}
        </>
    )
}

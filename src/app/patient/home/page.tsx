'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { generateAllSchedulesForPatient } from '@/lib/schedule-generator'
import { scheduleMedNotifications, registerServiceWorker } from '@/lib/push-notifications'
import {
    IconHome, IconPill, IconRoutine, IconBarChart,
    IconCalendar, IconCheckCircle, IconClock, IconSkip, IconXCircle, IconX, IconBell
} from '@/components/Icons'

interface MedSchedule {
    id: string
    scheduled_time: string
    status: 'pending' | 'taken' | 'missed' | 'skipped'
    taken_at: string | null
    medication: {
        id: string
        name: string
        dosage: string
        unit: string
        instructions: string | null
        stock_quantity: number
        stock_alert_at: number
        needs_prep: boolean
        prep_minutes: number | null
    }
}

export default function PatientHomePage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [schedules, setSchedules] = useState<MedSchedule[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState<MedSchedule | null>(null)
    const [confirmingDose, setConfirmingDose] = useState(false)
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [showNotifications, setShowNotifications] = useState(false)

    const loadSchedules = useCallback(async () => {
        if (!user) return

        // Find patient linked to this user
        const { data: patient } = await supabase
            .from('patients')
            .select('id, avatar_url')
            .eq('user_id', user.id)
            .maybeSingle()

        if (!patient) { setLoading(false); return }

        if (patient.avatar_url) setAvatarUrl(patient.avatar_url)

        await generateAllSchedulesForPatient(patient.id)

        const today = new Date()
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

        const { data } = await supabase
            .from('medication_schedules')
            .select(`
        id, scheduled_time, status, taken_at,
        medication:medications!medication_id (id, name, dosage, unit, instructions, stock_quantity, stock_alert_at, needs_prep, prep_minutes)
      `)
            .eq('patient_id', patient.id)
            .gte('scheduled_time', startOfDay)
            .lt('scheduled_time', endOfDay)
            .order('scheduled_time', { ascending: true })

        setSchedules((data as unknown as MedSchedule[]) ?? [])
        setLoading(false)

        // Schedule local push notifications for pending meds
        const pending = (data as unknown as MedSchedule[])?.filter(s => s.status === 'pending') ?? []
        if (pending.length > 0) {
            registerServiceWorker()
            scheduleMedNotifications(pending as any, 5)
        }
    }, [user])

    useEffect(() => {
        if (!authLoading && user) loadSchedules()
        else if (!authLoading) setLoading(false)
    }, [authLoading, user, loadSchedules])

    const takenCount = schedules.filter(s => s.status === 'taken').length
    const totalCount = schedules.length
    const progress = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0
    const nextPending = schedules.find(s => s.status === 'pending')

    async function confirmDose(schedule: MedSchedule) {
        setConfirmingDose(true)
        await supabase.from('medication_schedules').update({
            status: 'taken',
            taken_at: new Date().toISOString(),
            taken_by: user!.id,
        }).eq('id', schedule.id)
        if (schedule.medication.stock_quantity > 0) {
            await supabase.from('medications')
                .update({ stock_quantity: schedule.medication.stock_quantity - 1 })
                .eq('id', schedule.medication.id)
        }
        setShowModal(null)
        setConfirmingDose(false)
        loadSchedules()
    }

    function formatTime(iso: string) {
        return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }

    const userName = profile?.name?.split(' ')[0] ?? 'Você'
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

    // Circular progress
    const circleRadius = 30
    const circleCircumference = 2 * Math.PI * circleRadius
    const strokeDashoffset = circleCircumference - (progress / 100) * circleCircumference

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f7f8fc]">
                <span className="w-10 h-10 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#f7f8fc] pb-28" style={{ fontFamily: 'Lexend, sans-serif' }}>

            {/* ── Header ─────────────────────────────────────── */}
            <div className="bg-white px-5 pt-12 pb-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <Link href="/patient/profile" className="flex items-center gap-3 active:scale-95 transition-transform">
                        <div className="w-11 h-11 rounded-2xl overflow-hidden bg-gradient-to-br from-sky-200 to-sky-300 flex-shrink-0">
                            {avatarUrl
                                ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                                    {userName[0]}
                                </div>}
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-medium">{greeting},</p>
                            <h1 className="text-lg font-extrabold text-gray-900 leading-tight">{userName}</h1>
                        </div>
                    </Link>
                    <button
                        onClick={() => setShowNotifications(true)}
                        className="w-10 h-10 rounded-xl bg-[#fef3f3] flex items-center justify-center relative"
                    >
                        <IconBell size={20} color="#f87171" />
                        {schedules.some(s => s.status === 'pending') && (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-[#f87171] rounded-full" />
                        )}
                    </button>
                </div>
            </div>

            <div className="px-4 pt-4 flex flex-col gap-4">

                {/* ── Next Medication Card ───────────────────── */}
                {nextPending ? (
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">Próximo Medicamento</p>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-[#f0f8ff] flex items-center justify-center">
                                    <IconPill size={24} color="#42b6f0" />
                                </div>
                                <div>
                                    <p className="font-extrabold text-gray-900 text-base leading-tight">
                                        {nextPending.medication.name}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {nextPending.medication.dosage} {nextPending.medication.unit}
                                        {nextPending.medication.instructions && (
                                            <> · <span className="text-gray-500">{nextPending.medication.instructions}</span></>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <span className="text-sm font-bold text-[#42b6f0] bg-[#f0f8ff] px-3 py-1.5 rounded-xl">
                                {formatTime(nextPending.scheduled_time)}
                            </span>
                        </div>
                        <button
                            onClick={() => setShowModal(nextPending)}
                            className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-100"
                        >
                            <IconCheckCircle size={18} color="white" /> Confirmar Ingestão
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 text-center">
                        <div className="w-14 h-14 bg-[#f0fdf4] rounded-full flex items-center justify-center mx-auto mb-2">
                            <IconCheckCircle size={28} color="#4ade80" />
                        </div>
                        <p className="font-bold text-emerald-700 text-sm">Todas as doses de hoje foram tomadas!</p>
                    </div>
                )}

                {/* ── Quick Actions Row ─────────────────────── */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Daily Goal */}
                    <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="relative w-[76px] h-[76px] flex-shrink-0">
                            <svg width={76} height={76} viewBox="0 0 76 76">
                                <circle cx={38} cy={38} r={circleRadius} fill="none" stroke="#f0f8ff" strokeWidth={7} />
                                <circle
                                    cx={38} cy={38} r={circleRadius}
                                    fill="none"
                                    stroke={progress >= 100 ? '#4ade80' : progress >= 50 ? '#42b6f0' : '#f87171'}
                                    strokeWidth={7}
                                    strokeLinecap="round"
                                    strokeDasharray={circleCircumference}
                                    strokeDashoffset={strokeDashoffset}
                                    transform="rotate(-90 38 38)"
                                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-lg font-black text-gray-900 leading-none">{progress}%</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-medium">Meta Diária</p>
                            <p className="text-2xl font-black text-gray-900 leading-tight">{takenCount}<span className="text-sm font-semibold text-gray-400">/{totalCount}</span></p>
                        </div>
                    </div>

                    {/* Calendar Button */}
                    <Link
                        href="/patient/calendar"
                        className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-[#f0f8ff] transition-colors"
                    >
                        <div className="w-12 h-12 bg-[#f0f8ff] rounded-2xl flex items-center justify-center">
                            <IconCalendar size={24} color="#42b6f0" />
                        </div>
                        <p className="text-sm font-bold text-gray-800 text-center">Agenda Completa</p>
                    </Link>
                </div>

                {/* ── Today's Schedule ──────────────────────── */}
                <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3 px-1">Próximos Hoje</p>

                    {schedules.length === 0 ? (
                        <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-100">
                            <IconPill size={36} color="#cbd5e1" />
                            <p className="text-gray-400 text-sm mt-3 font-medium">Nenhum medicamento hoje</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {schedules.map(schedule => {
                                const isTaken = schedule.status === 'taken'
                                const isPending = schedule.status === 'pending'
                                const isMissed = schedule.status === 'missed'

                                return (
                                    <button
                                        key={schedule.id}
                                        onClick={() => isPending ? setShowModal(schedule) : undefined}
                                        className={`bg-white rounded-2xl px-4 py-3.5 w-full text-left flex items-center gap-3 border transition-all
                                            ${isPending ? 'border-[#42b6f0]/20 shadow-sm active:scale-[0.99]' : 'border-gray-100 opacity-75'}
                                            ${isTaken ? 'border-l-4 border-l-[#4ade80]' : ''}
                                            ${isMissed ? 'border-l-4 border-l-[#f87171]' : ''}
                                        `}
                                    >
                                        {/* Status icon */}
                                        <div className="flex-shrink-0">
                                            {isTaken && <IconCheckCircle size={20} color="#4ade80" />}
                                            {isPending && <div className="w-5 h-5 rounded-full border-2 border-[#42b6f0]" />}
                                            {isMissed && <IconXCircle size={20} color="#f87171" />}
                                            {schedule.status === 'skipped' && <IconSkip size={20} color="#94a3b8" />}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-semibold text-sm leading-tight ${isTaken ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                                {schedule.medication.name}
                                            </p>
                                            {schedule.medication.instructions && (
                                                <p className="text-xs text-gray-400 mt-0.5 truncate">{schedule.medication.instructions}</p>
                                            )}
                                        </div>

                                        {/* Time badge */}
                                        <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-xl 
                                            ${isPending ? 'text-[#42b6f0] bg-[#f0f8ff]' : 'text-gray-400 bg-gray-50'}`}>
                                            {formatTime(schedule.scheduled_time)}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                <Link href="/patient/home" className="bottom-nav-item active">
                    <IconHome size={22} color="#42b6f0" />
                    <span>Início</span>
                </Link>
                <Link href="/patient/medications" className="bottom-nav-item">
                    <IconPill size={22} />
                    <span>Remédios</span>
                </Link>
                <Link href="/patient/routine" className="bottom-nav-item">
                    <IconRoutine size={22} />
                    <span>Rotina</span>
                </Link>
                <Link href="/patient/reports" className="bottom-nav-item">
                    <IconBarChart size={22} />
                    <span>Relatórios</span>
                </Link>
            </nav>

            {/* ── Dose Confirmation Modal ──────────────────── */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center backdrop-blur-sm" onClick={() => !confirmingDose && setShowModal(null)}>
                    <div
                        className="bg-white w-full max-w-md rounded-t-[2rem] p-6 pb-10 shadow-2xl"
                        style={{ fontFamily: 'Lexend, sans-serif' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-[#f0f8ff] flex items-center justify-center mx-auto mb-3">
                                <IconPill size={32} color="#42b6f0" />
                            </div>
                            <h3 className="text-xl font-extrabold text-gray-900 mb-1">{showModal.medication.name}</h3>
                            <p className="text-gray-400 text-sm font-medium">
                                {showModal.medication.dosage} {showModal.medication.unit}
                                <span className="mx-1.5 text-gray-200">·</span>
                                <span className="text-[#f87171] font-bold">{formatTime(showModal.scheduled_time)}</span>
                            </p>
                            {showModal.medication.instructions && (
                                <p className="text-sm text-gray-500 bg-gray-50 rounded-2xl px-4 py-3 mt-4 text-left">
                                    {showModal.medication.instructions}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => confirmDose(showModal)}
                                disabled={confirmingDose}
                                className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-200 disabled:opacity-60"
                            >
                                {confirmingDose
                                    ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    : <><IconCheckCircle size={18} color="white" /> Confirmar que tomei</>}
                            </button>
                            <button onClick={() => setShowModal(null)} disabled={confirmingDose}
                                className="w-full py-3.5 rounded-2xl border-2 border-gray-100 text-sm font-bold text-gray-400 hover:bg-gray-50 transition-colors">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Notification Panel ──────────────────────── */}
            {showNotifications && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="flex-1 bg-black/40" onClick={() => setShowNotifications(false)} />
                    <div className="w-80 bg-white h-full shadow-2xl flex flex-col" style={{ fontFamily: 'Lexend, sans-serif' }}>
                        <div className="flex items-center justify-between px-5 pt-12 pb-4 border-b border-gray-100">
                            <h2 className="text-lg font-extrabold text-gray-900">Notificações</h2>
                            <button onClick={() => setShowNotifications(false)} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
                                <IconX size={16} color="#374151" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
                            {schedules.length === 0 && (
                                <p className="text-gray-400 text-sm text-center py-10">Nenhuma notificação hoje</p>
                            )}

                            {/* Pending first */}
                            {schedules.filter(s => s.status === 'pending').map(s => (
                                <div key={s.id} className="bg-amber-50 border border-amber-100 rounded-2xl p-3.5 flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                                        <IconClock size={18} color="#f59e0b" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-900 text-sm truncate">{s.medication.name}</p>
                                        <p className="text-xs text-amber-600 font-medium">{formatTime(s.scheduled_time)} · Pendente</p>
                                    </div>
                                </div>
                            ))}

                            {/* Taken */}
                            {schedules.filter(s => s.status === 'taken').map(s => (
                                <div key={s.id} className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5 flex items-center gap-3 opacity-70">
                                    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                                        <IconCheckCircle size={18} color="#4ade80" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-700 text-sm truncate">{s.medication.name}</p>
                                        <p className="text-xs text-emerald-600 font-medium">{formatTime(s.scheduled_time)} · Tomado</p>
                                    </div>
                                </div>
                            ))}

                            {/* Missed */}
                            {schedules.filter(s => s.status === 'missed').map(s => (
                                <div key={s.id} className="bg-red-50 border border-red-100 rounded-2xl p-3.5 flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                                        <IconXCircle size={18} color="#f87171" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-900 text-sm truncate">{s.medication.name}</p>
                                        <p className="text-xs text-red-500 font-medium">{formatTime(s.scheduled_time)} · Perdido</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-gray-100 p-4">
                            <Link
                                href="/patient/profile"
                                onClick={() => setShowNotifications(false)}
                                className="w-full py-3 rounded-2xl bg-[#f0f8ff] text-[#42b6f0] text-sm font-bold flex items-center justify-center gap-2"
                            >
                                <IconBell size={16} color="#42b6f0" />
                                Configurar Notificações
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}


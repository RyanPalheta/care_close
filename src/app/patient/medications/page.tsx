'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import {
    IconHome, IconPill, IconRoutine, IconBarChart,
    IconCalendar, IconCheckCircle, IconXCircle, IconAlertCircle, IconBell, IconPlus,
} from '@/components/Icons'

type Day = 'hoje' | 'amanha'

interface Medication {
    id: string
    name: string
    dosage: string
    unit: string
    frequency: string
    period: string | null
    stock_quantity: number
    active: boolean
}

interface DaySchedule {
    id: string
    scheduled_time: string
    status: 'pending' | 'taken' | 'missed' | 'skipped'
    medication: Medication
}

const PERIOD_MAP: Record<string, { label: string; sub: string }> = {
    antes_cafe: { label: 'Manhã', sub: 'Antes do café' },
    depois_cafe: { label: 'Manhã', sub: 'Depois do café' },
    antes_almoco: { label: 'Tarde', sub: 'Antes do almoço' },
    depois_almoco: { label: 'Tarde', sub: 'Depois do almoço' },
    antes_jantar: { label: 'Noite', sub: 'Antes do jantar' },
    depois_jantar: { label: 'Noite', sub: 'Depois do jantar' },
}

const PERIOD_COLORS = {
    Manhã: { bg: 'bg-[#fef9c3]', dot: '#f59e0b', text: 'text-[#92400e]' },
    Tarde: { bg: 'bg-[#dbeafe]', dot: '#3b82f6', text: 'text-[#1e40af]' },
    Noite: { bg: 'bg-[#ede9fe]', dot: '#7c3aed', text: 'text-[#5b21b6]' },
    Outros: { bg: 'bg-[#f3f4f6]', dot: '#6b7280', text: 'text-[#374151]' },
}

const PERIOD_ICONS = {
    Manhã: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
    ),
    Tarde: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
    ),
    Noite: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
    ),
    Outros: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
        </svg>
    ),
}

function getLocalDayBounds(selectedDay: Day): { startOfDay: string; endOfDay: string; label: string } {
    const now = new Date()
    const targetDate = selectedDay === 'amanha'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const year = targetDate.getFullYear()
    const month = String(targetDate.getMonth() + 1).padStart(2, '0')
    const day = String(targetDate.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`

    const label = targetDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

    return {
        startOfDay: `${dateStr}T00:00:00`,
        endOfDay: `${dateStr}T23:59:59`,
        label: label.charAt(0).toUpperCase() + label.slice(1),
    }
}

export default function MedicationsPage() {
    const router = useRouter()
    const { user, loading: authLoading } = useAuth()

    const [selectedDay, setSelectedDay] = useState<Day>('hoje')
    const [schedules, setSchedules] = useState<DaySchedule[]>([])
    const [medications, setMedications] = useState<Medication[]>([])
    const [loading, setLoading] = useState(true)
    const [patientId, setPatientId] = useState<string | null>(null)

    const { startOfDay, endOfDay, label: targetDateLabel } = getLocalDayBounds(selectedDay)

    const loadData = useCallback(async () => {
        if (!user) return
        setLoading(true)

        // Get patient
        const { data: patient } = await supabase
            .from('patients')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle()

        if (!patient) { setLoading(false); return }
        setPatientId(patient.id)

        const { startOfDay, endOfDay } = getLocalDayBounds(selectedDay)

        // Load medications (for stock info)
        const { data: meds } = await supabase
            .from('medications')
            .select('id, name, dosage, unit, frequency, period, stock_quantity, active')
            .eq('patient_id', patient.id)
            .eq('active', true)

        setMedications((meds as Medication[]) ?? [])

        // Load today's/tomorrow's schedules
        const { data: sched, error } = await supabase
            .from('medication_schedules')
            .select(`
                id, scheduled_time, status,
                medication:medications!medication_id (id, name, dosage, unit, frequency, period, stock_quantity, active)
            `)
            .eq('patient_id', patient.id)
            .gte('scheduled_time', startOfDay)
            .lte('scheduled_time', endOfDay)
            .order('scheduled_time', { ascending: true })

        if (error) {
            console.error('Error loading schedules:', error)
        } else {
            setSchedules((sched as unknown as DaySchedule[]) ?? [])
        }

        setLoading(false)
    }, [user, selectedDay])

    useEffect(() => {
        if (!authLoading && user) loadData()
    }, [authLoading, user, selectedDay])

    // Group schedules by period label
    const periodGroups: Record<string, DaySchedule[]> = {}
    for (const s of schedules) {
        const p = s.medication?.period
        const group = p ? (PERIOD_MAP[p]?.label ?? 'Outros') : 'Outros'
        if (!periodGroups[group]) periodGroups[group] = []
        periodGroups[group].push(s)
    }
    const groupOrder = ['Manhã', 'Tarde', 'Noite', 'Outros']

    // Status counts
    const taken = schedules.filter(s => s.status === 'taken').length
    const total = schedules.length
    const allGood = total > 0 && taken === total
    const missingMeds = schedules.filter(s => s.status === 'missed').length
    const pending = schedules.filter(s => s.status === 'pending').length
    const lowStock = medications.filter(m => m.stock_quantity <= 5 && m.stock_quantity > 0)

    const heroStatus = allGood
        ? { label: 'Tudo em dia!', color: '#4ade80', bg: 'from-emerald-400 to-teal-500' }
        : missingMeds > 0
            ? { label: `${missingMeds} remédio(s) perdido(s)`, color: '#f87171', bg: 'from-rose-400 to-red-500' }
            : pending > 0
                ? { label: `${pending} pendente(s) hoje`, color: '#fbbf24', bg: 'from-amber-400 to-orange-400' }
                : { label: 'Nenhum remédio hoje', color: '#94a3b8', bg: 'from-slate-300 to-slate-400' }

    function formatTime(iso: string) {
        return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="min-h-screen bg-[#f7f8fc] pb-28" style={{ fontFamily: 'Lexend, sans-serif' }}>

            {/* ── Hero Banner ─────────────────────── */}
            <div className={`bg-gradient-to-br ${heroStatus.bg} px-5 pt-12 pb-8 relative overflow-hidden`}>
                <div className="absolute top-[-40px] right-[-40px] w-40 h-40 rounded-full bg-white/10" />
                <div className="absolute bottom-[-20px] left-[-20px] w-24 h-24 rounded-full bg-white/10" />

                {/* Header row */}
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <div>
                        <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Meus Remédios</p>
                        <h1 className="text-white text-2xl font-black leading-tight mt-1">{heroStatus.label}</h1>
                    </div>
                </div>

                {/* Stats row */}
                <div className="flex gap-3 relative z-10">
                    {[
                        { val: taken, label: 'Tomados' },
                        { val: pending, label: 'Pendentes' },
                        { val: total, label: 'Remédios' },
                    ].map(stat => (
                        <div key={stat.label} className="flex-1 bg-white/20 backdrop-blur-sm rounded-2xl py-3 text-center">
                            <p className="text-white text-2xl font-black leading-none">{stat.val}</p>
                            <p className="text-white/70 text-[10px] font-semibold mt-0.5 uppercase tracking-wide">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="px-4 pt-4">

                {/* ── Day Selector ──────────────────────── */}
                <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 flex gap-1 mb-4">
                    {(['hoje', 'amanha'] as Day[]).map(d => (
                        <button
                            key={d}
                            onClick={() => setSelectedDay(d)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all
                                ${selectedDay === d
                                    ? 'bg-[#7c3aed] text-white shadow-md shadow-violet-100'
                                    : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            {d === 'hoje' ? 'Hoje' : 'Amanhã'}
                        </button>
                    ))}
                    <button
                        onClick={() => router.push('/patient/calendar')}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1.5"
                    >
                        <IconCalendar size={14} color="#94a3b8" />
                        Calendário
                    </button>
                </div>

                {/* Date label */}
                <p className="text-xs text-gray-400 font-medium capitalize mb-4 px-1">{targetDateLabel}</p>

                {/* Low stock alert */}
                {lowStock.length > 0 && (
                    <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 mb-4 flex items-center gap-3">
                        <IconAlertCircle size={18} color="#f97316" />
                        <p className="text-sm text-orange-700 font-semibold">
                            Estoque baixo: {lowStock.map(m => m.name).join(', ')}
                        </p>
                    </div>
                )}

                {/* ── Medication Periods ────────────────── */}
                {loading ? (
                    <div className="flex justify-center py-16">
                        <span className="w-8 h-8 border-4 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
                    </div>
                ) : schedules.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-100">
                        <div className="w-14 h-14 rounded-2xl bg-[#f0f8ff] flex items-center justify-center mx-auto mb-3">
                            <IconPill size={28} color="#42b6f0" />
                        </div>
                        <p className="font-bold text-gray-700">Nenhum medicamento para {selectedDay === 'hoje' ? 'hoje' : 'amanhã'}</p>
                        <p className="text-sm text-gray-400 mt-1">Adicione medicamentos no botão abaixo</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {groupOrder
                            .filter(g => periodGroups[g]?.length > 0)
                            .map(groupName => {
                                const groupSchedules = periodGroups[groupName] ?? []
                                const colors = PERIOD_COLORS[groupName as keyof typeof PERIOD_COLORS] ?? PERIOD_COLORS['Outros']

                                return (
                                    <div key={groupName}>
                                        {/* Period header */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-xl ${colors.bg} flex items-center justify-center`}>
                                                    {PERIOD_ICONS[groupName as keyof typeof PERIOD_ICONS]}
                                                </div>
                                                <div>
                                                    <p className="font-extrabold text-gray-900 text-sm leading-tight">{groupName}</p>
                                                    <p className="text-[11px] text-gray-400">{groupSchedules.length} remédio(s)</p>
                                                </div>
                                            </div>
                                            <span className="text-sm font-bold text-gray-400">
                                                {formatTime(groupSchedules[0]?.scheduled_time)}
                                            </span>
                                        </div>

                                        {/* 2-column gallery grid */}
                                        <div className="grid grid-cols-2 gap-3">
                                            {groupSchedules.map(s => {
                                                const isTaken = s.status === 'taken'
                                                const isMissed = s.status === 'missed'
                                                const isPending = s.status === 'pending'
                                                const isLowStock = s.medication.stock_quantity <= 5 && s.medication.stock_quantity > 0
                                                const isOutOfStock = s.medication.stock_quantity === 0

                                                return (
                                                    <div
                                                        key={s.id}
                                                        className={`bg-white rounded-2xl p-3.5 border relative shadow-sm
                                                            ${isTaken ? 'border-l-4 border-l-[#4ade80] border-gray-100' : ''}
                                                            ${isMissed ? 'border-l-4 border-l-[#f87171] border-gray-100' : ''}
                                                            ${isPending ? 'border border-gray-100' : ''}
                                                        `}
                                                    >
                                                        {/* Color dots */}
                                                        <div className="flex items-center gap-1 mb-2">
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.dot }} />
                                                            {isTaken && <div className="w-2 h-2 rounded-full bg-[#4ade80]" />}
                                                            {isMissed && <div className="w-2 h-2 rounded-full bg-[#f87171]" />}
                                                        </div>

                                                        <p className="font-extrabold text-gray-900 text-sm leading-tight mb-0.5">
                                                            {s.medication.name}
                                                        </p>
                                                        <p className="text-xs text-gray-400 mb-2">
                                                            {s.medication.dosage} {s.medication.unit}
                                                        </p>

                                                        {/* Status badge */}
                                                        <div className="flex items-center justify-between">
                                                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-xl
                                                                ${isTaken ? 'bg-[#f0fdf4] text-[#16a34a]' : ''}
                                                                ${isMissed ? 'bg-[#fff1f2] text-[#dc2626]' : ''}
                                                                ${isPending ? 'bg-gray-100 text-gray-500' : ''}
                                                                ${s.status === 'skipped' ? 'bg-gray-50 text-gray-400' : ''}
                                                            `}>
                                                                {isTaken && <><IconCheckCircle size={10} color="#16a34a" /> Tomado</>}
                                                                {isMissed && <><IconXCircle size={10} color="#dc2626" /> Perdido</>}
                                                                {isPending && '· Pendente'}
                                                                {s.status === 'skipped' && 'Pulado'}
                                                            </span>

                                                            <IconBell size={14} color="#cbd5e1" />
                                                        </div>

                                                        {/* Stock warning */}
                                                        {isOutOfStock && (
                                                            <div className="mt-2 flex items-center gap-1 text-[11px] text-red-600 font-semibold">
                                                                <IconAlertCircle size={10} color="#dc2626" />
                                                                Estoque esgotado!
                                                            </div>
                                                        )}
                                                        {isLowStock && !isOutOfStock && (
                                                            <div className="mt-2 flex items-center gap-1 text-[11px] text-orange-600 font-semibold">
                                                                <IconAlertCircle size={10} color="#f97316" />
                                                                {s.medication.stock_quantity} restantes
                                                            </div>
                                                        )}

                                                        {/* Edit shortcut */}
                                                        <Link
                                                            href={`/patient/medications/${s.medication.id}/edit`}
                                                            className="absolute top-3 right-3 text-gray-200 hover:text-gray-400 transition-colors"
                                                        >
                                                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                                <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                                                            </svg>
                                                        </Link>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                )}

                <div className="h-4" />
            </div>

            {/* Add Medication FAB */}
            <div className="fixed bottom-24 right-4 z-40">
                <Link
                    href={`/patient/medications/add${patientId ? `?patientId=${patientId}` : ''}`}
                    className="w-14 h-14 bg-[#7c3aed] rounded-full shadow-xl shadow-violet-200 flex items-center justify-center hover:bg-[#6d28d9] transition-all active:scale-95"
                >
                    <IconPlus size={24} color="white" strokeWidth={2.5} />
                </Link>
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                <Link href="/patient/home" className="bottom-nav-item">
                    <IconHome size={22} />
                    <span>Início</span>
                </Link>
                <Link href="/patient/medications" className="bottom-nav-item active">
                    <IconPill size={22} color="#42b6f0" />
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
        </div>
    )
}

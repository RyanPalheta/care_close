'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import {
    IconHome, IconPill, IconRoutine, IconBarChart,
    IconChevronLeft, IconChevronRight, IconCheckCircle,
    IconXCircle, IconClock, IconSkip
} from '@/components/Icons'

interface DayData {
    date: string // YYYY-MM-DD
    taken: number
    missed: number
    pending: number
    skipped: number
    total: number
    hasRoutine: boolean
    routineComplete: boolean
}

function CalendarContent() {
    const { user, loading: authLoading } = useAuth()
    const [monthOffset, setMonthOffset] = useState(0) // 0 = current month
    const [days, setDays] = useState<Record<string, DayData>>({})
    const [loading, setLoading] = useState(true)
    const [selectedDay, setSelectedDay] = useState<DayData | null>(null)
    const [selectedSchedules, setSelectedSchedules] = useState<any[]>([])
    const [loadingDetail, setLoadingDetail] = useState(false)

    const today = new Date()
    const displayDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
    const year = displayDate.getFullYear()
    const month = displayDate.getMonth()

    const monthLabel = displayDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    const loadMonthData = useCallback(async () => {
        if (!user) return
        setLoading(true)

        const { data: patient } = await supabase
            .from('patients')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle()

        if (!patient) { setLoading(false); return }

        const startOfMonth = new Date(year, month, 1).toISOString()
        const endOfMonth = new Date(year, month + 1, 1).toISOString()

        const { data: scheduleData } = await supabase
            .from('medication_schedules')
            .select('scheduled_time, status')
            .eq('patient_id', patient.id)
            .gte('scheduled_time', startOfMonth)
            .lt('scheduled_time', endOfMonth)

        const { data: routineData } = await supabase
            .from('daily_routines')
            .select('date, completed')
            .eq('patient_id', patient.id)
            .gte('date', startOfMonth.split('T')[0])
            .lt('date', endOfMonth.split('T')[0])

        // Aggregate by date
        const map: Record<string, DayData> = {}

        for (const s of (scheduleData ?? [])) {
            const date = s.scheduled_time.split('T')[0]
            if (!map[date]) {
                map[date] = { date, taken: 0, missed: 0, pending: 0, skipped: 0, total: 0, hasRoutine: false, routineComplete: false }
            }
            map[date].total++
            if (s.status === 'taken') map[date].taken++
            else if (s.status === 'missed') map[date].missed++
            else if (s.status === 'pending') map[date].pending++
            else if (s.status === 'skipped') map[date].skipped++
        }

        for (const r of (routineData ?? [])) {
            const date = r.date
            if (!map[date]) {
                map[date] = { date, taken: 0, missed: 0, pending: 0, skipped: 0, total: 0, hasRoutine: false, routineComplete: false }
            }
            map[date].hasRoutine = true
            map[date].routineComplete = r.completed
        }

        setDays(map)
        setLoading(false)
    }, [user, year, month])

    useEffect(() => {
        if (!authLoading && user) loadMonthData()
    }, [authLoading, user, loadMonthData])

    async function loadDayDetail(dateStr: string) {
        setLoadingDetail(true)
        const { data: patient } = await supabase
            .from('patients')
            .select('id')
            .eq('user_id', user!.id)
            .maybeSingle()
        if (!patient) { setLoadingDetail(false); return }

        const start = `${dateStr}T00:00:00`
        const end = `${dateStr}T23:59:59`
        const { data } = await supabase
            .from('medication_schedules')
            .select(`
                id, scheduled_time, status, taken_at,
                medication:medications!medication_id (name, dosage, unit)
            `)
            .eq('patient_id', patient.id)
            .gte('scheduled_time', start)
            .lte('scheduled_time', end)
            .order('scheduled_time', { ascending: true })
        setSelectedSchedules(data ?? [])
        setLoadingDetail(false)
    }

    // Build calendar grid
    const firstDay = new Date(year, month, 1).getDay() // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    function getDayStatus(dateStr: string): 'past-good' | 'past-miss-routine' | 'past-miss-med' | 'today-good' | 'today-issue' | 'future' | 'empty' {
        const d = days[dateStr]
        const dateObj = new Date(dateStr + 'T12:00:00')
        const todayStr = today.toISOString().split('T')[0]
        const isPast = dateStr < todayStr
        const isToday = dateStr === todayStr

        if (!d && !isPast && !isToday) return 'future' // future no data
        if (!d) return 'empty' // past with no data

        if (isPast || isToday) {
            const missingMed = d.missed > 0 || (isToday ? false : d.pending > 0)
            const missingRoutine = d.hasRoutine && !d.routineComplete

            if (missingMed) return isPast ? 'past-miss-med' : 'today-issue'
            if (missingRoutine) return isPast ? 'past-miss-routine' : 'today-issue'
            if (d.total > 0 && d.taken === d.total) return isPast ? 'past-good' : 'today-good'
            return isPast ? 'empty' : 'future'
        }
        return 'future'
    }

    function getDayColors(status: ReturnType<typeof getDayStatus>) {
        switch (status) {
            case 'past-good': return { bg: 'bg-[#d1fae5]', text: 'text-[#059669]', dot: '#4ade80' }
            case 'past-miss-routine': return { bg: 'bg-[#fef9c3]', text: 'text-[#a16207]', dot: '#fbbf24' }
            case 'past-miss-med': return { bg: 'bg-[#fee2e2]', text: 'text-[#dc2626]', dot: '#f87171' }
            case 'today-good': return { bg: 'bg-[#bbf7d0]', text: 'text-[#15803d]', dot: '#22c55e' }
            case 'today-issue': return { bg: 'bg-[#fce7f3]', text: 'text-[#be185d]', dot: '#f472b6' }
            case 'future': return { bg: 'bg-transparent', text: 'text-gray-700', dot: '' }
            default: return { bg: 'bg-gray-100', text: 'text-gray-400', dot: '' }
        }
    }

    const todayStr = today.toISOString().split('T')[0]

    const handleDayClick = (dateStr: string) => {
        const d = days[dateStr]
        if (!d) return
        setSelectedDay(d)
        loadDayDetail(dateStr)
    }

    return (
        <div className="min-h-screen bg-[#f7f8fc] pb-28" style={{ fontFamily: 'Lexend, sans-serif' }}>

            {/* Header */}
            <div className="bg-white px-5 pt-12 pb-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <Link href="/patient/home" className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                        <IconChevronLeft size={20} color="#374151" />
                    </Link>
                    <h1 className="text-lg font-extrabold text-gray-900">Agenda Completa</h1>
                    <div className="w-9" />
                </div>
            </div>

            <div className="px-4 pt-5">

                {/* Month Navigation */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-4">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                        <button
                            onClick={() => setMonthOffset(o => o - 1)}
                            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center"
                        >
                            <IconChevronLeft size={18} color="#374151" />
                        </button>
                        <p className="font-extrabold text-gray-800 capitalize">{monthLabel}</p>
                        <button
                            onClick={() => setMonthOffset(o => o + 1)}
                            disabled={monthOffset >= 2}
                            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center disabled:opacity-30"
                        >
                            <IconChevronRight size={18} color="#374151" />
                        </button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 px-3 pt-3">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                            <div key={i} className="text-center text-[10px] font-bold text-gray-400 pb-2">{d}</div>
                        ))}
                    </div>

                    {/* Days grid */}
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <span className="w-8 h-8 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-7 gap-1 px-3 pb-4">
                            {/* Empty cells before first day */}
                            {Array.from({ length: firstDay }).map((_, i) => (
                                <div key={`empty-${i}`} />
                            ))}

                            {/* Day cells */}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const dayNum = i + 1
                                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                                const status = getDayStatus(dateStr)
                                const colors = getDayColors(status)
                                const isToday = dateStr === todayStr
                                const hasDot = colors.dot !== ''
                                const isSelected = selectedDay?.date === dateStr

                                return (
                                    <button
                                        key={dayNum}
                                        onClick={() => handleDayClick(dateStr)}
                                        className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all
                                            ${colors.bg} ${isToday ? 'ring-2 ring-[#42b6f0]' : ''}
                                            ${isSelected ? 'ring-2 ring-[#7c3aed]' : ''}
                                            ${hasDot ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                                    >
                                        <span className={`text-sm font-bold ${colors.text}`}>{dayNum}</span>
                                        {hasDot && (
                                            <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: colors.dot }} />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Color Legend */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 px-5 py-4 mb-4">
                    <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">Legenda</p>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { bg: 'bg-[#d1fae5]', label: 'Tudo certo', past: true },
                            { bg: 'bg-[#fee2e2]', label: 'Remédio perdido', past: true },
                            { bg: 'bg-[#fef9c3]', label: 'Rotina incompleta', past: true },
                            { bg: 'bg-gray-100', label: 'Sem dados', past: false },
                        ].map(({ bg, label }) => (
                            <div key={label} className="flex items-center gap-2">
                                <div className={`w-5 h-5 rounded-lg ${bg} flex-shrink-0`} />
                                <span className="text-xs text-gray-600 font-medium">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Day Detail */}
                {selectedDay && (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 px-5 py-4">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm font-extrabold text-gray-900">
                                {new Date(selectedDay.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                            <button onClick={() => setSelectedDay(null)} className="text-gray-300 text-lg font-bold">✕</button>
                        </div>

                        {/* Stats row */}
                        <div className="flex gap-2 mb-4">
                            {[
                                { icon: <IconCheckCircle size={14} color="#4ade80" />, val: selectedDay.taken, label: 'Tomados' },
                                { icon: <IconXCircle size={14} color="#f87171" />, val: selectedDay.missed, label: 'Perdidos' },
                                { icon: <IconClock size={14} color="#fbbf24" />, val: selectedDay.pending, label: 'Pendentes' },
                            ].map(({ icon, val, label }) => (
                                <div key={label} className="flex-1 bg-gray-50 rounded-2xl p-2.5 flex flex-col items-center">
                                    {icon}
                                    <span className="font-extrabold text-gray-900 text-lg leading-tight">{val}</span>
                                    <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide">{label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Schedule list */}
                        {loadingDetail ? (
                            <div className="flex justify-center py-4">
                                <span className="w-6 h-6 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin" />
                            </div>
                        ) : selectedSchedules.length === 0 ? (
                            <p className="text-center text-gray-400 text-sm py-4">Sem dados para este dia</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {selectedSchedules.map((s: any) => (
                                    <div key={s.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                                        {s.status === 'taken' && <IconCheckCircle size={16} color="#4ade80" />}
                                        {s.status === 'missed' && <IconXCircle size={16} color="#f87171" />}
                                        {s.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-[#42b6f0]" />}
                                        {s.status === 'skipped' && <IconSkip size={16} color="#94a3b8" />}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 truncate">{s.medication.name}</p>
                                            <p className="text-xs text-gray-400">{s.medication.dosage} {s.medication.unit}</p>
                                        </div>
                                        <span className="text-xs text-gray-400 font-medium">
                                            {new Date(s.scheduled_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                <Link href="/patient/home" className="bottom-nav-item">
                    <IconHome size={22} />
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
        </div>
    )
}

export default function CalendarPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-[#f7f8fc]">
                <span className="w-10 h-10 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin" />
            </div>
        }>
            <CalendarContent />
        </Suspense>
    )
}

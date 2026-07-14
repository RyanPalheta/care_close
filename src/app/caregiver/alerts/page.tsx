'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { IconHome, IconCalendar, IconBarChart, IconSettings } from '@/components/Icons'
import { wallTime, wallDate, wallClockAsLocalDate } from '@/lib/wall-clock'

interface LateMedication {
    schedule_id: string
    medication_id: string
    medication_name: string
    dosage: string | null
    scheduled_time: string
    patient_id: string
    patient_name: string
    hours_late: number
}

export default function CaregiverAlertsPage() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [lateMeds, setLateMeds] = useState<LateMedication[]>([])
    const [filter, setFilter] = useState<'all' | 'today' | 'week'>('today')

    const loadAlerts = useCallback(async () => {
        if (!user) return
        setLoading(true)

        // Get license
        const { data: license } = await supabase
            .from('licenses')
            .select('id')
            .or(`owner_id.eq.${user.id},assigned_to.eq.${user.id}`)
            .eq('status', 'active')
            .maybeSingle()

        if (!license) { setLoading(false); return }

        // Get all patients under this license
        const { data: patients } = await supabase
            .from('patients')
            .select('id, name')
            .eq('license_id', license.id)

        if (!patients || patients.length === 0) { setLoading(false); return }

        const patientIds = patients.map(p => p.id)
        const patientMap = Object.fromEntries(patients.map(p => [p.id, p.name]))

        // Determine date range based on filter.
        // scheduled_time is a naive wall-clock, so every comparison must use the
        // device's LOCAL wall-clock rendered in the same naive format — comparing
        // against toISOString() (real UTC) flagged meds as late 3-4h early.
        const now = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        const toWall = (d: Date) =>
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
        const nowWall = toWall(now)
        let startDate: string

        if (filter === 'today') {
            startDate = `${nowWall.split('T')[0]}T00:00:00`
        } else if (filter === 'week') {
            const weekAgo = new Date(now)
            weekAgo.setDate(weekAgo.getDate() - 7)
            startDate = toWall(weekAgo)
        } else {
            const monthAgo = new Date(now)
            monthAgo.setDate(monthAgo.getDate() - 30)
            startDate = toWall(monthAgo)
        }

        // Get missed/pending schedules that are past their time
        const { data: schedules } = await supabase
            .from('medication_schedules')
            .select('id, medication_id, patient_id, scheduled_time, status')
            .in('patient_id', patientIds)
            .in('status', ['pending', 'missed'])
            .gte('scheduled_time', startDate)
            .lt('scheduled_time', nowWall)
            .order('scheduled_time', { ascending: false })

        if (!schedules || schedules.length === 0) {
            setLateMeds([])
            setLoading(false)
            return
        }

        // Get medication details
        const medIds = [...new Set(schedules.map(s => s.medication_id))]
        const { data: medications } = await supabase
            .from('medications')
            .select('id, name, dosage')
            .in('id', medIds)

        const medMap = Object.fromEntries(
            (medications || []).map(m => [m.id, { name: m.name, dosage: m.dosage }])
        )

        // Build late medications list
        const late: LateMedication[] = schedules.map(s => {
            // Interpret the stored wall-clock in the device timezone — comparing
            // the raw timestamptz against now inflated the delay by 3-4h.
            const scheduledDate = wallClockAsLocalDate(s.scheduled_time)
            const hoursLate = Math.round((now.getTime() - scheduledDate.getTime()) / (1000 * 60 * 60))
            const med = medMap[s.medication_id] || { name: 'Medicamento', dosage: null }

            return {
                schedule_id: s.id,
                medication_id: s.medication_id,
                medication_name: med.name,
                dosage: med.dosage,
                scheduled_time: s.scheduled_time,
                patient_id: s.patient_id,
                patient_name: patientMap[s.patient_id] || 'Paciente',
                hours_late: hoursLate,
            }
        })

        setLateMeds(late)
        setLoading(false)
    }, [user, filter])

    useEffect(() => {
        loadAlerts()
    }, [loadAlerts])

    async function markAsTaken(scheduleId: string) {
        await supabase
            .from('medication_schedules')
            .update({ status: 'taken', taken_at: new Date().toISOString() })
            .eq('id', scheduleId)

        setLateMeds(prev => prev.filter(m => m.schedule_id !== scheduleId))
    }

    async function markAsMissed(scheduleId: string) {
        await supabase
            .from('medication_schedules')
            .update({ status: 'missed' })
            .eq('id', scheduleId)

        setLateMeds(prev => prev.filter(m => m.schedule_id !== scheduleId))
    }

    function formatTime(isoTime: string) {
        return wallTime(isoTime)
    }

    function formatDate(isoTime: string) {
        return wallDate(isoTime)
    }

    function getLateLabel(hours: number) {
        if (hours < 1) return 'Agora'
        if (hours < 24) return `${hours}h atras`
        const days = Math.floor(hours / 24)
        return `${days}d atras`
    }

    function getLateColor(hours: number) {
        if (hours < 2) return 'bg-amber-400'
        if (hours < 6) return 'bg-orange-500'
        return 'bg-red-500'
    }

    // Group by patient
    const grouped = lateMeds.reduce<Record<string, LateMedication[]>>((acc, med) => {
        if (!acc[med.patient_id]) acc[med.patient_id] = []
        acc[med.patient_id].push(med)
        return acc
    }, {})

    return (
        <div className="min-h-screen bg-[#f7f8fc] pb-28" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {/* Header */}
            <div className="bg-gradient-to-br from-red-500 to-orange-500 px-5 pt-12 pb-14 text-white relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
                <div className="relative z-10">
                    <h1 className="text-xl font-extrabold">Alertas</h1>
                    <p className="text-red-200 text-sm mt-0.5">Medicacoes atrasadas dos pacientes</p>

                    <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 mt-4 text-center">
                        <p className="text-4xl font-black">{lateMeds.length}</p>
                        <p className="text-sm text-red-200">
                            {lateMeds.length === 1 ? 'medicacao pendente' : 'medicacoes pendentes'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="px-4 -mt-4 relative z-10">
                {/* Filter tabs */}
                <div data-onboarding="caregiver-alerts-filter" className="bg-white rounded-2xl p-1.5 flex gap-1 shadow-sm border border-gray-100 mb-4">
                    {([
                        { key: 'today', label: 'Hoje' },
                        { key: 'week', label: '7 dias' },
                        { key: 'all', label: '30 dias' },
                    ] as const).map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                filter === f.key
                                    ? 'bg-red-500 text-white shadow-md'
                                    : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex justify-center p-10">
                        <span className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : lateMeds.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
                            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-extrabold text-gray-900 mb-1">Tudo em dia!</h2>
                        <p className="text-sm text-gray-400">Nenhuma medicacao atrasada no momento.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {Object.entries(grouped).map(([patientId, meds]) => (
                            <div key={patientId}>
                                {/* Patient header */}
                                <div className="flex items-center gap-2 mb-2 px-1">
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                                        {meds[0].patient_name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-extrabold text-gray-800 text-sm">{meds[0].patient_name}</span>
                                    <span className="ml-auto text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                        {meds.length} {meds.length === 1 ? 'alerta' : 'alertas'}
                                    </span>
                                </div>

                                {/* Medication cards */}
                                <div className="flex flex-col gap-2">
                                    {meds.map(med => (
                                        <div key={med.schedule_id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2.5 h-2.5 rounded-full ${getLateColor(med.hours_late)}`} />
                                                        <h3 className="font-bold text-gray-900 text-sm">{med.medication_name}</h3>
                                                    </div>
                                                    {med.dosage && (
                                                        <p className="text-xs text-gray-400 ml-[18px] mt-0.5">{med.dosage}</p>
                                                    )}
                                                </div>
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                                    med.hours_late < 2 ? 'bg-amber-50 text-amber-600' :
                                                    med.hours_late < 6 ? 'bg-orange-50 text-orange-600' :
                                                    'bg-red-50 text-red-600'
                                                }`}>
                                                    {getLateLabel(med.hours_late)}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                                                <span className="flex items-center gap-1">
                                                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                                    </svg>
                                                    {formatTime(med.scheduled_time)}
                                                </span>
                                                <span>{formatDate(med.scheduled_time)}</span>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => markAsTaken(med.schedule_id)}
                                                    className="flex-1 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5"
                                                >
                                                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                    Tomou
                                                </button>
                                                <button
                                                    onClick={() => markAsMissed(med.schedule_id)}
                                                    className="flex-1 py-2.5 rounded-xl bg-red-50 text-red-500 text-xs font-bold border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
                                                >
                                                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                                    </svg>
                                                    Nao tomou
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                <Link href="/caregiver/home" className="bottom-nav-item">
                    <IconHome size={22} /><span>Pacientes</span>
                </Link>
                <Link href="/caregiver/schedule" className="bottom-nav-item">
                    <IconCalendar size={22} /><span>Agenda</span>
                </Link>
                <Link href="/caregiver/alerts" className="bottom-nav-item text-red-500">
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    <span>Avisos</span>
                </Link>
                <Link href="/caregiver/settings" className="bottom-nav-item">
                    <IconSettings size={22} /><span>Config</span>
                </Link>
            </nav>
        </div>
    )
}

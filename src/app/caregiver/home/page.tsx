'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { generateAllSchedulesForPatient } from '@/lib/schedule-generator'
import { registerServiceWorker, syncPushSubscription } from '@/lib/push-notifications'
import { wallTime } from '@/lib/wall-clock'
import { IconHome, IconCalendar, IconBarChart, IconSettings, IconClock, IconCheckCircle, IconXCircle, IconPill, IconPlus } from '@/components/Icons'

interface PatientWithStats {
    id: string
    name: string
    birth_date: string | null
    medical_notes: string | null
    totalToday: number
    takenToday: number
    missedToday: number
    adherence: number
    nextMed: string | null
    status: 'ok' | 'warning' | 'late'
}

const statusConfig = {
    ok: { label: 'Em dia', badge: 'bg-emerald-50 text-emerald-600 border-emerald-200', dot: 'bg-emerald-400' },
    warning: { label: 'Atenção', badge: 'bg-amber-50 text-amber-600 border-amber-200', dot: 'bg-amber-400' },
    late: { label: 'Atrasado', badge: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-400' },
}

export default function CaregiverHomePage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [patients, setPatients] = useState<PatientWithStats[]>([])
    const [loading, setLoading] = useState(true)

    const loadPatients = useCallback(async () => {
        if (!user) return

        // Get license owned by or assigned to this caregiver
        const { data: license } = await supabase
            .from('licenses')
            .select('id')
            .or(`owner_id.eq.${user.id},assigned_to.eq.${user.id}`)
            .eq('status', 'active')
            .maybeSingle()

        if (!license) { setLoading(false); return }

        // Get all patients under this license
        const { data: patientsData } = await supabase
            .from('patients')
            .select('id, name, birth_date, medical_notes')
            .eq('license_id', license.id)

        if (!patientsData || patientsData.length === 0) { setLoading(false); return }

        const today = new Date()
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

        const enriched: PatientWithStats[] = []

        for (const patient of patientsData) {
            // Auto-generate schedules
            await generateAllSchedulesForPatient(patient.id)

            // Get today's schedules
            const { data: schedules } = await supabase
                .from('medication_schedules')
                .select('id, status, scheduled_time, medication:medications!medication_id (name, dosage)')
                .eq('patient_id', patient.id)
                .gte('scheduled_time', startOfDay)
                .lt('scheduled_time', endOfDay)
                .order('scheduled_time', { ascending: true })

            const total = schedules?.length ?? 0
            const taken = schedules?.filter(s => s.status === 'taken').length ?? 0
            const missed = schedules?.filter(s => s.status === 'missed').length ?? 0
            const pending = schedules?.filter(s => s.status === 'pending') ?? []
            const adherence = total > 0 ? Math.round((taken / total) * 100) : 100

            // Find next pending medication
            let nextMed: string | null = null
            if (pending.length > 0) {
                const p = pending[0] as any
                const time = wallTime(p.scheduled_time)
                nextMed = `${p.medication.name} ${time}`
            }

            // Determine status
            let status: 'ok' | 'warning' | 'late' = 'ok'
            if (missed > 0) status = 'late'
            else if (adherence < 80 && total > 0) status = 'warning'

            enriched.push({
                id: patient.id,
                name: patient.name,
                birth_date: patient.birth_date,
                medical_notes: patient.medical_notes,
                totalToday: total,
                takenToday: taken,
                missedToday: missed,
                adherence,
                nextMed,
                status,
            })
        }

        setPatients(enriched)
        setLoading(false)

        // Ensure SW is registered — actual push scheduling is server-driven via cron
        registerServiceWorker()
        // Self-heal: re-persist this device's push subscription if permission
        // is already granted (covers pruned/rotated subscriptions).
        syncPushSubscription()
    }, [user])

    useEffect(() => {
        if (!authLoading && user) loadPatients()
        else if (!authLoading) setLoading(false)
    }, [authLoading, user, loadPatients])

    const totalPatients = patients.length
    const alerts = patients.filter(p => p.status !== 'ok').length
    const avgAdherence = patients.length > 0
        ? Math.round(patients.reduce((s, p) => s + p.adherence, 0) / patients.length)
        : 0

    const userName = profile?.name?.split(' ')[0] ?? 'Cuidador'

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <span className="w-10 h-10 border-4 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="pb-24">
            {/* Header */}
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-6 pt-12 pb-10 text-white relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10" />
                <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-white/10" />

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-violet-200 text-sm font-medium">Painel do Cuidador</p>
                            <h1 className="text-xl font-bold">Olá, {userName} 👋</h1>
                        </div>
                        <Link href="/caregiver/settings" className="w-11 h-11 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-lg hover:bg-white/30 transition-colors">
                            🩺
                        </Link>
                    </div>

                    {/* Summary */}
                    <div data-onboarding="caregiver-summary" className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 flex justify-around">
                        <div className="text-center">
                            <p className="text-2xl font-bold">{totalPatients}</p>
                            <p className="text-xs text-violet-200">Pacientes</p>
                        </div>
                        <div className="w-px bg-white/20" />
                        <div className="text-center">
                            <p className="text-2xl font-bold">{alerts}</p>
                            <p className="text-xs text-violet-200">Alertas</p>
                        </div>
                        <div className="w-px bg-white/20" />
                        <div className="text-center">
                            <p className="text-2xl font-bold">{avgAdherence}%</p>
                            <p className="text-xs text-violet-200">Aderência</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-4 -mt-5 relative z-10">
                {/* Add patient button */}
                <Link data-onboarding="caregiver-add-patient" href="/patient/add" className="btn-primary mb-6 block text-center shadow-lg transition-all hover:brightness-125 hover:shadow-xl" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
                    + Adicionar Paciente
                </Link>

                {/* Patient list */}
                {patients.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4">🧓</div>
                        <p className="font-semibold text-gray-700">Nenhum paciente cadastrado</p>
                        <p className="text-sm text-gray-400 mt-1">Adicione o primeiro paciente acima</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {patients.map(patient => {
                            const sc = statusConfig[patient.status]
                            const age = patient.birth_date
                                ? Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                                : null

                            return (
                                <div key={patient.id} className="card">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center text-2xl flex-shrink-0">
                                            {patient.name[0]?.toUpperCase()}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-gray-900">{patient.name}</p>
                                                <div className={`w-2 h-2 rounded-full ${sc.dot}`} />
                                            </div>
                                            {age && <p className="text-xs text-gray-500">{age} anos</p>}
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${sc.badge}`}>{sc.label}</span>
                                    </div>

                                    {/* Next med */}
                                    {patient.nextMed && (
                                        <div className="bg-gray-50 rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
                                            <IconClock size={14} color="#42b6f0" />
                                            <p className="text-xs text-gray-600">
                                                Próximo: <span className="font-semibold text-gray-800">{patient.nextMed}</span>
                                            </p>
                                        </div>
                                    )}

                                    {/* Adherence bar */}
                                    <div className="mb-3">
                                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                                            <span>Aderência hoje</span>
                                            <span className="font-semibold">{patient.adherence}%</span>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500 transition-all"
                                                style={{ width: `${patient.adherence}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex gap-3 mb-3 text-xs text-gray-400">
                                        <span className="flex items-center gap-1"><IconCheckCircle size={12} color="#4ade80" /> {patient.takenToday} tomadas</span>
                                        <span className="flex items-center gap-1"><IconXCircle size={12} color="#f87171" /> {patient.missedToday} perdidas</span>
                                        <span className="flex items-center gap-1"><IconPill size={12} color="#94a3b8" /> {patient.totalToday} total</span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <Link
                                            href={`/patient/${patient.id}`}
                                            className="flex-1 text-center py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                                        >
                                            Ver Detalhes
                                        </Link>
                                        <Link
                                            href={`/patient/medications/add?patientId=${patient.id}`}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#f0f8ff] border border-[#bae6fd] text-sm font-semibold text-[#42b6f0] hover:bg-[#e0f4fd] transition-colors"
                                        >
                                            <IconPlus size={14} color="#42b6f0" /> Medicamento
                                        </Link>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                <Link href="/caregiver/home" className="bottom-nav-item active">
                    <IconHome size={22} color="#42b6f0" />
                    <span>Pacientes</span>
                </Link>
                <Link href="/caregiver/schedule" className="bottom-nav-item">
                    <IconCalendar size={22} />
                    <span>Agenda</span>
                </Link>
                <Link href="/caregiver/alerts" className="bottom-nav-item">
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    <span>Avisos</span>
                </Link>
                <Link href="/caregiver/settings" className="bottom-nav-item">
                    <IconSettings size={22} />
                    <span>Config</span>
                </Link>
            </nav>
        </div>
    )
}

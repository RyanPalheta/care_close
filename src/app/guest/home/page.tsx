'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

interface PatientInfo {
    id: string
    name: string
    avatar_url: string | null
    date_of_birth: string | null
}

interface MedSchedule {
    id: string
    scheduled_time: string
    status: 'pending' | 'taken' | 'missed' | 'skipped'
    medication: {
        name: string
        dosage: string
        unit: string
    }
}

interface RoutineDay {
    date: string
    water_glasses: number
    walked: boolean
    exercise_minutes: number
    food_quality: number
    observation: string | null
}

export default function GuestHomePage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [patients, setPatients] = useState<PatientInfo[]>([])
    const [selectedPatient, setSelectedPatient] = useState<PatientInfo | null>(null)
    const [schedules, setSchedules] = useState<MedSchedule[]>([])
    const [routine, setRoutine] = useState<RoutineDay | null>(null)
    const [loading, setLoading] = useState(true)
    const [inviterName, setInviterName] = useState('')

    useEffect(() => {
        if (authLoading) return
        if (!user) {
            router.replace('/auth')
            return
        }
        loadPatients()
    }, [user, authLoading])

    async function loadPatients() {
        if (!user) return

        // Find invites accepted by this user
        const { data: invites } = await supabase
            .from('invites')
            .select('license_id, invited_by')
            .eq('accepted_by', user.id)
            .eq('status', 'accepted')

        if (!invites || invites.length === 0) {
            setLoading(false)
            return
        }

        // Get inviter name
        const { data: inviter } = await supabase
            .from('users')
            .select('name')
            .eq('id', invites[0].invited_by)
            .maybeSingle()
        if (inviter?.name) setInviterName(inviter.name)

        // Get patients from those licenses
        const licenseIds = [...new Set(invites.map(i => i.license_id))]
        const { data: patientData } = await supabase
            .from('patients')
            .select('id, name, avatar_url, date_of_birth')
            .in('license_id', licenseIds)

        if (patientData && patientData.length > 0) {
            setPatients(patientData)
            setSelectedPatient(patientData[0])
        }

        setLoading(false)
    }

    const loadPatientData = useCallback(async (patientId: string) => {
        // Load today's schedules
        const today = new Date()
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

        const { data: schedData } = await supabase
            .from('medication_schedules')
            .select('id, scheduled_time, status, medication:medications(name, dosage, unit)')
            .eq('patient_id', patientId)
            .gte('scheduled_time', startOfDay)
            .lt('scheduled_time', endOfDay)
            .order('scheduled_time', { ascending: true })

        if (schedData) {
            setSchedules(schedData as unknown as MedSchedule[])
        }

        // Load today's routine
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        const { data: routineData } = await supabase
            .from('daily_routines')
            .select('date, water_glasses, walked, exercise_minutes, food_quality, observation')
            .eq('patient_id', patientId)
            .eq('date', todayStr)
            .maybeSingle()

        setRoutine(routineData)
    }, [])

    useEffect(() => {
        if (selectedPatient) {
            loadPatientData(selectedPatient.id)
        }
    }, [selectedPatient, loadPatientData])

    function getAge(dob: string) {
        const birth = new Date(dob)
        const diff = Date.now() - birth.getTime()
        return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
    }

    function formatTime(isoString: string) {
        const match = isoString.match(/T(\d{2}):(\d{2})/)
        if (match) return `${match[1]}:${match[2]}`
        return '--:--'
    }

    const takenCount = schedules.filter(s => s.status === 'taken').length
    const totalCount = schedules.length
    const adherenceRate = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f7f8fc]">
                <span className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#f7f8fc] pb-8" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {/* Header */}
            <div className="bg-gradient-to-br from-sky-400 to-blue-500 px-5 pt-12 pb-16 text-white relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-1">
                        <div>
                            <p className="text-sky-200 text-sm">Ola, {profile?.name || 'Visitante'}</p>
                            <h1 className="text-xl font-extrabold">Acompanhamento</h1>
                        </div>
                        <button
                            onClick={async () => {
                                await supabase.auth.signOut()
                                router.replace('/auth')
                            }}
                            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 transition-colors"
                            title="Sair"
                        >
                            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </button>
                    </div>
                    {inviterName && (
                        <p className="text-sky-200 text-xs mt-1">Convidado por {inviterName}</p>
                    )}
                </div>
            </div>

            <div className="px-4 -mt-8 relative z-10">
                {patients.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center">
                        <p className="text-4xl mb-3">🔗</p>
                        <p className="font-bold text-gray-700">Nenhum paciente vinculado</p>
                        <p className="text-sm text-gray-400 mt-1">O convite pode ainda estar sendo processado.</p>
                    </div>
                ) : (
                    <>
                        {/* Patient selector (if multiple) */}
                        {patients.length > 1 && (
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                                {patients.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setSelectedPatient(p)}
                                        className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                                            selectedPatient?.id === p.id
                                                ? 'bg-[#42b6f0] text-white shadow-lg shadow-sky-200'
                                                : 'bg-white text-gray-600 border border-gray-200'
                                        }`}
                                    >
                                        {p.name.split(' ')[0]}
                                    </button>
                                ))}
                            </div>
                        )}

                        {selectedPatient && (
                            <>
                                {/* Patient card */}
                                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-100 to-blue-100 flex items-center justify-center overflow-hidden">
                                            {selectedPatient.avatar_url ? (
                                                <img src={selectedPatient.avatar_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-2xl font-bold text-sky-500">
                                                    {selectedPatient.name.charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-extrabold text-gray-900">{selectedPatient.name}</h2>
                                            {selectedPatient.date_of_birth && (
                                                <p className="text-sm text-gray-400">{getAge(selectedPatient.date_of_birth)} anos</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Adherence ring */}
                                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-4">
                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Medicamentos Hoje</h3>
                                    {totalCount === 0 ? (
                                        <p className="text-center text-gray-400 text-sm py-4">Nenhum medicamento agendado para hoje.</p>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-center mb-5">
                                                <div className="relative w-28 h-28">
                                                    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                                                        <circle cx="50" cy="50" r="42" fill="none" stroke="#f0f0f0" strokeWidth="8" />
                                                        <circle
                                                            cx="50" cy="50" r="42" fill="none"
                                                            stroke={adherenceRate >= 80 ? '#10b981' : adherenceRate >= 50 ? '#f59e0b' : '#ef4444'}
                                                            strokeWidth="8"
                                                            strokeDasharray={`${adherenceRate * 2.64} 264`}
                                                            strokeLinecap="round"
                                                        />
                                                    </svg>
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                        <span className="text-2xl font-extrabold text-gray-900">{adherenceRate}%</span>
                                                        <span className="text-[10px] text-gray-400">adesao</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-3 text-center">
                                                <div className="bg-emerald-50 rounded-2xl p-3">
                                                    <p className="text-lg font-bold text-emerald-600">{takenCount}</p>
                                                    <p className="text-[10px] text-emerald-500 font-medium">Tomados</p>
                                                </div>
                                                <div className="bg-amber-50 rounded-2xl p-3">
                                                    <p className="text-lg font-bold text-amber-600">
                                                        {schedules.filter(s => s.status === 'pending').length}
                                                    </p>
                                                    <p className="text-[10px] text-amber-500 font-medium">Pendentes</p>
                                                </div>
                                                <div className="bg-red-50 rounded-2xl p-3">
                                                    <p className="text-lg font-bold text-red-600">
                                                        {schedules.filter(s => s.status === 'missed' || s.status === 'skipped').length}
                                                    </p>
                                                    <p className="text-[10px] text-red-500 font-medium">Perdidos</p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Schedule list */}
                                {totalCount > 0 && (
                                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-4">
                                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Horarios</h3>
                                        <div className="flex flex-col gap-2.5">
                                            {schedules.map(s => (
                                                <div key={s.id} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                                        s.status === 'taken' ? 'bg-emerald-100' :
                                                        s.status === 'missed' ? 'bg-red-100' :
                                                        s.status === 'skipped' ? 'bg-amber-100' : 'bg-gray-200'
                                                    }`}>
                                                        {s.status === 'taken' ? (
                                                            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                        ) : s.status === 'missed' ? (
                                                            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                                <line x1="6" y1="6" x2="18" y2="18" />
                                                            </svg>
                                                        ) : (
                                                            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                                <circle cx="12" cy="12" r="10" />
                                                                <polyline points="12 6 12 12 16 14" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-gray-800 truncate">{s.medication.name}</p>
                                                        <p className="text-xs text-gray-400">{s.medication.dosage} {s.medication.unit}</p>
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-500">{formatTime(s.scheduled_time)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Daily routine */}
                                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-4">
                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Rotina de Hoje</h3>
                                    {!routine ? (
                                        <p className="text-center text-gray-400 text-sm py-4">Rotina ainda nao registrada hoje.</p>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-blue-50 rounded-2xl p-4 text-center">
                                                <p className="text-2xl mb-1">💧</p>
                                                <p className="text-lg font-bold text-blue-700">{routine.water_glasses}</p>
                                                <p className="text-[10px] text-blue-500 font-medium">copos de agua</p>
                                            </div>
                                            <div className="bg-green-50 rounded-2xl p-4 text-center">
                                                <p className="text-2xl mb-1">🚶</p>
                                                <p className="text-lg font-bold text-green-700">{routine.walked ? 'Sim' : 'Nao'}</p>
                                                <p className="text-[10px] text-green-500 font-medium">caminhou</p>
                                            </div>
                                            <div className="bg-purple-50 rounded-2xl p-4 text-center">
                                                <p className="text-2xl mb-1">🏋️</p>
                                                <p className="text-lg font-bold text-purple-700">{routine.exercise_minutes} min</p>
                                                <p className="text-[10px] text-purple-500 font-medium">exercicio</p>
                                            </div>
                                            <div className="bg-orange-50 rounded-2xl p-4 text-center">
                                                <p className="text-2xl mb-1">🍽️</p>
                                                <p className="text-lg font-bold text-orange-700">{routine.food_quality}/5</p>
                                                <p className="text-[10px] text-orange-500 font-medium">alimentacao</p>
                                            </div>
                                        </div>
                                    )}
                                    {routine?.observation && (
                                        <div className="mt-3 p-3 bg-gray-50 rounded-2xl">
                                            <p className="text-xs text-gray-500 font-bold mb-1">Observacao</p>
                                            <p className="text-sm text-gray-700">{routine.observation}</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

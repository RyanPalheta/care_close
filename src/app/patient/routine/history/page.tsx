'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { IconHome, IconPill, IconRoutine, IconBarChart } from '@/components/Icons'

interface DayRoutine {
    date: string
    water_glasses: number
    walkDuration: number
    exerciseIntensity: string | null
    exerciseDuration: number
    foodQuality: string | null
    pain_score: number
    symptoms_notes: string | null
    completedCount: number
}

function HistoryContent() {
    const { user, profile } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [days, setDays] = useState<DayRoutine[]>([])
    const [loading, setLoading] = useState(true)
    const [patientId, setPatientId] = useState<string | null>(null)

    const loadHistory = useCallback(async () => {
        if (!user) return
        let pId = searchParams.get('patientId')

        if (!pId) {
            const { data: patient } = await supabase
                .from('patients').select('id').eq('user_id', user.id).maybeSingle()
            if (!patient) { setLoading(false); return }
            pId = patient.id
        }
        setPatientId(pId)

        // Get last 7 days
        const dates: string[] = []
        for (let i = 6; i >= 0; i--) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            dates.push(d.toISOString().split('T')[0])
        }

        const { data: routines } = await supabase
            .from('daily_routines')
            .select('*')
            .eq('patient_id', pId)
            .gte('date', dates[0])
            .lte('date', dates[dates.length - 1])
            .order('date', { ascending: true })

        const routineMap = new Map<string, any>()
        routines?.forEach(r => routineMap.set(r.date, r))

        const parsed: DayRoutine[] = dates.map(date => {
            const r = routineMap.get(date)
            if (!r) {
                return {
                    date, water_glasses: 0, walkDuration: 0,
                    exerciseIntensity: null, exerciseDuration: 0,
                    foodQuality: null, pain_score: 0,
                    symptoms_notes: null, completedCount: 0,
                }
            }

            let walkDuration = 0, exerciseIntensity: string | null = null, exerciseDuration = 0, foodQuality: string | null = null
            if (r.food_notes) {
                try {
                    if (r.food_notes.startsWith('{')) {
                        const p = JSON.parse(r.food_notes)
                        walkDuration = p.walkDuration ?? 0
                        exerciseIntensity = p.exercise?.intensity ?? null
                        exerciseDuration = p.exercise?.duration ?? 0
                        foodQuality = p.food ?? null
                    }
                } catch { /* ignore */ }
            }

            const completedCount = [
                (r.water_glasses || 0) > 0,
                walkDuration > 0,
                exerciseIntensity !== null && exerciseDuration > 0,
                foodQuality !== null,
            ].filter(Boolean).length

            return {
                date,
                water_glasses: r.water_glasses || 0,
                walkDuration,
                exerciseIntensity,
                exerciseDuration,
                foodQuality,
                pain_score: r.pain_score || 0,
                symptoms_notes: r.symptoms_notes,
                completedCount,
            }
        })

        setDays(parsed)
        setLoading(false)
    }, [user, searchParams])

    useEffect(() => { loadHistory() }, [loadHistory])

    const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

    function getDayLabel(dateStr: string) {
        const d = new Date(dateStr + 'T12:00:00')
        return weekdayNames[d.getDay()]
    }

    function getDayNum(dateStr: string) {
        return dateStr.split('-')[2]
    }

    const today = new Date().toISOString().split('T')[0]

    // Averages
    const filledDays = days.filter(d => d.completedCount > 0)
    const avgWater = filledDays.length ? Math.round(filledDays.reduce((s, d) => s + d.water_glasses, 0) / filledDays.length) : 0
    const avgWalk = filledDays.length ? Math.round(filledDays.reduce((s, d) => s + d.walkDuration, 0) / filledDays.length) : 0
    const avgExercise = filledDays.length ? Math.round(filledDays.reduce((s, d) => s + d.exerciseDuration, 0) / filledDays.length) : 0
    const totalCompleted = days.reduce((s, d) => s + d.completedCount, 0)
    const totalPossible = days.length * 4

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f7f8fc]">
                <span className="w-10 h-10 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#f7f8fc] pb-28" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {/* Header */}
            <div className="bg-gradient-to-br from-[#42b6f0] to-[#2563eb] px-5 pt-12 pb-14 text-white relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/10" />
                <button onClick={() => router.back()} className="mb-3 flex items-center gap-1 text-white/70 text-sm font-bold">
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
                    Voltar
                </button>
                <h1 className="text-xl font-extrabold relative z-10">Ultimos 7 Dias</h1>
                <p className="text-sky-200 text-sm mt-0.5">Historico de rotina</p>

                {/* Week averages */}
                <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 mt-4 flex justify-around">
                    <div className="text-center">
                        <p className="text-2xl font-bold">{avgWater}</p>
                        <p className="text-xs text-sky-200">Agua/dia</p>
                    </div>
                    <div className="w-px bg-white/20" />
                    <div className="text-center">
                        <p className="text-2xl font-bold">{avgWalk}<span className="text-xs">min</span></p>
                        <p className="text-xs text-sky-200">Caminhada</p>
                    </div>
                    <div className="w-px bg-white/20" />
                    <div className="text-center">
                        <p className="text-2xl font-bold">{Math.round((totalCompleted / totalPossible) * 100)}%</p>
                        <p className="text-xs text-sky-200">Completude</p>
                    </div>
                </div>
            </div>

            <div className="px-4 -mt-6 relative z-10">
                {/* Week strip */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 mb-4">
                    <div className="flex justify-between">
                        {days.map(day => {
                            const isToday = day.date === today
                            const filled = day.completedCount > 0
                            return (
                                <div key={day.date} className="flex flex-col items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">{getDayLabel(day.date)}</span>
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                                        isToday ? 'bg-[#42b6f0] text-white' :
                                        filled ? 'bg-emerald-100 text-emerald-600' :
                                        'bg-gray-100 text-gray-400'
                                    }`}>
                                        {getDayNum(day.date)}
                                    </div>
                                    {/* Dots for completion */}
                                    <div className="flex gap-0.5">
                                        {[0, 1, 2, 3].map(i => (
                                            <div key={i} className={`w-1.5 h-1.5 rounded-full ${
                                                i < day.completedCount ? 'bg-emerald-400' : 'bg-gray-200'
                                            }`} />
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Day cards */}
                <div className="flex flex-col gap-3">
                    {[...days].reverse().map(day => {
                        const isToday = day.date === today
                        const dateObj = new Date(day.date + 'T12:00:00')
                        const label = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })

                        if (day.completedCount === 0) {
                            return (
                                <div key={day.date} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 opacity-60">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold text-gray-500 capitalize">{label}</p>
                                        {isToday && <span className="text-xs bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full font-bold">Hoje</span>}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">Nenhum registro</p>
                                </div>
                            )
                        }

                        return (
                            <div key={day.date} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-bold text-gray-800 capitalize">{label}</p>
                                        {isToday && <span className="text-xs bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full font-bold">Hoje</span>}
                                    </div>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                        day.completedCount === 4 ? 'bg-emerald-100 text-emerald-600' :
                                        day.completedCount >= 2 ? 'bg-sky-100 text-sky-600' :
                                        'bg-amber-100 text-amber-600'
                                    }`}>
                                        {day.completedCount}/4
                                    </span>
                                </div>

                                <div className="grid grid-cols-4 gap-2">
                                    <div className="text-center">
                                        <p className="text-lg font-black text-sky-500">{day.water_glasses}</p>
                                        <p className="text-[10px] font-bold text-gray-400">Agua</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-black text-emerald-500">{day.walkDuration}<span className="text-[10px]">m</span></p>
                                        <p className="text-[10px] font-bold text-gray-400">Caminh.</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-black text-orange-500">{day.exerciseDuration}<span className="text-[10px]">m</span></p>
                                        <p className="text-[10px] font-bold text-gray-400">Exerc.</p>
                                    </div>
                                    <div className="text-center">
                                        <div className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center ${
                                            day.foodQuality === 'verde' ? 'bg-green-100 text-green-600' :
                                            day.foodQuality === 'amarelo' ? 'bg-amber-100 text-amber-600' :
                                            day.foodQuality === 'vermelho' ? 'bg-red-100 text-red-600' :
                                            'bg-gray-100 text-gray-400'
                                        }`}>
                                            {day.foodQuality === 'verde' ? '😊' :
                                             day.foodQuality === 'amarelo' ? '😐' :
                                             day.foodQuality === 'vermelho' ? '😟' : '--'}
                                        </div>
                                        <p className="text-[10px] font-bold text-gray-400 mt-0.5">Alim.</p>
                                    </div>
                                </div>

                                {day.symptoms_notes && (
                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                        <p className="text-xs text-gray-500 italic">&ldquo;{day.symptoms_notes}&rdquo;</p>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                {profile?.role === 'caregiver' ? (
                    <>
                        <Link href="/caregiver/home" className="bottom-nav-item">
                            <IconHome size={22} /><span>Pacientes</span>
                        </Link>
                        <Link href={`/patient/routine?patientId=${patientId}`} className="bottom-nav-item">
                            <IconRoutine size={22} /><span>Rotina</span>
                        </Link>
                    </>
                ) : (
                    <>
                        <Link href="/patient/home" className="bottom-nav-item"><IconHome size={22} /><span>Inicio</span></Link>
                        <Link href="/patient/medications" className="bottom-nav-item"><IconPill size={22} /><span>Remedios</span></Link>
                        <Link href="/patient/routine" className="bottom-nav-item"><IconRoutine size={22} /><span>Rotina</span></Link>
                        <Link href="/patient/reports" className="bottom-nav-item"><IconBarChart size={22} /><span>Relatorios</span></Link>
                    </>
                )}
            </nav>
        </div>
    )
}

export default function RoutineHistoryPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-[#f7f8fc]">
                <span className="w-10 h-10 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin" />
            </div>
        }>
            <HistoryContent />
        </Suspense>
    )
}

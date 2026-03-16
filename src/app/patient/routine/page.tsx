'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { IconHome, IconPill, IconRoutine, IconBarChart } from '@/components/Icons'

const CupIcon = ({ filled }: { filled: boolean }) => (
    <svg width={32} height={32} viewBox="0 0 24 24" stroke={filled ? "#42b6f0" : "#d1d5db"} fill={filled ? "#bae6fd" : "none"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.2 22H8.8a2 2 0 0 1-2-1.79L5 3h14l-1.81 17.21A2 2 0 0 1 15.2 22Z" />
        <path d="M6 12h12" />
    </svg>
)

const BarsIcon = ({ level }: { level: 1 | 2 | 3 }) => (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="14" width="4" height="6" rx="1" fillOpacity={level >= 1 ? 1 : 0.2} />
        <rect x="10" y="10" width="4" height="10" rx="1" fillOpacity={level >= 2 ? 1 : 0.2} />
        <rect x="16" y="6" width="4" height="14" rx="1" fillOpacity={level >= 3 ? 1 : 0.2} />
    </svg>
)

const SadFace = () => (
    <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
)

const NeutralFace = () => (
    <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="8" y1="15" x2="16" y2="15" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
)

const HappyFace = () => (
    <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
)

function RoutineContent() {
    const { user, profile } = useAuth()
    const searchParams = useSearchParams()
    const [patientId, setPatientId] = useState<string | null>(null)
    const [routineId, setRoutineId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    // Form states
    const [waterGlasses, setWaterGlasses] = useState(0)
    const [walkDuration, setWalkDuration] = useState(0) // 0-120 mins
    const [exerciseIntensity, setExerciseIntensity] = useState<'leve' | 'moderado' | 'intenso' | null>(null)
    const [exerciseDuration, setExerciseDuration] = useState(0)
    const [foodQuality, setFoodQuality] = useState<'vermelho' | 'amarelo' | 'verde' | null>(null)
    const [notes, setNotes] = useState('')
    const [painScore, setPainScore] = useState(0)

    const loadRoutine = useCallback(async () => {
        if (!user) return
        let pId = searchParams.get('patientId')

        if (!pId) {
            const { data: patient } = await supabase
                .from('patients').select('id').eq('user_id', user.id).maybeSingle()
            if (!patient) { setLoading(false); return }
            pId = patient.id
        }
        setPatientId(pId)

        const today = new Date().toISOString().split('T')[0]
        const { data: routine } = await supabase
            .from('daily_routines').select('*').eq('patient_id', pId).eq('date', today).maybeSingle()

        if (routine) {
            setRoutineId(routine.id)
            setNotes(routine.symptoms_notes ?? '')
            setPainScore(routine.pain_score ?? 0)
            setWaterGlasses(routine.water_glasses ?? 0)

            if (routine.food_notes) {
                try {
                    if (routine.food_notes.startsWith('{')) {
                        const parsed = JSON.parse(routine.food_notes)
                        setWalkDuration(parsed.walkDuration ?? 0)
                        setExerciseIntensity(parsed.exercise?.intensity ?? null)
                        setExerciseDuration(parsed.exercise?.duration ?? 0)
                        setFoodQuality(parsed.food ?? null)
                    } else {
                        // Legacy mode mappings
                        setWalkDuration(routine.food_notes.includes('walked') ? 15 : 0)
                        setExerciseIntensity(routine.food_notes.includes('exercised') ? 'leve' : null)
                        setExerciseDuration(routine.food_notes.includes('exercised') ? 15 : 0)
                        setFoodQuality(routine.food_notes.includes('ate_well') ? 'verde' : null)
                    }
                } catch (e) {
                    // Ignore parse error
                }
            }
        }
        setLoading(false)
    }, [user, searchParams])

    useEffect(() => { loadRoutine() }, [loadRoutine])

    async function saveRoutine() {
        if (!patientId) return
        setSaving(true)
        const today = new Date().toISOString().split('T')[0]

        // Pack rich interactions into JSON mapping string
        const advancedData = {
            walkDuration,
            exercise: { intensity: exerciseIntensity, duration: exerciseDuration },
            food: foodQuality
        }

        const payload = {
            patient_id: patientId,
            date: today,
            water_glasses: waterGlasses,
            mood_score: 3,
            pain_score: painScore,
            food_notes: JSON.stringify(advancedData),
            symptoms_notes: notes || null,
        }

        if (routineId) {
            await supabase.from('daily_routines').update(payload).eq('id', routineId)
        } else {
            const { data } = await supabase.from('daily_routines').insert(payload).select('id').single()
            if (data) setRoutineId(data.id)
        }
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
    }

    const today = new Date()
    const todayLabel = today.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    const weekdayLabel = today.toLocaleDateString('pt-BR', { weekday: 'long' })

    const checkedCount = [
        waterGlasses > 0,
        walkDuration > 0,
        exerciseIntensity !== null && exerciseDuration > 0,
        foodQuality !== null
    ].filter(Boolean).length
    const totalCount = 4

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
            <div className="bg-white px-5 pt-12 pb-5 shadow-sm">
                <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">
                    Acompanhamento<br />de Rotina
                </h1>
                <p className="text-gray-400 text-sm mt-1">Vamos verificar seu bem-estar hoje.</p>
            </div>

            <div className="px-4 pt-4 flex flex-col gap-4">
                {/* Date card */}
                <div className="bg-white rounded-3xl px-5 py-4 shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#fff0ed] flex items-center justify-center">
                        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-[#f87171] uppercase tracking-widest">HOJE</p>
                        <p className="font-extrabold text-gray-900 text-sm capitalize">
                            {weekdayLabel.charAt(0).toUpperCase() + weekdayLabel.slice(1)}, {todayLabel}
                        </p>
                    </div>
                </div>

                {/* Progress */}
                {checkedCount > 0 && (
                    <div className="bg-[#f0fdf4] rounded-3xl px-5 py-3 border border-green-100 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#4ade80] flex items-center justify-center flex-shrink-0">
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <p className="text-sm font-bold text-green-700">
                            {checkedCount} de {totalCount} atividades completas
                        </p>
                    </div>
                )}

                {/* Hidratação (Copos de Água) */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col items-center">
                    <div className="self-start flex gap-2 items-center mb-4">
                        <div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center">
                            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#42b6f0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>
                        </div>
                        <h3 className="font-extrabold text-gray-900 text-lg">Água</h3>
                    </div>

                    <div className="flex flex-wrap justify-center gap-1.5 max-w-[280px]">
                        {[...Array(8)].map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setWaterGlasses(w => w === i + 1 ? i : i + 1)}
                                className="p-1 active:scale-90 transition-transform hover:opacity-80 disabled:opacity-50"
                                disabled={profile?.role === 'caregiver'}
                            >
                                <CupIcon filled={waterGlasses > i} />
                            </button>
                        ))}
                    </div>
                    <p className="text-[#42b6f0] font-bold mt-4 text-sm bg-sky-50 px-4 py-1.5 rounded-full">{waterGlasses} de 8 copos</p>
                </div>

                {/* Caminhada (Dial) */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col items-center">
                    <div className="self-start flex gap-2 items-center mb-4">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="4" r="1.5" /><path d="M9 20l2-7-3-3 4-5 4 5-3 3 2 7" /></svg>
                        </div>
                        <h3 className="font-extrabold text-gray-900 text-lg">Caminhada</h3>
                    </div>

                    <div className="text-4xl font-black text-[#10b981] mb-5">{walkDuration}<span className="text-lg text-gray-400 font-bold ml-1">min</span></div>

                    <input
                        type="range" min="0" max="120" step="5"
                        value={walkDuration} onChange={e => setWalkDuration(parseInt(e.target.value))}
                        disabled={profile?.role === 'caregiver'}
                        className="w-full h-4 bg-gray-100 rounded-full appearance-none outline-none cursor-pointer"
                        style={{
                            background: `linear-gradient(to right, #34d399 ${(walkDuration / 120) * 100}%, #f3f4f6 ${(walkDuration / 120) * 100}%)`,
                            WebkitAppearance: 'none'
                        }}
                    />
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        input[type=range]::-webkit-slider-thumb {
                            -webkit-appearance: none;
                            height: 28px;
                            width: 28px;
                            border-radius: 50%;
                            background: #ffffff;
                            border: 3px solid #10b981;
                            cursor: pointer;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        }
                        input[type=range]:disabled::-webkit-slider-thumb { cursor: not-allowed; }
                    `}} />

                    <div className="flex justify-between w-full text-xs font-bold text-gray-400 mt-3">
                        <span>0</span>
                        <span>120 min</span>
                    </div>
                </div>

                {/* Exercício */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col items-center">
                    <div className="self-start flex gap-2 items-center mb-5">
                        <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
                            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg>
                        </div>
                        <h3 className="font-extrabold text-gray-900 text-lg">Exercício</h3>
                    </div>

                    <div className="flex w-full gap-2 mb-6">
                        <button
                            disabled={profile?.role === 'caregiver'}
                            onClick={() => setExerciseIntensity('leve')}
                            className={`flex-1 flex flex-col items-center py-3 rounded-2xl border-2 transition-colors disabled:opacity-50 ${exerciseIntensity === 'leve' ? 'bg-green-50 border-green-400 text-green-700' : 'border-gray-50 bg-gray-50/50 text-gray-400'}`}>
                            <BarsIcon level={1} />
                            <span className="font-bold text-xs mt-1">Leve</span>
                        </button>
                        <button
                            disabled={profile?.role === 'caregiver'}
                            onClick={() => setExerciseIntensity('moderado')}
                            className={`flex-1 flex flex-col items-center py-3 rounded-2xl border-2 transition-colors disabled:opacity-50 ${exerciseIntensity === 'moderado' ? 'bg-amber-50 border-amber-400 text-amber-700' : 'border-gray-50 bg-gray-50/50 text-gray-400'}`}>
                            <BarsIcon level={2} />
                            <span className="font-bold text-xs mt-1">Médio</span>
                        </button>
                        <button
                            disabled={profile?.role === 'caregiver'}
                            onClick={() => setExerciseIntensity('intenso')}
                            className={`flex-1 flex flex-col items-center py-3 rounded-2xl border-2 transition-colors disabled:opacity-50 ${exerciseIntensity === 'intenso' ? 'bg-red-50 border-red-400 text-red-700' : 'border-gray-50 bg-gray-50/50 text-gray-400'}`}>
                            <BarsIcon level={3} />
                            <span className="font-bold text-xs mt-1">Intenso</span>
                        </button>
                    </div>

                    <div className="w-full h-px bg-gray-100 mb-5" />

                    <h4 className="text-gray-400 font-bold text-xs uppercase tracking-wide mb-3 self-start">Duração</h4>
                    <div className="flex items-center gap-6">
                        <button
                            disabled={profile?.role === 'caregiver'}
                            onClick={() => setExerciseDuration(Math.max(0, exerciseDuration - 5))}
                            className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                        >
                            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={3} strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                        <span className="text-3xl font-black text-gray-900 w-16 text-center">{exerciseDuration}</span>
                        <button
                            disabled={profile?.role === 'caregiver'}
                            onClick={() => setExerciseDuration(Math.min(180, exerciseDuration + 5))}
                            className="w-12 h-12 rounded-full bg-[#f97316] shadow-md shadow-orange-200 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                        >
                            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Alimentação (Cores e Rostos) */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col items-center">
                    <div className="self-start flex gap-2 items-center mb-5">
                        <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
                            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 2h1l1.5 7M7 15h12l-1.68-8.39A2 2 0 0 0 15.36 5H8.64a2 2 0 0 0-1.97 1.67L5.5 9M16 17a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM9 17a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" /></svg>
                        </div>
                        <h3 className="font-extrabold text-gray-900 text-lg">Alimentação</h3>
                    </div>

                    <div className="flex w-full gap-2.5">
                        <button
                            disabled={profile?.role === 'caregiver'}
                            onClick={() => setFoodQuality('vermelho')}
                            className={`flex-1 py-4 border-2 rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors disabled:opacity-50 ${foodQuality === 'vermelho' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-50 bg-gray-50/50 text-gray-300'}`}>
                            <SadFace />
                            <span className={`font-bold text-xs ${foodQuality === 'vermelho' ? 'text-red-700' : 'text-gray-400'}`}>Ruim</span>
                        </button>

                        <button
                            disabled={profile?.role === 'caregiver'}
                            onClick={() => setFoodQuality('amarelo')}
                            className={`flex-1 py-4 border-2 rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors disabled:opacity-50 ${foodQuality === 'amarelo' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-50 bg-gray-50/50 text-gray-300'}`}>
                            <NeutralFace />
                            <span className={`font-bold text-xs ${foodQuality === 'amarelo' ? 'text-amber-700' : 'text-gray-400'}`}>Média</span>
                        </button>

                        <button
                            disabled={profile?.role === 'caregiver'}
                            onClick={() => setFoodQuality('verde')}
                            className={`flex-1 py-4 border-2 rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors disabled:opacity-50 ${foodQuality === 'verde' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-50 bg-gray-50/50 text-gray-300'}`}>
                            <HappyFace />
                            <span className={`font-bold text-xs ${foodQuality === 'verde' ? 'text-green-700' : 'text-gray-400'}`}>Ótima</span>
                        </button>
                    </div>
                </div>

                {/* Observações */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mt-2">
                    <h2 className="font-extrabold text-gray-900 mb-3 text-lg">Observações</h2>
                    <textarea
                        className="w-full bg-[#f7f8fc] rounded-2xl px-4 py-3 text-sm text-gray-700 resize-none border-0 focus:outline-none focus:ring-2 focus:ring-[#42b6f0]/50 transition-all disabled:opacity-50"
                        rows={3}
                        placeholder="Adicione notas sobre humor, dor ou outros sintomas aqui..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        disabled={profile?.role === 'caregiver'}
                    />
                </div>

                {/* Save button */}
                <button
                    onClick={saveRoutine}
                    disabled={saving || profile?.role === 'caregiver'}
                    className={`w-full flex items-center justify-center gap-2 py-4 mt-2 rounded-3xl font-extrabold text-white transition-all shadow-lg
                        ${saved
                            ? 'bg-[#4ade80] shadow-green-100'
                            : profile?.role === 'caregiver'
                                ? 'bg-gray-300 cursor-not-allowed shadow-none'
                                : 'bg-[#f87171] hover:bg-[#ef4444] shadow-red-100 active:scale-[0.98]'}`}
                >
                    {saving ? (
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : saved ? (
                        <><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> Salvo!</>
                    ) : (
                        <><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            {profile?.role === 'caregiver' ? 'Apenas Visualização' : 'Salvar Dia'}</>
                    )}
                </button>
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                {profile?.role === 'caregiver' ? (
                    <>
                        <Link href="/caregiver/home" className="bottom-nav-item">
                            <IconHome size={22} /><span>Pacientes</span>
                        </Link>
                        <Link href={`/patient/routine?patientId=${patientId}`} className="bottom-nav-item active">
                            <IconRoutine size={22} color="#42b6f0" /><span>Rotina</span>
                        </Link>
                    </>
                ) : (
                    <>
                        <Link href="/patient/home" className="bottom-nav-item"><IconHome size={22} /><span>Início</span></Link>
                        <Link href="/patient/medications" className="bottom-nav-item"><IconPill size={22} /><span>Remédios</span></Link>
                        <Link href="/patient/routine" className="bottom-nav-item active"><IconRoutine size={22} color="#42b6f0" /><span>Rotina</span></Link>
                        <Link href="/patient/reports" className="bottom-nav-item"><IconBarChart size={22} /><span>Relatórios</span></Link>
                    </>
                )}
            </nav>
        </div>
    )
}

export default function RoutinePage() {
    return (
        <Suspense>
            <RoutineContent />
        </Suspense>
    )
}

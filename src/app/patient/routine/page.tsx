'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { IconHome, IconPill, IconRoutine, IconBarChart } from '@/components/Icons'

// ── Wellness check items ──────────────────────────────────────────
const CHECKLIST_ITEMS = [
    {
        key: 'water',
        label: 'Bebeu Água',
        sub: 'Pelo menos 6 copos',
        icon: (
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#42b6f0" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
        ),
        iconBg: 'bg-sky-50',
    },
    {
        key: 'walked',
        label: 'Caminhou',
        sub: '15 minutos ao ar livre',
        icon: (
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="4" r="1.5" /><path d="M9 20l2-7-3-3 4-5 4 5-3 3 2 7" />
            </svg>
        ),
        iconBg: 'bg-green-50',
    },
    {
        key: 'exercised',
        label: 'Exercitou',
        sub: 'Alongamento leve',
        icon: (
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
            </svg>
        ),
        iconBg: 'bg-orange-50',
    },
    {
        key: 'ate_well',
        label: 'Alimentação Saudável',
        sub: 'Refeições equilibradas',
        icon: (
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 2h1l1.5 7M7 15h12l-1.68-8.39A2 2 0 0 0 15.36 5H8.64a2 2 0 0 0-1.97 1.67L5.5 9M16 17a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM9 17a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
            </svg>
        ),
        iconBg: 'bg-purple-50',
    },
]

type CheckState = Record<string, boolean>

function RoutineContent() {
    const { user, profile } = useAuth()
    const searchParams = useSearchParams()
    const [patientId, setPatientId] = useState<string | null>(null)
    const [routineId, setRoutineId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    const [checks, setChecks] = useState<CheckState>({
        water: false, walked: false, exercised: false, ate_well: false
    })
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
            setChecks({
                water: routine.water_glasses >= 6,
                walked: !!routine.food_notes?.includes('walked'),
                exercised: !!routine.food_notes?.includes('exercised'),
                ate_well: !!routine.food_notes?.includes('ate_well'),
            })
        }
        setLoading(false)
    }, [user, searchParams])

    useEffect(() => { loadRoutine() }, [loadRoutine])

    async function saveRoutine() {
        if (!patientId) return
        setSaving(true)
        const today = new Date().toISOString().split('T')[0]

        // encode booleans into food_notes field as a workaround (schema-safe)
        const checkFlags = Object.entries(checks).filter(([, v]) => v).map(([k]) => k).join(',')

        const payload = {
            patient_id: patientId,
            date: today,
            water_glasses: checks.water ? 6 : 0,
            mood_score: 3,
            pain_score: painScore,
            food_notes: checkFlags || null,
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

    function toggle(key: string) {
        setChecks(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const checkedCount = Object.values(checks).filter(Boolean).length
    const totalCount = CHECKLIST_ITEMS.length
    const today = new Date()
    const todayLabel = today.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    const weekdayLabel = today.toLocaleDateString('pt-BR', { weekday: 'long' })

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f7f8fc]">
                <span className="w-10 h-10 border-4 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
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
                            {checkedCount} de {totalCount} atividades concluídas
                        </p>
                    </div>
                )}

                {/* Checklist */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 pt-5 pb-2">
                        <h2 className="font-extrabold text-gray-900">Checklist de Bem-Estar</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {CHECKLIST_ITEMS.map((item) => (
                            <button
                                key={item.key}
                                onClick={() => toggle(item.key)}
                                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                            >
                                <div className={`w-11 h-11 rounded-2xl ${item.iconBg} flex items-center justify-center flex-shrink-0`}>
                                    {item.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-900 text-sm">{item.label}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
                                </div>
                                {/* Checkbox */}
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0
                                    ${checks[item.key]
                                        ? 'bg-[#7c3aed] border-[#7c3aed]'
                                        : 'border-gray-200 bg-white'}`}
                                >
                                    {checks[item.key] && (
                                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Observações */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
                    <h2 className="font-extrabold text-gray-900 mb-3">Observações</h2>
                    <textarea
                        className="w-full bg-[#f7f8fc] rounded-2xl px-4 py-3 text-sm text-gray-700 resize-none border-0 focus:outline-none focus:ring-2 focus:ring-violet-200 transition-all"
                        rows={3}
                        placeholder="Adicione notas sobre humor, dor ou outros sintomas aqui..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    />
                </div>

                {/* Save button */}
                <button
                    onClick={saveRoutine}
                    disabled={saving || profile?.role === 'caregiver'}
                    className={`w-full flex items-center justify-center gap-2 py-4 rounded-3xl font-extrabold text-white transition-all shadow-lg
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

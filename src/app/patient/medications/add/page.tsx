'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { generateDailySchedules } from '@/lib/schedule-generator'
import { ensurePatientForUser } from '@/lib/ensure-patient'

const UNITS = [
    { value: 'pílulas', label: 'Comprimido', icon: 'Pill' },
    { value: 'gotas', label: 'Gotas/Ml', icon: 'Drop' },
    { value: 'cápsulas', label: 'Cápsula', icon: 'Capsule' }
]

const FREQUENCIES = [
    { value: 'daily', label: '1x ao dia', desc: 'Todo dia' },
    { value: 'twice_day', label: '2x ao dia', desc: 'A cada 12h' },
    { value: 'three_day', label: '3x ao dia', desc: 'A cada 8h' },
    { value: 'weekly', label: 'Semanal', desc: '1 vez por semana' },
    { value: 'as_needed', label: 'SOS', desc: 'Se precisar' },
]

const PERIODS = [
    { value: 'antes_cafe', label: 'Café (Antes)', icon: '☕' },
    { value: 'depois_cafe', label: 'Café (Depois)', icon: '🥐' },
    { value: 'antes_almoco', label: 'Almoço (Antes)', icon: '🍳' },
    { value: 'depois_almoco', label: 'Almoço (Depois)', icon: '🍛' },
    { value: 'antes_jantar', label: 'Jantar (Antes)', icon: '🌙' },
    { value: 'depois_jantar', label: 'Jantar (Depois)', icon: '🍲' },
]

const PillIcon = ({ active }: { active: boolean }) => (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={active ? "#7c3aed" : "#9ca3af"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.5 20.5A7 7 0 0 1 3.5 13.5a7 7 0 1 1 14 0 7 7 0 0 1-7 7Z" />
        <path d="m8.5 8.5 7 7" />
    </svg>
)

const CapsuleIcon = ({ active }: { active: boolean }) => (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={active ? "#7c3aed" : "#9ca3af"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
        <path d="m8.5 8.5 7 7" />
    </svg>
)

const DropIcon = ({ active }: { active: boolean }) => (
    <svg width={28} height={28} viewBox="0 0 24 24" fill={active ? "#ede9fe" : "none"} stroke={active ? "#7c3aed" : "#9ca3af"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
    </svg>
)

function AddMedicationForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { user, profile } = useAuth()
    const [patientId, setPatientId] = useState<string | null>(null)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [name, setName] = useState('')
    const [dosage, setDosage] = useState('')
    const [unit, setUnit] = useState('pílulas')
    const [frequency, setFrequency] = useState('daily')
    const [period, setPeriod] = useState('depois_almoco')
    const [scheduleMode, setScheduleMode] = useState<'meal' | 'time'>('meal')
    const [specificTimes, setSpecificTimes] = useState<string[]>(['08:00'])
    const [stockQty, setStockQty] = useState('')
    const [stockAlert, setStockAlert] = useState('5')
    const [needsPrep, setNeedsPrep] = useState(false)
    const [prepMinutes, setPrepMinutes] = useState('30')
    const [instructions, setInstructions] = useState('')

    // Auto-detect patient from logged-in user OR from URL
    useEffect(() => {
        const urlPatientId = searchParams.get('patientId')
        if (urlPatientId) {
            setPatientId(urlPatientId)
            return
        }

        if (!user) return

        async function detectPatient() {
        // Try by user_id first (patient with own account)
        const { data: byUserId } = await supabase
            .from('patients')
            .select('id')
            .eq('user_id', user!.id)
            .maybeSingle()

        if (byUserId) {
            setPatientId(byUserId.id)
            return
        }

        // Fallback: try via license owned by this user
        const { data: license } = await supabase
            .from('licenses')
            .select('id')
            .or(`owner_id.eq.${user!.id},assigned_to.eq.${user!.id}`)
            .eq('status', 'active')
            .maybeSingle()

        if (license) {
            const { data: byLicense } = await supabase
                .from('patients')
                .select('id')
                .eq('license_id', license.id)
                .maybeSingle()
            if (byLicense) { setPatientId(byLicense.id); return }
        }

        // Safety net: still no patient → auto-create it (covers buyers whose
        // webhook-created patient record is missing).
        const ensured = await ensurePatientForUser(user!.id, profile?.name)
        if (ensured.patientId) setPatientId(ensured.patientId)
        }
        detectPatient()
    }, [user, searchParams, profile])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!patientId) {
            setError('Nenhum paciente cadastrado. Vá em "Cadastrar Paciente" primeiro.')
            return
        }
        setLoading(true)
        setError(null)

        // If using specific times, store them in period as JSON and set frequency accordingly
        let finalPeriod = period
        let finalFrequency = frequency
        if (scheduleMode === 'time') {
            const validTimes = specificTimes.filter(t => t)
            finalPeriod = JSON.stringify({ mode: 'time', times: validTimes })
            // Auto-set frequency based on number of times
            if (validTimes.length === 1) finalFrequency = 'daily'
            else if (validTimes.length === 2) finalFrequency = 'twice_day'
            else if (validTimes.length >= 3) finalFrequency = 'three_day'
        }

        const { data: newMed, error: err } = await supabase.from('medications').insert({
            patient_id: patientId,
            name,
            dosage,
            unit,
            frequency: finalFrequency,
            period: finalPeriod,
            stock_quantity: stockQty ? parseInt(stockQty) : 0,
            stock_alert_at: parseInt(stockAlert),
            needs_prep: needsPrep,
            prep_minutes: needsPrep ? parseInt(prepMinutes) : null,
            instructions: instructions || null,
        }).select('id, patient_id, frequency, period').single()

        if (err) { setLoading(false); setError(err.message); return }

        // Auto-generate today's schedules for this medication
        if (newMed) {
            await generateDailySchedules(newMed)
        }

        setLoading(false)
        if (profile?.role === 'caregiver') {
            router.push('/caregiver/home')
        } else {
            router.push('/patient/medications')
        }
    }

    return (
        <div className="page-container flex flex-col min-h-screen bg-[#f7f8fc]" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {/* Header */}
            <div className="pt-10 pb-6 px-4 shrink-0">
                <button onClick={() => router.back()} className="text-gray-400 font-bold flex items-center gap-1 text-sm mb-5 w-fit hover:text-gray-600 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Voltar
                </button>
                <h1 className="text-3xl font-extrabold text-gray-900 leading-tight">Configurar<br />Medicamento</h1>
                <p className="text-gray-400 font-medium text-sm mt-1">Preencha os detalhes para facilitar o uso diário.</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5 flex-1 px-4 overflow-y-auto pb-8">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-bold rounded-2xl px-4 py-4 shadow-sm flex items-center gap-3">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        {error}
                    </div>
                )}

                {/* Name */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                    <label className="text-[13px] font-extrabold text-gray-400 uppercase tracking-wide mb-2 block">O que você vai tomar?</label>
                    <input
                        type="text"
                        className="w-full text-xl font-bold text-gray-900 placeholder-gray-300 border-b-2 border-gray-100 pb-2 focus:outline-none focus:border-[#7c3aed] transition-colors bg-transparent"
                        placeholder="Ex: Losartana 50mg"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                    />
                </div>

                {/* Visual Unit Selector */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                    <label className="text-[13px] font-extrabold text-gray-400 uppercase tracking-wide mb-3 block">Tipo do Remédio</label>
                    <div className="grid grid-cols-3 gap-3">
                        {UNITS.map(u => {
                            const active = unit === u.value;
                            return (
                                <button
                                    key={u.value}
                                    type="button"
                                    onClick={() => setUnit(u.value)}
                                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${active ? 'bg-[#f5f3ff] border-[#7c3aed] shadow-sm' : 'bg-gray-50 border-transparent hover:bg-gray-100'
                                        }`}
                                >
                                    <div className="mb-2 shrink-0">
                                        {u.icon === 'Pill' && <PillIcon active={active} />}
                                        {u.icon === 'Capsule' && <CapsuleIcon active={active} />}
                                        {u.icon === 'Drop' && <DropIcon active={active} />}
                                    </div>
                                    <span className={`text-xs font-bold text-center ${active ? 'text-[#7c3aed]' : 'text-gray-500'}`}>{u.label}</span>
                                </button>
                            );
                        })}
                    </div>
                    {/* Dosage specific input */}
                    <div className="mt-4 flex items-center gap-3">
                        <label className="text-sm font-extrabold text-gray-700 whitespace-nowrap">Dose da vez:</label>
                        <input
                            type="text"
                            className="bg-gray-50 text-gray-900 font-bold rounded-xl px-4 py-2.5 w-full text-sm border-2 border-transparent focus:border-[#7c3aed] focus:bg-white outline-none transition-all"
                            placeholder="Ex: 1, 5ml, 2 pílulas"
                            value={dosage}
                            onChange={e => setDosage(e.target.value)}
                            required
                        />
                    </div>
                </div>

                {/* Frequency Grid */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                    <label className="text-[13px] font-extrabold text-gray-400 uppercase tracking-wide mb-3 block">Frequência</label>
                    <div className="grid grid-cols-2 gap-2">
                        {FREQUENCIES.map(f => (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setFrequency(f.value)}
                                className={`text-left p-3 rounded-2xl border-2 transition-all ${frequency === f.value
                                        ? 'bg-[#f0fdf4] border-[#4ade80] shadow-sm'
                                        : 'bg-white border-gray-100 hover:border-gray-200'
                                    }`}
                            >
                                <div className={`font-extrabold text-sm mb-0.5 ${frequency === f.value ? 'text-green-700' : 'text-gray-700'}`}>{f.label}</div>
                                <div className={`text-[10px] font-bold ${frequency === f.value ? 'text-green-600/70' : 'text-gray-400'}`}>{f.desc}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Schedule Mode Selector */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                    <label className="text-[13px] font-extrabold text-gray-400 uppercase tracking-wide mb-3 block">Quando tomar?</label>

                    {/* Mode tabs */}
                    <div className="flex gap-2 mb-4">
                        <button
                            type="button"
                            onClick={() => setScheduleMode('meal')}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                                scheduleMode === 'meal'
                                    ? 'bg-[#f5f3ff] border-[#7c3aed] text-[#7c3aed]'
                                    : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                            Em relacao a refeicao
                        </button>
                        <button
                            type="button"
                            onClick={() => setScheduleMode('time')}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                                scheduleMode === 'time'
                                    ? 'bg-[#f5f3ff] border-[#7c3aed] text-[#7c3aed]'
                                    : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                            Horario especifico
                        </button>
                    </div>

                    {scheduleMode === 'meal' ? (
                        <>
                            <div className="grid grid-cols-2 gap-2">
                                {PERIODS.map(p => (
                                    <button
                                        key={p.value}
                                        type="button"
                                        onClick={() => setPeriod(p.value)}
                                        className={`text-left p-3 rounded-2xl border-2 transition-all ${
                                            period === p.value
                                                ? 'bg-[#f5f3ff] border-[#7c3aed] shadow-sm'
                                                : 'bg-white border-gray-100 hover:border-gray-200'
                                        }`}
                                    >
                                        <span className="text-lg mr-1">{p.icon}</span>
                                        <span className={`text-xs font-bold ${period === p.value ? 'text-[#7c3aed]' : 'text-gray-600'}`}>{p.label}</span>
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-400 font-medium mt-3">Os horarios serao organizados com base nas suas refeicoes.</p>
                        </>
                    ) : (
                        <>
                            <div className="flex flex-col gap-2">
                                {specificTimes.map((time, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-[#f5f3ff] flex items-center justify-center flex-shrink-0">
                                            <span className="text-xs font-bold text-[#7c3aed]">{idx + 1}</span>
                                        </div>
                                        <input
                                            type="time"
                                            value={time}
                                            onChange={e => {
                                                const updated = [...specificTimes]
                                                updated[idx] = e.target.value
                                                setSpecificTimes(updated)
                                            }}
                                            className="flex-1 bg-gray-50 border-2 border-transparent focus:border-[#7c3aed] focus:bg-white text-gray-900 text-sm rounded-xl py-2.5 px-4 font-bold outline-none transition-all"
                                        />
                                        {specificTimes.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setSpecificTimes(specificTimes.filter((_, i) => i !== idx))}
                                                className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-500 transition-colors"
                                            >
                                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {specificTimes.length < 6 && (
                                <button
                                    type="button"
                                    onClick={() => setSpecificTimes([...specificTimes, '12:00'])}
                                    className="mt-3 w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm font-bold text-gray-400 hover:border-[#7c3aed] hover:text-[#7c3aed] transition-colors flex items-center justify-center gap-1"
                                >
                                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                    Adicionar horario
                                </button>
                            )}
                            <p className="text-xs text-gray-400 font-medium mt-3">Voce sera notificado nos horarios definidos.</p>
                        </>
                    )}
                </div>

                {/* Stock Control */}
                <div className="bg-[#fff7ed] rounded-3xl p-5 shadow-sm border-2 border-[#ffedd5]">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">📦</span>
                        <p className="text-sm font-extrabold text-orange-700">Controle de Estoque</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-orange-600/80 mb-1.5 block">Qtd. que você tem agora:</label>
                            <input
                                type="number"
                                className="w-full bg-white text-orange-900 font-bold rounded-xl px-4 py-2.5 text-sm outline-none border-2 border-transparent focus:border-orange-300"
                                placeholder="Ex: 30"
                                value={stockQty}
                                onChange={e => setStockQty(e.target.value)}
                                min="0"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-orange-600/80 mb-1.5 block">Avisar quando restar:</label>
                            <input
                                type="number"
                                className="w-full bg-white text-orange-900 font-bold rounded-xl px-4 py-2.5 text-sm outline-none border-2 border-transparent focus:border-orange-300"
                                value={stockAlert}
                                onChange={e => setStockAlert(e.target.value)}
                                min="1"
                            />
                        </div>
                    </div>
                </div>

                {/* Prep time */}
                <div className="bg-[#f5f3ff] rounded-3xl p-5 shadow-sm border-2 border-[#ede9fe]">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <p className="text-sm font-extrabold text-[#7c3aed] flex items-center gap-2"><span className="text-lg">⏱</span> Preparo Antecipado</p>
                            <p className="text-[11px] font-bold text-violet-500/80 mt-1">Quer ser avisado alguns minutos antes?</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setNeedsPrep(!needsPrep)}
                            className={`w-14 h-8 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${needsPrep ? 'bg-[#7c3aed]' : 'bg-violet-200'}`}
                        >
                            <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${needsPrep ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                    {needsPrep && (
                        <div className="mt-4">
                            <label className="text-xs font-bold text-violet-600 mb-1.5 block">Quantos minutos antes de tomar o remédio?</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    className="w-24 bg-white text-[#7c3aed] font-extrabold text-center rounded-xl px-4 py-2 outline-none border-2 border-transparent focus:border-violet-300"
                                    value={prepMinutes}
                                    onChange={e => setPrepMinutes(e.target.value)}
                                    min="5" max="120"
                                />
                                <span className="text-sm font-bold text-violet-500">Minutos</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Instructions */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                    <label className="text-[13px] font-extrabold text-gray-400 uppercase tracking-wide mb-3 block">Instruções / Orientações Médicas</label>
                    <textarea
                        className="w-full bg-gray-50 text-gray-700 text-sm font-medium rounded-2xl px-4 py-3 resize-none border-2 border-transparent focus:bg-white focus:border-[#7c3aed] outline-none transition-all"
                        rows={3}
                        placeholder="Ex: Tomar com bastante água, evitar leite próximo, pode dar um leve sono..."
                        value={instructions}
                        onChange={e => setInstructions(e.target.value)}
                    />
                </div>

                {/* Submit */}
                <div className="pb-4 pt-2">
                    <button
                        type="submit"
                        className="w-full flex justify-center items-center py-4 bg-[#7c3aed] text-white rounded-full font-extrabold text-lg hover:bg-[#6d28d9] active:scale-[0.98] transition-all shadow-lg shadow-violet-200"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="w-6 h-6 border-4 border-violet-300 border-t-white rounded-full animate-spin" />
                        ) : (
                            'Salvar Medicamento'
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}

export default function AddMedicationPage() {
    return (
        <Suspense>
            <AddMedicationForm />
        </Suspense>
    )
}

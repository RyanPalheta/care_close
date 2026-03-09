'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { generateDailySchedules } from '@/lib/schedule-generator'

const UNITS = ['pílulas', 'comprimidos', 'cápsulas', 'ml', 'gramas', 'gotas']
const FREQUENCIES = [
    { value: 'daily', label: 'Uma vez ao dia' },
    { value: 'twice_day', label: '2 vezes ao dia' },
    { value: 'three_day', label: '3 vezes ao dia' },
    { value: 'weekly', label: 'Semanal' },
    { value: 'as_needed', label: 'Quando necessário' },
]
const PERIODS = [
    { value: 'antes_cafe', label: 'Antes do café' },
    { value: 'depois_cafe', label: 'Depois do café' },
    { value: 'antes_almoco', label: 'Antes do almoço' },
    { value: 'depois_almoco', label: 'Depois do almoço' },
    { value: 'antes_jantar', label: 'Antes do jantar' },
    { value: 'depois_jantar', label: 'Depois do jantar' },
]

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
        supabase
            .from('patients')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle()
            .then(({ data }) => {
                if (data) setPatientId(data.id)
            })
    }, [user, searchParams])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!patientId) {
            setError('Nenhum paciente cadastrado. Vá em "Cadastrar Paciente" primeiro.')
            return
        }
        setLoading(true)
        setError(null)

        const { data: newMed, error: err } = await supabase.from('medications').insert({
            patient_id: patientId,
            name,
            dosage,
            unit,
            frequency,
            period,
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
        <div className="page-container flex flex-col min-h-screen">
            {/* Header */}
            <div className="pt-10 pb-6">
                <button onClick={() => router.back()} className="text-gray-400 flex items-center gap-1 text-sm mb-5 w-fit">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Voltar
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Adicionar Medicamento</h1>
                <p className="text-gray-500 text-sm mt-1">Configure o remédio e os alertas</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5 flex-1">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3">{error}</div>
                )}

                {/* Name */}
                <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Nome do medicamento *</label>
                    <input type="text" className="input-field" placeholder="Ex: Losartana" value={name} onChange={e => setName(e.target.value)} required />
                </div>

                {/* Dosage + Unit */}
                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Dose *</label>
                        <input type="text" className="input-field" placeholder="Ex: 50" value={dosage} onChange={e => setDosage(e.target.value)} required />
                    </div>
                    <div className="w-36">
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Unidade</label>
                        <select className="input-field" value={unit} onChange={e => setUnit(e.target.value)}>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                </div>

                {/* Frequency */}
                <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Frequência</label>
                    <div className="flex flex-wrap gap-2">
                        {FREQUENCIES.map(f => (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setFrequency(f.value)}
                                className={`px-3 py-2 rounded-full text-sm font-medium border transition-all ${frequency === f.value
                                    ? 'bg-sky-400 text-white border-sky-400'
                                    : 'bg-white text-gray-600 border-gray-200'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Period */}
                <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Relação com refeições</label>
                    <select className="input-field" value={period} onChange={e => setPeriod(e.target.value)}>
                        <option value="">Sem relação</option>
                        {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                </div>

                {/* Stock */}
                <div className="card bg-orange-50" style={{ border: '1px solid #fed7aa' }}>
                    <p className="text-sm font-bold text-orange-700 mb-3">📦 Controle de Estoque</p>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-gray-600 mb-1 block">Qtd. atual</label>
                            <input type="number" className="input-field text-sm" placeholder="Ex: 30" value={stockQty} onChange={e => setStockQty(e.target.value)} min="0" />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-gray-600 mb-1 block">Alertar quando restar</label>
                            <input type="number" className="input-field text-sm" value={stockAlert} onChange={e => setStockAlert(e.target.value)} min="1" />
                        </div>
                    </div>
                </div>

                {/* Prep time */}
                <div className="card bg-violet-50" style={{ border: '1px solid #ddd6fe' }}>
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <p className="text-sm font-bold text-violet-700">⏱ Preparo antecipado</p>
                            <p className="text-xs text-violet-500 mt-0.5">Alerta antes da hora do remédio</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setNeedsPrep(!needsPrep)}
                            className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${needsPrep ? 'bg-violet-500' : 'bg-gray-300'}`}
                        >
                            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${needsPrep ? 'left-6' : 'left-0.5'}`} />
                        </button>
                    </div>
                    {needsPrep && (
                        <div className="mt-3">
                            <label className="text-xs font-semibold text-gray-600 mb-1 block">Alertar quantos minutos antes?</label>
                            <input type="number" className="input-field text-sm" value={prepMinutes} onChange={e => setPrepMinutes(e.target.value)} min="5" max="120" />
                        </div>
                    )}
                </div>

                {/* Instructions */}
                <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Instruções adicionais</label>
                    <textarea
                        className="input-field resize-none"
                        style={{ borderRadius: '1rem', padding: '0.875rem 1.25rem' }}
                        rows={3}
                        placeholder="Ex: Tomar com bastante água, evitar exposição ao sol..."
                        value={instructions}
                        onChange={e => setInstructions(e.target.value)}
                    />
                </div>

                {/* Submit */}
                <div className="pb-8 pt-2">
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading
                            ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : '💊 Salvar Medicamento'
                        }
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

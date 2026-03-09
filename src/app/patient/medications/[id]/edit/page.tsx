'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const UNITS = ['pílulas', 'comprimidos', 'cápsulas', 'ml', 'gramas', 'gotas']
const FREQUENCIES = [
    { value: 'daily', label: 'Uma vez ao dia' },
    { value: 'twice_day', label: '2 vezes ao dia' },
    { value: 'three_day', label: '3 vezes ao dia' },
    { value: 'weekly', label: 'Semanal' },
    { value: 'as_needed', label: 'Quando necessário' },
]

interface MedData {
    id: string
    name: string
    dosage: string
    unit: string
    frequency: string
    period: string
    stock_quantity: number
    stock_alert_at: number
    needs_prep: boolean
    prep_minutes: number | null
    instructions: string | null
    active: boolean
}

export default function EditMedicationPage() {
    const router = useRouter()
    const params = useParams()
    const medId = params.id as string
    const { user } = useAuth()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [med, setMed] = useState<MedData | null>(null)

    useEffect(() => {
        if (!medId) return
        supabase
            .from('medications')
            .select('*')
            .eq('id', medId)
            .single()
            .then(({ data }) => {
                if (data) setMed(data as MedData)
                setLoading(false)
            })
    }, [medId])

    async function handleSave() {
        if (!med) return
        setSaving(true)
        setError(null)

        const { error: err } = await supabase
            .from('medications')
            .update({
                name: med.name,
                dosage: med.dosage,
                unit: med.unit,
                frequency: med.frequency,
                stock_quantity: med.stock_quantity,
                stock_alert_at: med.stock_alert_at,
                needs_prep: med.needs_prep,
                prep_minutes: med.needs_prep ? med.prep_minutes : null,
                instructions: med.instructions,
                active: med.active,
            })
            .eq('id', med.id)

        if (err) setError(err.message)
        else router.push('/patient/medications')
        setSaving(false)
    }

    async function handleDelete() {
        if (!confirm('Tem certeza que deseja excluir este medicamento?')) return
        await supabase.from('medication_schedules').delete().eq('medication_id', medId)
        await supabase.from('medications').delete().eq('id', medId)
        router.push('/patient/medications')
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <span className="w-10 h-10 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
            </div>
        )
    }

    if (!med) {
        return (
            <div className="page-container pt-16 text-center">
                <p className="text-gray-500">Medicamento não encontrado.</p>
            </div>
        )
    }

    return (
        <div className="page-container flex flex-col min-h-screen">
            <div className="pt-10 pb-6">
                <button onClick={() => router.back()} className="text-gray-400 flex items-center gap-1 text-sm mb-5 w-fit">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Voltar
                </button>
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">Editar Medicamento</h1>
                    <button
                        onClick={() => setMed({ ...med, active: !med.active })}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${med.active
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : 'bg-gray-50 text-gray-500 border-gray-200'
                            }`}
                    >
                        {med.active ? '✅ Ativo' : '⏸ Pausado'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3 mb-4">{error}</div>
            )}

            <div className="flex flex-col gap-5 flex-1">
                {/* Name */}
                <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Nome *</label>
                    <input
                        type="text" className="input-field"
                        value={med.name}
                        onChange={e => setMed({ ...med, name: e.target.value })}
                    />
                </div>

                {/* Dosage + Unit */}
                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Dose *</label>
                        <input
                            type="text" className="input-field"
                            value={med.dosage}
                            onChange={e => setMed({ ...med, dosage: e.target.value })}
                        />
                    </div>
                    <div className="w-36">
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Unidade</label>
                        <select className="input-field" value={med.unit} onChange={e => setMed({ ...med, unit: e.target.value })}>
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
                                onClick={() => setMed({ ...med, frequency: f.value })}
                                className={`px-3 py-2 rounded-full text-sm font-medium border transition-all ${med.frequency === f.value
                                        ? 'bg-sky-400 text-white border-sky-400'
                                        : 'bg-white text-gray-600 border-gray-200'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stock */}
                <div className="card bg-orange-50" style={{ border: '1px solid #fed7aa' }}>
                    <p className="text-sm font-bold text-orange-700 mb-3">📦 Controle de Estoque</p>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-gray-600 mb-1 block">Qtd. atual</label>
                            <input
                                type="number" className="input-field text-sm"
                                value={med.stock_quantity}
                                onChange={e => setMed({ ...med, stock_quantity: parseInt(e.target.value) || 0 })}
                                min="0"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-gray-600 mb-1 block">Alertar quando restar</label>
                            <input
                                type="number" className="input-field text-sm"
                                value={med.stock_alert_at}
                                onChange={e => setMed({ ...med, stock_alert_at: parseInt(e.target.value) || 5 })}
                                min="1"
                            />
                        </div>
                    </div>
                    {med.stock_quantity <= med.stock_alert_at && med.stock_quantity > 0 && (
                        <div className="mt-3 bg-orange-100 rounded-xl px-3 py-2 text-xs text-orange-700 font-medium">
                            ⚠️ Estoque baixo! Restam {med.stock_quantity} {med.unit}
                        </div>
                    )}
                </div>

                {/* Prep */}
                <div className="card bg-violet-50" style={{ border: '1px solid #ddd6fe' }}>
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <p className="text-sm font-bold text-violet-700">⏱ Preparo antecipado</p>
                            <p className="text-xs text-violet-500 mt-0.5">Alerta antes da hora</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMed({ ...med, needs_prep: !med.needs_prep })}
                            className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${med.needs_prep ? 'bg-violet-500' : 'bg-gray-300'}`}
                        >
                            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${med.needs_prep ? 'left-6' : 'left-0.5'}`} />
                        </button>
                    </div>
                    {med.needs_prep && (
                        <div className="mt-3">
                            <label className="text-xs font-semibold text-gray-600 mb-1 block">Minutos antes</label>
                            <input
                                type="number" className="input-field text-sm"
                                value={med.prep_minutes ?? 30}
                                onChange={e => setMed({ ...med, prep_minutes: parseInt(e.target.value) || 30 })}
                                min="5" max="120"
                            />
                        </div>
                    )}
                </div>

                {/* Instructions */}
                <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Instruções</label>
                    <textarea
                        className="input-field resize-none"
                        style={{ borderRadius: '1rem', padding: '0.875rem 1.25rem' }}
                        rows={3}
                        value={med.instructions ?? ''}
                        onChange={e => setMed({ ...med, instructions: e.target.value || null })}
                    />
                </div>

                {/* Actions */}
                <div className="pb-8 pt-2 flex flex-col gap-3">
                    <button onClick={handleSave} className="btn-primary" disabled={saving}>
                        {saving
                            ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : '💾 Salvar Alterações'
                        }
                    </button>
                    <button
                        onClick={handleDelete}
                        className="py-3 rounded-2xl border border-red-200 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
                    >
                        🗑 Excluir Medicamento
                    </button>
                </div>
            </div>
        </div>
    )
}

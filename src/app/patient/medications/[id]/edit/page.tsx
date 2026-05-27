'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

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
                period: med.period,
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

        const { error: schedErr } = await supabase
            .from('medication_schedules').delete().eq('medication_id', medId)
        if (schedErr) {
            setError(`Erro ao remover agendamentos: ${schedErr.message}`)
            return
        }

        const { error: medErr } = await supabase
            .from('medications').delete().eq('id', medId)
        if (medErr) {
            setError(`Erro ao excluir medicamento: ${medErr.message}`)
            return
        }

        router.push('/patient/medications')
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f7f8fc]">
                <span className="w-10 h-10 border-4 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
            </div>
        )
    }

    if (!med) {
        return (
            <div className="page-container pt-16 text-center bg-[#f7f8fc] min-h-screen">
                <p className="text-gray-500 font-bold">Medicamento não encontrado.</p>
            </div>
        )
    }

    return (
        <div className="page-container flex flex-col min-h-screen bg-[#f7f8fc]" style={{ fontFamily: 'Lexend, sans-serif' }}>
            <div className="pt-10 pb-6 shrink-0 px-4">
                <button onClick={() => router.back()} className="text-gray-400 font-bold flex items-center gap-1 text-sm mb-5 w-fit hover:text-gray-600 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Voltar
                </button>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Editar<br />Medicamento</h1>
                        <p className="text-gray-400 font-medium text-sm mt-1">Atualize os detalhes do uso.</p>
                    </div>
                    <button
                        onClick={() => setMed({ ...med, active: !med.active })}
                        className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all shadow-sm ${med.active
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                            }`}
                    >
                        {med.active ? '✅ Ativo' : '⏸ Pausado'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mx-4 bg-red-50 border border-red-200 text-red-600 text-sm font-bold rounded-2xl px-4 py-4 shadow-sm flex items-center gap-3 mb-4">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    {error}
                </div>
            )}

            <div className="flex flex-col gap-5 flex-1 px-4 overflow-y-auto pb-8">
                {/* Name */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                    <label className="text-[13px] font-extrabold text-gray-400 uppercase tracking-wide mb-2 block">O que você vai tomar?</label>
                    <input
                        type="text" className="w-full text-xl font-bold text-gray-900 placeholder-gray-300 border-b-2 border-gray-100 pb-2 focus:outline-none focus:border-[#7c3aed] transition-colors bg-transparent"
                        value={med.name}
                        onChange={e => setMed({ ...med, name: e.target.value })}
                    />
                </div>

                {/* Visual Unit Selector */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                    <label className="text-[13px] font-extrabold text-gray-400 uppercase tracking-wide mb-3 block">Tipo do Remédio</label>
                    <div className="grid grid-cols-3 gap-3">
                        {UNITS.map(u => {
                            const active = med.unit === u.value;
                            return (
                                <button
                                    key={u.value}
                                    type="button"
                                    onClick={() => setMed({ ...med, unit: u.value })}
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
                            value={med.dosage}
                            onChange={e => setMed({ ...med, dosage: e.target.value })}
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
                                onClick={() => setMed({ ...med, frequency: f.value })}
                                className={`text-left p-3 rounded-2xl border-2 transition-all ${med.frequency === f.value
                                        ? 'bg-[#f0fdf4] border-[#4ade80] shadow-sm'
                                        : 'bg-white border-gray-100 hover:border-gray-200'
                                    }`}
                            >
                                <div className={`font-extrabold text-sm mb-0.5 ${med.frequency === f.value ? 'text-green-700' : 'text-gray-700'}`}>{f.label}</div>
                                <div className={`text-[10px] font-bold ${med.frequency === f.value ? 'text-green-600/70' : 'text-gray-400'}`}>{f.desc}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Visual Period Selector (Meals) */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                    <label className="text-[13px] font-extrabold text-gray-400 uppercase tracking-wide mb-3 block">Relação com Refeições</label>
                    <select
                        className="w-full bg-gray-50 border-2 border-transparent focus:border-[#7c3aed] focus:bg-white text-gray-900 text-sm rounded-xl py-3 px-4 font-bold outline-none mb-3 cursor-pointer appearance-none"
                        value={med.period ?? ''}
                        onChange={e => setMed({ ...med, period: e.target.value })}
                    >
                        <option value="">Nenhuma relação (Qualquer hora)</option>
                        {PERIODS.map(p => <option key={p.value} value={p.value}>{p.icon} {p.label}</option>)}
                    </select>
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
                                value={med.stock_quantity}
                                onChange={e => setMed({ ...med, stock_quantity: parseInt(e.target.value) || 0 })}
                                min="0"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-orange-600/80 mb-1.5 block">Avisar quando restar:</label>
                            <input
                                type="number"
                                className="w-full bg-white text-orange-900 font-bold rounded-xl px-4 py-2.5 text-sm outline-none border-2 border-transparent focus:border-orange-300"
                                value={med.stock_alert_at}
                                onChange={e => setMed({ ...med, stock_alert_at: parseInt(e.target.value) || 5 })}
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
                            onClick={() => setMed({ ...med, needs_prep: !med.needs_prep })}
                            className={`w-14 h-8 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${med.needs_prep ? 'bg-[#7c3aed]' : 'bg-violet-200'}`}
                        >
                            <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${med.needs_prep ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                    {med.needs_prep && (
                        <div className="mt-4">
                            <label className="text-xs font-bold text-violet-600 mb-1.5 block">Quantos minutos antes?</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number" className="w-24 bg-white text-[#7c3aed] font-extrabold text-center rounded-xl px-4 py-2 outline-none border-2 border-transparent focus:border-violet-300"
                                    value={med.prep_minutes ?? 30}
                                    onChange={e => setMed({ ...med, prep_minutes: parseInt(e.target.value) || 30 })}
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
                        value={med.instructions ?? ''}
                        onChange={e => setMed({ ...med, instructions: e.target.value || null })}
                    />
                </div>

                {/* Actions */}
                <div className="pb-4 pt-2 flex flex-col gap-3">
                    <button onClick={handleSave} className="w-full flex justify-center items-center py-4 bg-[#7c3aed] text-white rounded-full font-extrabold text-lg hover:bg-[#6d28d9] active:scale-[0.98] transition-all shadow-lg shadow-violet-200" disabled={saving}>
                        {saving
                            ? <span className="w-6 h-6 border-4 border-violet-300 border-t-white rounded-full animate-spin" />
                            : '💾 Salvar Alterações'
                        }
                    </button>
                    <button
                        onClick={handleDelete}
                        className="py-4 rounded-full border-2 border-red-100 bg-red-50 text-red-600 font-extrabold text-sm hover:bg-red-100 transition-colors"
                    >
                        🗑 Excluir Medicamento
                    </button>
                </div>
            </div>
        </div>
    )
}

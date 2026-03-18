'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

export default function AddPatientPage() {
    const router = useRouter()
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [name, setName] = useState('')
    const [birthDate, setBirthDate] = useState('')
    const [medicalNotes, setMedicalNotes] = useState('')

    function handleBirthDateChange(e: React.ChangeEvent<HTMLInputElement>) {
        let value = e.target.value.replace(/\D/g, '')
        if (value.length > 8) value = value.slice(0, 8)
        if (value.length >= 5) {
            value = value.slice(0, 2) + '/' + value.slice(2, 4) + '/' + value.slice(4)
        } else if (value.length >= 3) {
            value = value.slice(0, 2) + '/' + value.slice(2)
        }
        setBirthDate(value)
    }

    function birthDateToISO(ddmmyyyy: string): string | null {
        const parts = ddmmyyyy.split('/')
        if (parts.length !== 3 || parts[2].length !== 4) return null
        const [dd, mm, yyyy] = parts
        const day = parseInt(dd, 10)
        const month = parseInt(mm, 10)
        const year = parseInt(yyyy, 10)
        if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) return null
        return `${yyyy}-${mm}-${dd}`
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!user) return
        setLoading(true)
        setError(null)

        const isoDate = birthDate ? birthDateToISO(birthDate) : null
        if (birthDate && !isoDate) {
            setError('Data de nascimento inválida. Use o formato dd/mm/aaaa.')
            setLoading(false)
            return
        }

        try {
            // 1. Find or create license for this user
            let { data: license, error: fetchErr } = await supabase
                .from('licenses')
                .select('id')
                .eq('owner_id', user.id)
                .maybeSingle()

            if (fetchErr) throw fetchErr

            if (!license) {
                const { data: newLicense, error: licenseErr } = await supabase
                    .from('licenses')
                    .insert({ owner_id: user.id, plan_type: 'family', max_patients: 1, max_members: 5 })
                    .select('id')
                    .single()
                if (licenseErr) throw licenseErr
                license = newLicense
            }

            // 2. Insert patient (with user_id so the home page can find it)
            const { error: patientErr } = await supabase.from('patients').insert({
                license_id: license!.id,
                user_id: user.id,
                name,
                birth_date: isoDate,
                medical_notes: medicalNotes || null,
            })

            if (patientErr) throw patientErr

            const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
            if (profile?.role === 'caregiver') {
                router.push('/caregiver/home')
            } else {
                router.push('/patient/medications')
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            setError(msg)
            console.error('Patient registration error:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="page-container flex flex-col min-h-screen">
            {/* Header */}
            <div className="pt-10 pb-6 animate-up">
                <button onClick={() => router.back()} className="text-gray-400 flex items-center gap-1 text-sm mb-6 w-fit">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Voltar
                </button>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-3xl mb-4 shadow">
                    🧓
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Cadastrar Paciente</h1>
                <p className="text-gray-500 text-sm mt-1">Informe os dados básicos para começar</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-5 flex-1">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3">
                        {error}
                    </div>
                )}

                <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                        Nome completo <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="Ex: Maria Aparecida"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                    />
                </div>

                <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                        Data de nascimento
                    </label>
                    <input
                        type="text"
                        inputMode="numeric"
                        className="input-field"
                        placeholder="dd/mm/aaaa"
                        maxLength={10}
                        value={birthDate}
                        onChange={handleBirthDateChange}
                    />
                </div>

                <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                        Observações médicas importantes
                    </label>
                    <textarea
                        className="input-field resize-none"
                        style={{ borderRadius: '1rem', padding: '0.875rem 1.25rem' }}
                        rows={4}
                        placeholder="Ex: Diabético tipo 2, restrição de sódio, alergia à penicilina..."
                        value={medicalNotes}
                        onChange={e => setMedicalNotes(e.target.value)}
                    />
                    <p className="text-xs text-gray-400 mt-1.5 ml-1">
                        Essas informações serão visíveis para todos os cuidadores vinculados
                    </p>
                </div>

                <div className="mt-auto pb-8 pt-4">
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? (
                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>Cadastrar Paciente <span className="ml-1">→</span></>
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}

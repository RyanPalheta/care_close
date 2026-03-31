'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { IconHome, IconCalendar, IconBarChart, IconSettings } from '@/components/Icons'

interface Contact {
    id: string
    name: string
    email: string | null
    phone: string | null
    relationship: string | null
    patient_name?: string
}

interface Patient {
    id: string
    name: string
}

export default function CaregiverContactsPage() {
    const { user } = useAuth()
    const [contacts, setContacts] = useState<Contact[]>([])
    const [patients, setPatients] = useState<Patient[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)

    // Form state
    const [formName, setFormName] = useState('')
    const [formEmail, setFormEmail] = useState('')
    const [formPhone, setFormPhone] = useState('')
    const [formRelationship, setFormRelationship] = useState('')
    const [formPatientId, setFormPatientId] = useState('')

    useEffect(() => {
        if (!user) return
        loadData()
    }, [user])

    async function loadData() {
        // Get license
        const { data: license } = await supabase
            .from('licenses')
            .select('id')
            .or(`owner_id.eq.${user!.id},assigned_to.eq.${user!.id}`)
            .eq('status', 'active')
            .maybeSingle()

        if (!license) { setLoading(false); return }

        // Get patients
        const { data: patientsData } = await supabase
            .from('patients')
            .select('id, name')
            .eq('license_id', license.id)

        if (patientsData) {
            setPatients(patientsData)
            if (patientsData.length > 0) setFormPatientId(patientsData[0].id)
        }

        // Get contacts for all patients
        if (patientsData && patientsData.length > 0) {
            const patientIds = patientsData.map(p => p.id)
            const { data: contactsData } = await supabase
                .from('contacts')
                .select('id, name, email, phone, relationship, patient_id')
                .in('patient_id', patientIds)
                .order('created_at', { ascending: false })

            if (contactsData) {
                const enriched = contactsData.map(c => ({
                    ...c,
                    patient_name: patientsData.find(p => p.id === (c as any).patient_id)?.name,
                }))
                setContacts(enriched)
            }
        }

        setLoading(false)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!formPatientId) return
        setSaving(true)
        setError(null)

        const { data, error: err } = await supabase
            .from('contacts')
            .insert({
                patient_id: formPatientId,
                added_by: user!.id,
                name: formName,
                email: formEmail || null,
                phone: formPhone || null,
                relationship: formRelationship || null,
            })
            .select('id, name, email, phone, relationship')
            .single()

        if (err) {
            setError(err.message)
        } else if (data) {
            const patientName = patients.find(p => p.id === formPatientId)?.name
            setContacts([{ ...data, patient_name: patientName }, ...contacts])
            setShowForm(false)
            setFormName('')
            setFormEmail('')
            setFormPhone('')
            setFormRelationship('')
            setMessage('Contato adicionado!')
            setTimeout(() => setMessage(null), 3000)
        }

        setSaving(false)
    }

    async function deleteContact(id: string) {
        await supabase.from('contacts').delete().eq('id', id)
        setContacts(contacts.filter(c => c.id !== id))
    }

    return (
        <div className="min-h-screen bg-[#f7f8fc] pb-28" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {/* Header */}
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-5 pt-12 pb-10 text-white relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10" />
                <div className="relative z-10">
                    <h1 className="text-xl font-extrabold">Contatos</h1>
                    <p className="text-violet-200 text-sm mt-0.5">Familiares e responsaveis que recebem relatorios</p>
                </div>
            </div>

            <div className="px-4 -mt-4 relative z-10">
                {loading ? (
                    <div className="flex justify-center p-10">
                        <span className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3 mb-4">
                                {error}
                            </div>
                        )}
                        {message && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl px-4 py-3 mb-4 font-bold">
                                {message}
                            </div>
                        )}

                        {/* Add contact button */}
                        {!showForm && patients.length > 0 && (
                            <button
                                onClick={() => setShowForm(true)}
                                className="w-full bg-[#7c3aed] text-white font-extrabold py-4 rounded-2xl mb-4 flex items-center justify-center gap-2 hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200"
                            >
                                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                Adicionar Contato
                            </button>
                        )}

                        {/* Form */}
                        {showForm && (
                            <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-4">
                                <h3 className="font-extrabold text-gray-900 mb-4">Novo Contato</h3>

                                {patients.length > 1 && (
                                    <div className="mb-3">
                                        <label className="text-xs font-bold text-gray-500 mb-1 block uppercase">Paciente</label>
                                        <select
                                            className="input-field"
                                            value={formPatientId}
                                            onChange={e => setFormPatientId(e.target.value)}
                                        >
                                            {patients.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="flex flex-col gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 mb-1 block uppercase">Nome *</label>
                                        <input type="text" className="input-field" value={formName} onChange={e => setFormName(e.target.value)} required placeholder="Ex: Maria (Mae)" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 mb-1 block uppercase">Email</label>
                                        <input type="email" className="input-field" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="email@exemplo.com" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 mb-1 block uppercase">Telefone</label>
                                        <input type="tel" className="input-field" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="(99) 99999-9999" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 mb-1 block uppercase">Parentesco</label>
                                        <input type="text" className="input-field" value={formRelationship} onChange={e => setFormRelationship(e.target.value)} placeholder="Ex: Filha, Esposo, Medico" />
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <button type="submit" disabled={saving} className="flex-1 bg-[#7c3aed] text-white font-bold py-3 rounded-2xl hover:bg-violet-700 transition-colors disabled:opacity-50">
                                        {saving ? 'Salvando...' : 'Salvar'}
                                    </button>
                                    <button type="button" onClick={() => setShowForm(false)} className="px-5 py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors">
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Contact list */}
                        {contacts.length === 0 && !showForm ? (
                            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center">
                                <p className="text-4xl mb-3">📋</p>
                                <p className="font-bold text-gray-700">Nenhum contato cadastrado</p>
                                <p className="text-sm text-gray-400 mt-1">Adicione familiares ou responsaveis para enviar relatorios</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {contacts.map(contact => (
                                    <div key={contact.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="font-bold text-gray-900">{contact.name}</p>
                                                {contact.relationship && (
                                                    <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-bold mt-1 inline-block">
                                                        {contact.relationship}
                                                    </span>
                                                )}
                                                {contact.patient_name && (
                                                    <p className="text-xs text-gray-400 mt-1">Paciente: {contact.patient_name}</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => deleteContact(contact.id)}
                                                className="text-red-400 hover:text-red-600 p-1 transition-colors"
                                                title="Remover contato"
                                            >
                                                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                            {contact.email && <span>{contact.email}</span>}
                                            {contact.phone && <span>{contact.phone}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                <Link href="/caregiver/home" className="bottom-nav-item">
                    <IconHome size={22} /><span>Pacientes</span>
                </Link>
                <Link href="/caregiver/schedule" className="bottom-nav-item">
                    <IconCalendar size={22} /><span>Agenda</span>
                </Link>
                <Link href="/caregiver/alerts" className="bottom-nav-item">
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    <span>Avisos</span>
                </Link>
                <Link href="/caregiver/settings" className="bottom-nav-item">
                    <IconSettings size={22} /><span>Config</span>
                </Link>
            </nav>
        </div>
    )
}

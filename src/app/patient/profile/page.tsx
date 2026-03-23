'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { IconHome, IconPill, IconRoutine, IconBarChart, IconLogout, IconCamera, IconBell } from '@/components/Icons'
import { registerServiceWorker, subscribeToPush } from '@/lib/push-notifications'

interface PatientProfile {
    id: string
    name: string
    birth_date: string | null
    medical_notes: string | null
    avatar_url: string | null
}

export default function PatientProfilePage() {
    const { user, profile } = useAuth()
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [patient, setPatient] = useState<PatientProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    const [name, setName] = useState('')
    const [birthDate, setBirthDate] = useState('')
    const [notes, setNotes] = useState('')
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)
    const [notifEnabled, setNotifEnabled] = useState(false)
    const [notifLeadTime, setNotifLeadTime] = useState(5)
    const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')

    useEffect(() => {
        if (!user) return
        loadProfile()
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setNotifPermission(Notification.permission)
        }
    }, [user])

    async function loadProfile() {
        // Fetch patient record
        const { data: patientData } = await supabase
            .from('patients')
            .select('*')
            .eq('user_id', user!.id)
            .maybeSingle()

        // Fetch user name and avatar from users table
        const { data: userData } = await supabase
            .from('users')
            .select('name, avatar_url')
            .eq('id', user!.id)
            .maybeSingle()

        if (patientData) {
            setPatient(patientData)
            // Convert ISO (yyyy-mm-dd) to dd/mm/aaaa for display
            if (patientData.birth_date) {
                const [y, m, d] = patientData.birth_date.split('-')
                setBirthDate(`${d}/${m}/${y}`)
            } else {
                setBirthDate('')
            }
            setNotes(patientData.medical_notes || '')
            // Avatar: prefer patients.avatar_url (uploaded photo), fallback to users.avatar_url
            setAvatarUrl(patientData.avatar_url || userData?.avatar_url || null)
        }
        // Name always comes from users table
        if (userData) {
            setName(userData.name || '')
        }
        setLoading(false)
    }

    async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !patient) return
        setUploadingPhoto(true)
        setMessage(null)

        try {
            const ext = file.name.split('.').pop()
            const path = `${patient.id}/avatar.${ext}`

            // Try to create bucket if it doesn't exist yet
            await supabase.storage.createBucket('avatars', { public: true }).catch(() => { })

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(path, file, { upsert: true, contentType: file.type })

            if (uploadError) {
                if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('bucket')) {
                    throw new Error('Bucket "avatars" não encontrado. Crie-o no painel do Supabase: Storage → New Bucket → "avatars" (público).')
                }
                throw uploadError
            }

            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
            const publicUrl = urlData.publicUrl + `?t=${Date.now()}`

            await supabase.from('patients').update({ avatar_url: publicUrl }).eq('id', patient.id)
            setAvatarUrl(publicUrl)
            setMessage({ text: 'Foto atualizada com sucesso!', type: 'success' })
        } catch (err: any) {
            setMessage({ text: err.message || 'Erro ao fazer upload da foto', type: 'error' })
        } finally {
            setUploadingPhoto(false)
        }
    }

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

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setMessage(null)

        const isoDate = birthDate ? birthDateToISO(birthDate) : null
        if (birthDate && !isoDate) {
            setMessage({ text: 'Data de nascimento inválida. Use o formato dd/mm/aaaa.', type: 'error' })
            setSaving(false)
            return
        }

        try {
            if (name !== profile?.name) {
                await supabase.auth.updateUser({ data: { name } })
            }
            await supabase.from('users').update({ name }).eq('id', user!.id)
            if (patient) {
                await supabase.from('patients').update({
                    birth_date: isoDate,
                    medical_notes: notes || null
                }).eq('id', patient.id)
            }
            setMessage({ text: 'Perfil atualizado com sucesso!', type: 'success' })
        } catch (err: any) {
            setMessage({ text: err.message || 'Erro ao atualizar', type: 'error' })
        } finally {
            setSaving(false)
        }
    }

    async function handleEnableNotifications() {
        const sub = await subscribeToPush()
        if (sub || Notification.permission === 'granted') {
            setNotifEnabled(true)
            setNotifPermission('granted')
            setMessage({ text: 'Notificações ativadas!', type: 'success' })
        } else {
            setMessage({ text: 'Permissão negada. Verifique as configurações do navegador.', type: 'error' })
        }
    }

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/auth')
    }

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
            <div className="bg-gradient-to-br from-sky-400 to-blue-500 px-5 pt-12 pb-20 text-white relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
                <div className="relative z-10">
                    <h1 className="text-xl font-extrabold">Meu Perfil</h1>
                    <p className="text-sky-200 text-sm mt-0.5">{user?.email}</p>
                </div>
            </div>

            {/* Avatar upload card */}
            <div className="px-4 -mt-8 relative z-20">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-4">
                    <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className="relative">
                            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-sky-200 to-sky-300 flex-shrink-0">
                                {avatarUrl
                                    ? <img src={avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center text-white font-extrabold text-2xl">
                                        {name?.[0] ?? 'P'}
                                    </div>}
                            </div>
                            {/* Upload button overlay */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingPhoto}
                                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-[#42b6f0] flex items-center justify-center shadow-lg hover:bg-sky-500 transition-colors"
                                title="Trocar foto"
                            >
                                {uploadingPhoto
                                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    : <IconCamera size={14} color="white" />}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handlePhotoUpload}
                            />
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <p className="font-extrabold text-gray-900 text-lg leading-tight">{name || 'Sem nome'}</p>
                            <p className="text-sm text-gray-400 mt-0.5 truncate">{user?.email}</p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingPhoto}
                                className="mt-2 text-sm text-[#42b6f0] font-bold hover:underline self-start bg-sky-50 px-3 py-1.5 rounded-xl transition-colors"
                            >
                                {uploadingPhoto ? 'Carregando foto...' : 'Trocar foto de perfil'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Message */}
                {message && (
                    <div className={`px-4 py-3 rounded-2xl text-sm font-medium mb-4 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                        {message.text}
                    </div>
                )}

                {/* Profile form */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-4">
                    <h2 className="font-extrabold text-gray-900 mb-4">Dados Pessoais</h2>
                    <form onSubmit={handleSave} className="flex flex-col gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase tracking-wide">Nome Completo</label>
                            <input
                                type="text" className="input-field"
                                value={name} onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase tracking-wide">Data de Nascimento</label>
                            <input
                                type="text" inputMode="numeric" className="input-field"
                                placeholder="dd/mm/aaaa" maxLength={10}
                                value={birthDate} onChange={handleBirthDateChange}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase tracking-wide">Observações Médicas / Alergias</label>
                            <textarea
                                className="input-field resize-none h-20"
                                value={notes} onChange={e => setNotes(e.target.value)}
                                placeholder="Ex: Alérgico a penicilina..."
                            />
                        </div>
                        <button type="submit" className="btn-primary" disabled={saving}>
                            {saving ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </form>
                </div>

                {/* Notification Settings */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-4">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-[#fef3f3] flex items-center justify-center">
                            <IconBell size={16} color="#f87171" />
                        </div>
                        <h2 className="font-extrabold text-gray-900">Notificações</h2>
                    </div>

                    <div className="flex flex-col gap-4">
                        {/* Enable push */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-semibold text-gray-800 text-sm">Lembretes de Remédio</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {notifPermission === 'granted' ? 'Ativado' : 'Requer permissão do navegador'}
                                </p>
                            </div>
                            {notifPermission !== 'granted' ? (
                                <button
                                    onClick={handleEnableNotifications}
                                    className="bg-[#42b6f0] text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-sky-500 transition-colors"
                                >
                                    Ativar
                                </button>
                            ) : (
                                <div className="w-5 h-5 rounded-full bg-[#4ade80] flex items-center justify-center">
                                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>
                            )}
                        </div>

                        {/* Lead time slider */}
                        {notifPermission === 'granted' && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold text-gray-600">Avisar com antecedência</p>
                                    <span className="text-xs font-extrabold text-[#42b6f0]">{notifLeadTime} min antes</span>
                                </div>
                                <input
                                    type="range" min={1} max={30} step={1}
                                    value={notifLeadTime}
                                    onChange={e => setNotifLeadTime(Number(e.target.value))}
                                    className="w-full accent-[#42b6f0]"
                                />
                                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                    <span>1 min</span>
                                    <span>15 min</span>
                                    <span>30 min</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Minha Equipe */}
                <Link
                    href="/patient/team"
                    className="w-full bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-4 flex items-center gap-4 hover:bg-sky-50 transition-colors"
                >
                    <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#42b6f0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="font-extrabold text-gray-900">Minha Equipe</p>
                        <p className="text-xs text-gray-400 mt-0.5">Convide cuidadores e familiares</p>
                    </div>
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </Link>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="w-full bg-white rounded-3xl border border-red-100 text-red-600 font-bold flex items-center justify-center gap-2 py-4 hover:bg-red-50 transition-colors shadow-sm"
                >
                    <IconLogout size={18} color="#ef4444" />
                    Sair da Conta
                </button>
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                <Link href="/patient/home" className="bottom-nav-item">
                    <IconHome size={22} />
                    <span>Início</span>
                </Link>
                <Link href="/patient/medications" className="bottom-nav-item">
                    <IconPill size={22} />
                    <span>Remédios</span>
                </Link>
                <Link href="/patient/routine" className="bottom-nav-item">
                    <IconRoutine size={22} />
                    <span>Rotina</span>
                </Link>
                <Link href="/patient/reports" className="bottom-nav-item">
                    <IconBarChart size={22} />
                    <span>Relatórios</span>
                </Link>
            </nav>
        </div>
    )
}

'use client'

import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { IconHome, IconCalendar, IconBarChart, IconSettings, IconLogout, IconBell, IconUsers, IconCamera } from '@/components/Icons'
import { useRouter } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'

export default function CaregiverSettingsPage() {
    const { user, profile } = useAuth()
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [name, setName] = useState('')
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

    useEffect(() => {
        if (!user) return
        supabase
            .from('users')
            .select('name, avatar_url')
            .eq('id', user.id)
            .maybeSingle()
            .then(({ data }) => {
                if (data) {
                    setName(data.name || '')
                    setAvatarUrl(data.avatar_url || null)
                }
            })
    }, [user])

    async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !user) return
        setUploadingPhoto(true)
        setMessage(null)
        try {
            const ext = file.name.split('.').pop()
            const path = `caregiver_${user.id}/avatar.${ext}`
            await supabase.storage.createBucket('avatars', { public: true }).catch(() => { })
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(path, file, { upsert: true, contentType: file.type })
            if (uploadError) throw uploadError

            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
            const publicUrl = urlData.publicUrl + `?t=${Date.now()}`

            await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id)
            setAvatarUrl(publicUrl)
            setMessage({ text: 'Foto atualizada com sucesso!', type: 'success' })
        } catch (err: any) {
            setMessage({ text: err.message || 'Erro ao fazer upload.', type: 'error' })
        } finally {
            setUploadingPhoto(false)
        }
    }

    async function handleSaveName(e: React.FormEvent) {
        e.preventDefault()
        if (!user) return
        setSaving(true)
        setMessage(null)
        const { error } = await supabase.from('users').update({ name }).eq('id', user.id)
        if (error) setMessage({ text: error.message, type: 'error' })
        else setMessage({ text: 'Nome atualizado!', type: 'success' })
        setSaving(false)
    }

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/auth')
    }

    const initials = (name || profile?.name || 'C')[0].toUpperCase()

    return (
        <div className="pb-24 min-h-screen bg-[#f7f8fc]" style={{ fontFamily: 'Lexend, sans-serif' }}>

            {/* Header */}
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-6 pt-12 pb-16 text-white relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10" />
                <div className="relative z-10">
                    <h1 className="text-xl font-extrabold mb-0.5">Configurações</h1>
                    <p className="text-violet-200 text-sm">{name || profile?.name} • {user?.email}</p>
                </div>
            </div>

            <div className="px-4 -mt-8 relative z-10">

                {/* Profile Card */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-4">
                    <p className="text-[13px] font-extrabold text-gray-400 uppercase tracking-wide mb-4">Meu Perfil</p>

                    {/* Avatar Row */}
                    <div className="flex items-center gap-4 mb-5">
                        <div className="relative flex-shrink-0">
                            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-violet-300 to-purple-400 flex items-center justify-center">
                                {avatarUrl
                                    ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                    : <span className="text-white font-extrabold text-2xl">{initials}</span>}
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingPhoto}
                                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-[#7c3aed] flex items-center justify-center shadow-lg hover:bg-violet-700 transition-colors cursor-pointer"
                            >
                                {uploadingPhoto
                                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    : <IconCamera size={14} color="white" />}
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-extrabold text-gray-900 text-lg leading-tight truncate">{name || profile?.name || 'Cuidador'}</p>
                            <p className="text-sm text-gray-400 truncate">{user?.email}</p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingPhoto}
                                className="mt-2 text-sm text-[#7c3aed] font-bold hover:underline bg-violet-50 px-3 py-1.5 rounded-xl transition-colors"
                            >
                                {uploadingPhoto ? 'Enviando...' : 'Trocar foto'}
                            </button>
                        </div>
                    </div>

                    {/* Name Edit */}
                    <form onSubmit={handleSaveName} className="flex flex-col gap-3">
                        <div>
                            <label className="text-xs font-extrabold text-gray-400 uppercase tracking-wide mb-1.5 block">Nome Completo</label>
                            <input
                                type="text"
                                className="w-full bg-gray-50 text-gray-900 font-bold rounded-xl px-4 py-3 text-sm border-2 border-transparent focus:border-[#7c3aed] focus:bg-white outline-none transition-all"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Seu nome completo"
                                required
                            />
                        </div>
                        {message && (
                            <div className={`px-4 py-2.5 rounded-2xl text-sm font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                {message.text}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-[#7c3aed] text-white font-extrabold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-violet-700 transition-colors disabled:opacity-60"
                        >
                            {saving ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Salvar Alterações'}
                        </button>
                    </form>
                </div>

                {/* Account Actions */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-4">
                    <p className="text-[13px] font-extrabold text-gray-400 uppercase tracking-wide px-5 pt-5 pb-3">Sua Conta</p>

                    <Link href="/institution/dashboard" className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-bold text-gray-800 text-sm">Meu Plano (Licença)</p>
                                <p className="text-xs text-gray-400">Ver contrato e faturamento</p>
                            </div>
                        </div>
                        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </Link>

                    <Link href="/caregiver/license" className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                                <IconUsers size={18} color="#42b6f0" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-800 text-sm">Minha Licença</p>
                                <p className="text-xs text-gray-400">Visualizar status profissional</p>
                            </div>
                        </div>
                        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </Link>
                </div>

                {/* App */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-4">
                    <p className="text-[13px] font-extrabold text-gray-400 uppercase tracking-wide px-5 pt-5 pb-3">Aplicativo</p>
                    <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center"><IconBell size={18} color="#f87171" /></div>
                            <p className="font-bold text-gray-800 text-sm">Notificações</p>
                        </div>
                        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                    <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.94 14a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.88 3.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 10a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                            </div>
                            <p className="font-bold text-gray-800 text-sm">Ajuda e Suporte</p>
                        </div>
                        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="w-full bg-white rounded-3xl border-2 border-red-100 text-red-600 font-extrabold flex items-center justify-center gap-2 py-4 hover:bg-red-50 transition-colors shadow-sm"
                >
                    <IconLogout size={18} color="#ef4444" />
                    Sair da Conta
                </button>
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                <Link href="/caregiver/home" className="bottom-nav-item">
                    <IconHome size={22} /><span>Pacientes</span>
                </Link>
                <Link href="/caregiver/schedule" className="bottom-nav-item">
                    <IconCalendar size={22} /><span>Agenda</span>
                </Link>
                <Link href="/caregiver/reports" className="bottom-nav-item">
                    <IconBarChart size={22} /><span>Relatórios</span>
                </Link>
                <Link href="/caregiver/settings" className="bottom-nav-item active">
                    <IconSettings size={22} color="#7c3aed" /><span style={{ color: '#7c3aed' }}>Config</span>
                </Link>
            </nav>
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

type Status = 'loading' | 'signup_form' | 'accepting' | 'success' | 'error'
type Role = 'family' | 'caregiver'

export default function InvitePage() {
    const { token } = useParams<{ token: string }>()
    const { user, loading: authLoading } = useAuth()
    const router = useRouter()
    const [status, setStatus] = useState<Status>('loading')
    const [error, setError] = useState('')
    const [inviterName, setInviterName] = useState('')

    // Form fields
    const [formName, setFormName] = useState('')
    const [formRole, setFormRole] = useState<Role>('family')
    const [formEmail, setFormEmail] = useState('')
    const [formPassword, setFormPassword] = useState('')
    const [saving, setSaving] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    // Validate token and get inviter info on load
    useEffect(() => {
        validateInvite()
    }, [token])

    // If user is already logged in, pre-fill and show form
    useEffect(() => {
        if (authLoading) return
        if (user) {
            setFormEmail(user.email || '')
            // Already logged in - show form to confirm details
            if (status === 'loading' || status === 'signup_form') {
                setStatus('signup_form')
            }
        }
    }, [user, authLoading])

    async function validateInvite() {
        const { data: invite } = await supabase
            .from('invites')
            .select('id, status, invited_by')
            .eq('invite_token', token)
            .maybeSingle()

        if (!invite) {
            setError('Convite nao encontrado.')
            setStatus('error')
            return
        }

        if (invite.status === 'accepted') {
            setError('Este convite ja foi aceito.')
            setStatus('error')
            return
        }

        if (invite.status === 'revoked') {
            setError('Este convite foi revogado.')
            setStatus('error')
            return
        }

        // Get inviter name
        const { data: inviter } = await supabase
            .from('users')
            .select('name')
            .eq('id', invite.invited_by)
            .maybeSingle()

        if (inviter?.name) setInviterName(inviter.name)

        setStatus('signup_form')
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!formName.trim() || !formEmail.trim()) return
        setSaving(true)
        setError('')

        try {
            let currentUser = user

            if (!currentUser) {
                // Create new account
                if (!formPassword || formPassword.length < 6) {
                    setError('A senha deve ter pelo menos 6 caracteres.')
                    setSaving(false)
                    return
                }

                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                    email: formEmail.trim(),
                    password: formPassword,
                    options: { data: { name: formName.trim() } }
                })

                if (signUpError) {
                    setError(signUpError.message)
                    setSaving(false)
                    return
                }

                currentUser = signUpData.user
                if (!currentUser) {
                    setError('Erro ao criar conta. Tente novamente.')
                    setSaving(false)
                    return
                }
            }

            // Upsert profile (users table has no email column - email is in auth.users)
            const { error: profileError } = await supabase.from('users').upsert({
                id: currentUser.id,
                name: formName.trim(),
                role: formRole,
            }, { onConflict: 'id' })

            if (profileError) {
                setError('Erro ao criar perfil: ' + profileError.message)
                setSaving(false)
                return
            }

            // Accept invite
            setStatus('accepting')

            const { data, error: rpcError } = await supabase.rpc('accept_invite', {
                p_token: token,
            })

            if (rpcError) {
                setError(rpcError.message)
                setStatus('error')
                setSaving(false)
                return
            }

            if (data?.error) {
                setError(data.error)
                setStatus('error')
                setSaving(false)
                return
            }

            setStatus('success')
            setTimeout(() => {
                router.replace('/guest/home')
            }, 2000)

        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erro inesperado'
            setError(msg)
            setStatus('error')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#e8f5fd] to-white px-6" style={{ fontFamily: 'Lexend, sans-serif' }}>
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 w-full max-w-sm">

                {status === 'loading' && (
                    <div className="text-center">
                        <span className="w-10 h-10 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin mx-auto block mb-4" />
                        <p className="text-gray-500">Verificando convite...</p>
                    </div>
                )}

                {status === 'signup_form' && (
                    <>
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-sky-100 flex items-center justify-center mb-4">
                                <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#42b6f0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-extrabold text-gray-900 mb-1">Voce foi convidado!</h2>
                            {inviterName && (
                                <p className="text-sm text-gray-400">
                                    <span className="font-bold text-[#42b6f0]">{inviterName}</span> convidou voce para acompanhar o cuidado pelo Care Close.
                                </p>
                            )}
                            {!inviterName && (
                                <p className="text-sm text-gray-400">
                                    Crie sua conta para acompanhar o cuidado.
                                </p>
                            )}
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3 mb-4">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            {/* Nome */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase tracking-wide">
                                    Seu nome
                                </label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    placeholder="Nome completo"
                                    required
                                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-gray-900 text-sm font-medium focus:outline-none focus:border-[#42b6f0] focus:ring-2 focus:ring-[#42b6f0]/20 transition-all"
                                />
                            </div>

                            {/* Role */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-wide">
                                    Voce e...
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormRole('family')}
                                        className={`py-3.5 rounded-2xl border-2 text-sm font-bold transition-all ${
                                            formRole === 'family'
                                                ? 'border-[#42b6f0] bg-sky-50 text-[#42b6f0]'
                                                : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="flex flex-col items-center gap-1.5">
                                            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                            </svg>
                                            Familiar
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormRole('caregiver')}
                                        className={`py-3.5 rounded-2xl border-2 text-sm font-bold transition-all ${
                                            formRole === 'caregiver'
                                                ? 'border-[#7c3aed] bg-violet-50 text-[#7c3aed]'
                                                : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="flex flex-col items-center gap-1.5">
                                            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                                <line x1="12" y1="18" x2="12" y2="12" />
                                                <line x1="9" y1="15" x2="15" y2="15" />
                                            </svg>
                                            Cuidador
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase tracking-wide">
                                    E-mail
                                </label>
                                <input
                                    type="email"
                                    value={formEmail}
                                    onChange={e => setFormEmail(e.target.value)}
                                    placeholder="seu@email.com"
                                    required
                                    disabled={!!user}
                                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-gray-900 text-sm font-medium focus:outline-none focus:border-[#42b6f0] focus:ring-2 focus:ring-[#42b6f0]/20 transition-all disabled:bg-gray-50 disabled:text-gray-400"
                                />
                            </div>

                            {/* Password - only for new users */}
                            {!user && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase tracking-wide">
                                        Criar senha
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={formPassword}
                                            onChange={e => setFormPassword(e.target.value)}
                                            placeholder="Minimo 6 caracteres"
                                            required
                                            minLength={6}
                                            className="w-full px-4 py-3 pr-12 rounded-2xl border border-gray-200 text-gray-900 text-sm font-medium focus:outline-none focus:border-[#42b6f0] focus:ring-2 focus:ring-[#42b6f0]/20 transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? (
                                                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                                    <line x1="1" y1="1" x2="23" y2="23" />
                                                </svg>
                                            ) : (
                                                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={saving || !formName.trim() || !formEmail.trim() || (!user && formPassword.length < 6)}
                                className="w-full py-3.5 rounded-2xl bg-[#42b6f0] text-white font-extrabold hover:bg-[#2ea8e3] transition-colors disabled:opacity-50 mt-2 shadow-lg shadow-sky-200"
                            >
                                {saving ? (
                                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                                ) : (
                                    user ? 'Aceitar Convite' : 'Criar Conta e Aceitar'
                                )}
                            </button>

                            {user && (
                                <p className="text-[10px] text-gray-400 text-center">
                                    Logado como {user.email}
                                </p>
                            )}
                        </form>
                    </>
                )}

                {status === 'accepting' && (
                    <div className="text-center">
                        <span className="w-10 h-10 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin mx-auto block mb-4" />
                        <p className="text-gray-500">Aceitando convite...</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="text-center">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
                            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-extrabold text-gray-900 mb-2">Convite aceito!</h2>
                        <p className="text-sm text-gray-400">Redirecionando...</p>
                    </div>
                )}

                {status === 'error' && !error.includes('senha') && (
                    <div className="text-center">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-100 flex items-center justify-center mb-4">
                            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-extrabold text-gray-900 mb-2">Erro</h2>
                        <p className="text-sm text-red-500 mb-6">{error}</p>
                        <button
                            onClick={() => router.push('/')}
                            className="w-full py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
                        >
                            Ir para o inicio
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Mode = 'checking' | 'form' | 'expired'

export default function SetPasswordPage() {
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [mode, setMode] = useState<Mode>('checking')

    // Resend flow state
    const [resendEmail, setResendEmail] = useState('')
    const [resending, setResending] = useState(false)
    const [resent, setResent] = useState(false)

    // Supabase puts the session in the URL hash when the user clicks the email link.
    // If the one-time token was already consumed (e.g. by an email link-scanner)
    // or expired, Supabase instead puts an error in the hash. We must handle both.
    useEffect(() => {
        // 1. Check the hash for an explicit error from Supabase
        const hash = typeof window !== 'undefined' ? window.location.hash.substring(1) : ''
        const hashParams = new URLSearchParams(hash)
        if (hashParams.get('error') || hashParams.get('error_code')) {
            setMode('expired')
            return
        }

        // Prefill resend email from ?email= query param if present
        const qp = new URLSearchParams(window.location.search)
        const emailParam = qp.get('email')
        if (emailParam) setResendEmail(emailParam)

        let resolved = false

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
                resolved = true
                setMode('form')
            }
        })

        // Already has a session (token processed)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                resolved = true
                setMode('form')
            }
        })

        // Fallback: if after 8s nothing resolved, the link didn't carry a valid
        // session — treat as expired and offer a resend.
        const timer = setTimeout(() => {
            if (!resolved) setMode('expired')
        }, 8000)

        return () => {
            subscription.unsubscribe()
            clearTimeout(timer)
        }
    }, [])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.')
            return
        }
        if (password !== confirm) {
            setError('As senhas não coincidem.')
            return
        }

        setLoading(true)
        const { error: updateErr } = await supabase.auth.updateUser({ password })

        if (updateErr) {
            setError(updateErr.message)
            setLoading(false)
            return
        }

        // Redirect to home based on role
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: profile } = await supabase
                .from('users')
                .select('role')
                .eq('id', user.id)
                .maybeSingle()

            if (profile?.role === 'caregiver') {
                router.replace('/caregiver/home')
            } else {
                router.replace('/patient/home')
            }
        } else {
            router.replace('/auth')
        }
    }

    async function handleResend(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        if (!resendEmail.trim()) {
            setError('Informe seu email para reenviar o link.')
            return
        }
        setResending(true)
        const { error: resendErr } = await supabase.auth.resetPasswordForEmail(resendEmail.trim(), {
            redirectTo: `${window.location.origin}/auth/set-password`,
        })
        setResending(false)
        if (resendErr) {
            setError('Não foi possível reenviar. Tente novamente em alguns minutos.')
            return
        }
        setResent(true)
    }

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #e8f6fd 0%, #f3fae8 100%)', fontFamily: 'Lexend, sans-serif' }}
        >
            <div className="absolute top-[-60px] left-[-60px] w-64 h-64 rounded-full bg-[#42b6f0]/10 pointer-events-none" />
            <div className="absolute bottom-[-40px] right-[-40px] w-48 h-48 rounded-full bg-[#7bc843]/12 pointer-events-none" />

            <div className="w-full max-w-sm relative z-10">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <div
                        className="w-20 h-20 rounded-[1.5rem] bg-white flex items-center justify-center"
                        style={{ boxShadow: '0 12px 40px rgba(66,182,240,0.25), 0 6px 20px rgba(123,200,67,0.20)' }}
                    >
                        <img src="/icon-only.png" alt="Care Close" className="w-[80%] h-[80%] object-contain" />
                    </div>
                </div>

                {/* === EXPIRED / INVALID LINK → resend === */}
                {mode === 'expired' ? (
                    <>
                        <h1 className="text-2xl font-black text-gray-900 mb-1 text-center">Link expirado</h1>
                        <p className="text-sm text-gray-500 text-center mb-8">
                            Este link de acesso expirou ou já foi usado. Informe seu email
                            que enviamos um novo link na hora.
                        </p>

                        {resent ? (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl px-4 py-4 text-center">
                                ✅ Pronto! Enviamos um novo link para <strong>{resendEmail}</strong>.
                                Abra o email <strong>mais recente</strong> e clique em "Criar minha senha".
                            </div>
                        ) : (
                            <form onSubmit={handleResend} className="flex flex-col gap-4">
                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3">
                                        {error}
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase tracking-wide">
                                        Seu email
                                    </label>
                                    <input
                                        type="email"
                                        value={resendEmail}
                                        onChange={e => setResendEmail(e.target.value)}
                                        placeholder="seu@email.com"
                                        required
                                        autoFocus
                                        className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-900 text-sm font-medium focus:outline-none focus:border-[#42b6f0] focus:ring-2 focus:ring-[#42b6f0]/20 transition-all"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={resending}
                                    className="w-full py-4 rounded-2xl text-white font-extrabold text-base mt-2 disabled:opacity-50 transition-all"
                                    style={{
                                        background: 'linear-gradient(135deg, #42b6f0 0%, #7bc843 100%)',
                                        boxShadow: '0 8px 24px rgba(66,182,240,0.30)',
                                    }}
                                >
                                    {resending
                                        ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                                        : 'Enviar novo link →'
                                    }
                                </button>
                            </form>
                        )}
                    </>
                ) : mode === 'checking' ? (
                    /* === CHECKING === */
                    <div className="text-center py-8">
                        <span className="w-10 h-10 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin mx-auto block mb-4" />
                        <p className="text-sm text-gray-400">Verificando seu link...</p>
                    </div>
                ) : (
                    /* === PASSWORD FORM === */
                    <>
                        <h1 className="text-2xl font-black text-gray-900 mb-1 text-center">Crie sua senha</h1>
                        <p className="text-sm text-gray-400 text-center mb-8">
                            Defina uma senha para acessar o Care Close
                        </p>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase tracking-wide">
                                    Nova senha
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                    required
                                    minLength={6}
                                    autoFocus
                                    className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-900 text-sm font-medium focus:outline-none focus:border-[#42b6f0] focus:ring-2 focus:ring-[#42b6f0]/20 transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase tracking-wide">
                                    Confirmar senha
                                </label>
                                <input
                                    type="password"
                                    value={confirm}
                                    onChange={e => setConfirm(e.target.value)}
                                    placeholder="Repita a senha"
                                    required
                                    className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-900 text-sm font-medium focus:outline-none focus:border-[#42b6f0] focus:ring-2 focus:ring-[#42b6f0]/20 transition-all"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || password.length < 6 || password !== confirm}
                                className="w-full py-4 rounded-2xl text-white font-extrabold text-base mt-2 disabled:opacity-50 transition-all"
                                style={{
                                    background: 'linear-gradient(135deg, #42b6f0 0%, #7bc843 100%)',
                                    boxShadow: '0 8px 24px rgba(66,182,240,0.30)',
                                }}
                            >
                                {loading
                                    ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                                    : 'Salvar senha e entrar →'
                                }
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    )
}

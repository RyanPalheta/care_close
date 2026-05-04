'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

function PostPurchaseForm() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { user, profile, loading: authLoading } = useAuth()

    // Hotmart passes buyer email as URL param — e.g. ?email=ana.paulafg@yahoo.com.br
    const purchaseEmail = searchParams.get('email') || ''

    const [email, setEmail] = useState(purchaseEmail)
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [linkSent, setLinkSent] = useState(false)
    const [tab, setTab] = useState<'magic' | 'password'>('magic')

    // Redirect if already authenticated
    useEffect(() => {
        if (authLoading || !user) return
        if (profile) {
            if (profile.role === 'caregiver') {
                router.replace('/caregiver/home')
            } else if (profile.role === 'family') {
                router.replace('/guest/home')
            } else {
                router.replace('/patient/home')
            }
        }
    }, [user, profile, authLoading, router])

    async function handleSendMagicLink(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                shouldCreateUser: false, // account already created by webhook
                emailRedirectTo: `${window.location.origin}/auth`,
            },
        })

        if (error) {
            // "Email not confirmed" or "User not found" → account may still be processing
            if (error.message.toLowerCase().includes('not found') || error.message.toLowerCase().includes('invalid')) {
                setError('Email não encontrado. Verifique se usou o mesmo email da compra ou aguarde alguns minutos e tente novamente.')
            } else {
                setError('Não foi possível enviar o link. Tente novamente.')
            }
        } else {
            setLinkSent(true)
        }
        setLoading(false)
    }

    async function handlePasswordLogin(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
            if (error.message === 'Invalid login credentials') {
                setError('Email ou senha incorretos. Se ainda não definiu sua senha, use "Link de acesso" para entrar sem senha.')
            } else {
                setError(error.message)
            }
            setLoading(false)
        }
        // AuthProvider handles redirect on success
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <span className="w-10 h-10 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin" />
            </div>
        )
    }

    if (linkSent) {
        return (
            <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#e8f5fd] to-white">
                <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                    <div className="w-20 h-20 rounded-full bg-[#42b6f0]/10 flex items-center justify-center mb-6">
                        <svg width="36" height="36" fill="none" stroke="#42b6f0" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 mb-2">Verifique seu email</h2>
                    <p className="text-gray-500 text-sm mb-1">Enviamos um link de acesso para</p>
                    <p className="font-bold text-gray-800 text-base mb-6 break-all">{email}</p>
                    <p className="text-xs text-gray-400 mb-10 max-w-xs">
                        Clique no link para acessar sua conta. Pode levar alguns minutos. Verifique também a caixa de spam.
                    </p>
                    <button
                        className="text-[#42b6f0] text-sm font-semibold"
                        onClick={() => { setLinkSent(false); setError(null) }}
                    >
                        Reenviar ou usar outro email
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#e8f5fd] to-white">
            {/* Header */}
            <div className="px-6 pt-12 pb-6">
                <div className="w-12 h-12 rounded-2xl bg-[#42b6f0] flex items-center justify-center mb-6 shadow-lg shadow-[#42b6f0]/30">
                    <svg width="24" height="24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M20 6L9 17l-5-5" />
                    </svg>
                </div>
                <h1 className="text-3xl font-black text-gray-900 mb-1">Compra confirmada!</h1>
                <p className="text-sm text-gray-400 mt-2">Acesse sua plataforma de cuidados</p>
            </div>

            <div className="flex-1 px-6">
                {/* Email hint banner — only shown when email came from Hotmart redirect */}
                {purchaseEmail && (
                    <div className="mb-5 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-start gap-3">
                        <svg width="18" height="18" fill="none" stroke="#42b6f0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4M12 8h.01" />
                        </svg>
                        <p className="text-sm text-blue-700">
                            Use o email da compra:{' '}
                            <span className="font-bold break-all">{purchaseEmail}</span>
                        </p>
                    </div>
                )}

                {/* Tab selector */}
                <div className="flex bg-gray-100 rounded-2xl p-1 mb-5">
                    <button
                        className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${tab === 'magic' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                        onClick={() => { setTab('magic'); setError(null) }}
                    >
                        Link de acesso
                    </button>
                    <button
                        className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${tab === 'password' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                        onClick={() => { setTab('password'); setError(null) }}
                    >
                        Já tenho senha
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3 mb-4">
                        {error}
                    </div>
                )}

                {tab === 'magic' ? (
                    <form onSubmit={handleSendMagicLink} className="flex flex-col gap-4">
                        <div>
                            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                                Email da compra
                            </label>
                            <input
                                type="email"
                                className="input-field"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </div>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading
                                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto block" />
                                : 'Enviar link de acesso'
                            }
                        </button>
                        <p className="text-xs text-center text-gray-400">
                            Você receberá um link por email. Clique nele para entrar diretamente, sem precisar de senha.
                        </p>
                    </form>
                ) : (
                    <form onSubmit={handlePasswordLogin} className="flex flex-col gap-4">
                        <div>
                            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Email</label>
                            <input
                                type="email"
                                className="input-field"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Senha</label>
                            <input
                                type="password"
                                className="input-field"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={6}
                                autoComplete="current-password"
                            />
                        </div>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading
                                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto block" />
                                : 'Entrar'
                            }
                        </button>
                        <button
                            type="button"
                            className="text-[#42b6f0] text-sm font-semibold text-center py-1"
                            onClick={() => { setTab('magic'); setError(null) }}
                        >
                            Não tenho senha — receber link de acesso
                        </button>
                    </form>
                )}
            </div>

            <div className="pb-8" />
        </div>
    )
}

export default function PostPurchasePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <span className="w-10 h-10 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin" />
            </div>
        }>
            <PostPurchaseForm />
        </Suspense>
    )
}

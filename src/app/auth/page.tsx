'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

function AuthForm() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { user, profile, loading: authLoading } = useAuth()

    // Read mode from URL: ?mode=login → show login, ?mode=signup or missing → show signup
    const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup')

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [role, setRole] = useState<'patient' | 'caregiver'>('patient')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)

    // Redirect if already logged in
    useEffect(() => {
        if (!authLoading && user && profile) {
            if (profile.role === 'caregiver') {
                router.replace('/caregiver/home')
            } else {
                router.replace('/patient/home')
            }
        }
    }, [user, profile, authLoading, router])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)

        if (isLogin) {
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) {
                setLoading(false)
                setError(error.message === 'Invalid login credentials'
                    ? 'Email ou senha incorretos. Verifique e tente novamente.'
                    : error.message)
                return
            }
            // AuthProvider will handle redirect
        } else {
            if (!name.trim()) {
                setLoading(false)
                setError('Por favor, informe seu nome.')
                return
            }

            const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
            if (signUpError) {
                setLoading(false)
                setError(signUpError.message)
                return
            }

            if (data.user) {
                // Insert into users table
                const { error: insertErr } = await supabase.from('users').insert({
                    id: data.user.id,
                    name: name.trim(),
                    email,
                    role,
                })
                if (insertErr) console.error('User insert error:', insertErr)

                // If patient role, create patient entry
                if (role === 'patient') {
                    await supabase.from('patients').insert({
                        user_id: data.user.id,
                        license_id: null,
                    })
                }
            }

            if (!data.session) {
                setLoading(false)
                setMessage('Conta criada! Verifique seu email para confirmar e depois faça login.')
                return
            }
            // If session exists (email confirm disabled), redirect will happen via AuthProvider
        }

        setLoading(false)
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <span className="w-10 h-10 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#e8f5fd] to-white">
            {/* Header */}
            <div className="px-6 pt-12 pb-8">
                <button onClick={() => router.push('/')} className="flex items-center gap-1 text-gray-400 text-sm mb-8">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 19l-7-7 7-7" />
                    </svg>
                    Voltar
                </button>
                <h1 className="text-3xl font-black text-gray-900 mb-1">
                    {isLogin ? 'Bem-vindo\nde volta!' : 'Criar\nconta'}
                </h1>
                <p className="text-sm text-gray-400 mt-2">
                    {isLogin
                        ? 'Acesse sua plataforma de cuidados'
                        : 'Cadastre-se para começar a usar o Care Clore'}
                </p>
            </div>

            {/* Form */}
            <div className="flex-1 px-6">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3">
                            {error}
                        </div>
                    )}
                    {message && (
                        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-2xl px-4 py-3">
                            {message}
                        </div>
                    )}

                    {!isLogin && (
                        <div>
                            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Nome completo</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Seu nome"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                                autoComplete="name"
                            />
                        </div>
                    )}

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
                            placeholder={isLogin ? '••••••••' : 'Mínimo 6 caracteres'}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            minLength={6}
                            autoComplete={isLogin ? 'current-password' : 'new-password'}
                        />
                    </div>

                    {!isLogin && (
                        <div>
                            <label className="text-sm font-semibold text-gray-700 mb-2 block">Sou um...</label>
                            <div className="flex gap-3">
                                {([
                                    { value: 'patient', label: '👤 Paciente' },
                                    { value: 'caregiver', label: '🩺 Cuidador' },
                                ] as const).map(r => (
                                    <button
                                        key={r.value}
                                        type="button"
                                        onClick={() => setRole(r.value)}
                                        className={`flex-1 py-3 rounded-2xl text-sm font-bold border-2 transition-all
                                            ${role === r.value
                                                ? 'bg-[#42b6f0] border-[#42b6f0] text-white shadow-md shadow-[#42b6f0]/30'
                                                : 'bg-white border-gray-200 text-gray-600'
                                            }`}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn-primary mt-2"
                        disabled={loading}
                    >
                        {loading
                            ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto block" />
                            : isLogin ? 'Entrar' : 'Criar conta'
                        }
                    </button>
                </form>

                {/* Toggle login / signup */}
                <div className="flex items-center justify-center gap-1 mt-6 pb-8">
                    <p className="text-sm text-gray-400">
                        {isLogin ? 'Não tem conta?' : 'Já tem conta?'}
                    </p>
                    <button
                        type="button"
                        className="text-sm font-bold text-[#42b6f0]"
                        onClick={() => {
                            setIsLogin(!isLogin)
                            setError(null)
                            setMessage(null)
                        }}
                    >
                        {isLogin ? 'Criar conta' : 'Entrar'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function AuthPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <span className="w-10 h-10 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin" />
            </div>
        }>
            <AuthForm />
        </Suspense>
    )
}

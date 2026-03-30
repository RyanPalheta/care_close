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
    const [isSigningUp, setIsSigningUp] = useState(false)

    const [needsProfileRepair, setNeedsProfileRepair] = useState(false)

    // Redirect if already logged in
    useEffect(() => {
        // If still loading auth state or currently signing up, do nothing
        if (authLoading || isSigningUp) return;

        if (user) {
            if (profile) {
                // Happy path: User and Profile are loaded
                if (profile.role === 'caregiver') {
                    router.replace('/caregiver/home')
                } else if (profile.role === 'family') {
                    router.replace('/guest/home')
                } else {
                    router.replace('/patient/home')
                }
            } else {
                // Edge case: User is authenticated but profile is missing.
                // Instead of signing out, show a profile repair form.
                setNeedsProfileRepair(true)
                setError('Seu perfil está incompleto. Complete seus dados abaixo para continuar.')
            }
        }
    }, [user, profile, authLoading, router, isSigningUp])

    // Handle profile repair for users missing their profile row
    async function handleProfileRepair(e: React.FormEvent) {
        e.preventDefault()
        if (!user) return
        setLoading(true)
        setError(null)

        if (!name.trim()) {
            setError('Por favor, informe seu nome.')
            setLoading(false)
            return
        }

        // Use upsert to handle cases where the row already exists but RLS blocks SELECT
        const { error: upsertErr } = await supabase.from('users').upsert({
            id: user.id,
            name: name.trim(),
            role,
        }, { onConflict: 'id' })

        if (upsertErr) {
            console.error('Profile repair upsert error:', upsertErr)
            setError('Erro ao salvar perfil: ' + upsertErr.message)
            setLoading(false)
            return
        }

        // If patient, also create patient entry (upsert to avoid duplicate)
        if (role === 'patient') {
            await supabase.from('patients').upsert({
                user_id: user.id,
                license_id: null,
            }, { onConflict: 'user_id' })
        }

        // Hard redirect to pick up the new profile
        if (role === 'caregiver') {
            window.location.href = '/caregiver/home'
        } else {
            window.location.href = '/patient/home'
        }
    }

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

            setIsSigningUp(true)

            const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
            if (signUpError) {
                setIsSigningUp(false)
                setLoading(false)
                setError(signUpError.message)
                return
            }

            if (data.user) {
                // Insert into users table
                const { error: insertErr } = await supabase.from('users').insert({
                    id: data.user.id,
                    name: name.trim(),
                    role,
                })
                if (insertErr) {
                    console.error('User insert error:', insertErr)
                    setIsSigningUp(false)
                    setLoading(false)
                    setError('Conta criada, mas houve um erro ao salvar seu perfil. Faça login novamente para completar seu perfil.')
                    return
                }

                // If patient role, create patient entry
                if (role === 'patient') {
                    const { error: patientErr } = await supabase.from('patients').insert({
                        user_id: data.user.id,
                        license_id: null,
                    })
                    if (patientErr) console.error('Patient insert error:', patientErr)
                }
            }

            if (!data.session) {
                setIsSigningUp(false)
                setLoading(false)
                setMessage('Conta criada! Verifique seu email para confirmar e depois faça login.')
                return
            }
            
            // Hard redirect to ensure new AuthContext session picks up the newly inserted profile
            if (role === 'caregiver') {
                window.location.href = '/caregiver/home'
            } else {
                window.location.href = '/patient/home'
            }
            return;
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
                    Bem-vindo{'\n'}de volta!
                </h1>
                <p className="text-sm text-gray-400 mt-2">
                    Acesse sua plataforma de cuidados
                </p>
            </div>

            {/* Form */}
            <div className="flex-1 px-6">
                {/* Profile Repair Form — shown when user is authenticated but profile is missing */}
                {needsProfileRepair && user ? (
                    <form onSubmit={handleProfileRepair} className="flex flex-col gap-4">
                        {error && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-2xl px-4 py-3">
                                {error}
                            </div>
                        )}

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

                        <button type="submit" className="btn-primary mt-2" disabled={loading}>
                            {loading
                                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto block" />
                                : 'Completar perfil'
                            }
                        </button>

                        <button
                            type="button"
                            className="text-sm text-gray-400 mt-2"
                            onClick={() => {
                                supabase.auth.signOut()
                                setNeedsProfileRepair(false)
                                setError(null)
                            }}
                        >
                            Sair e usar outra conta
                        </button>
                    </form>
                ) : (
                <>
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
                            : 'Entrar'
                        }
                    </button>
                </form>

                <div className="pb-8" />
                </>
                )}
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

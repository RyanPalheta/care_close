'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [validSession, setValidSession] = useState<boolean | null>(null)

    // Verify we're in a recovery session before allowing the form
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setValidSession(!!session)
        })
    }, [])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setMessage(null)

        if (password.length < 6) {
            setError('A senha precisa ter no mínimo 6 caracteres.')
            return
        }

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.')
            return
        }

        setLoading(true)
        const { error: updateErr } = await supabase.auth.updateUser({ password })
        setLoading(false)

        if (updateErr) {
            console.error('Update password error:', updateErr)
            setError(updateErr.message === 'Auth session missing!'
                ? 'Sessão expirada. Solicite um novo link de recuperação.'
                : 'Erro ao atualizar senha. Tente novamente.')
            return
        }

        setMessage('Senha atualizada com sucesso! Redirecionando...')

        // Fetch user role to redirect appropriately
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            setTimeout(() => router.replace('/auth?mode=login'), 1500)
            return
        }

        const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .maybeSingle()

        setTimeout(() => {
            if (profile?.role === 'caregiver') {
                window.location.href = '/caregiver/home'
            } else if (profile?.role === 'family') {
                window.location.href = '/guest/home'
            } else {
                window.location.href = '/patient/home'
            }
        }, 1500)
    }

    if (validSession === null) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <span className="w-10 h-10 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin" />
            </div>
        )
    }

    if (!validSession) {
        return (
            <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#e8f5fd] to-white px-6 pt-12">
                <h1 className="text-3xl font-black text-gray-900 mb-2">Link inválido</h1>
                <p className="text-sm text-gray-500 mb-6">
                    O link de recuperação expirou ou já foi utilizado. Solicite um novo link.
                </p>
                <button
                    onClick={() => router.replace('/auth?mode=login')}
                    className="btn-primary"
                >
                    Voltar para login
                </button>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#e8f5fd] to-white">
            <div className="px-6 pt-12 pb-8">
                <h1 className="text-3xl font-black text-gray-900 mb-1">
                    Nova{'\n'}senha
                </h1>
                <p className="text-sm text-gray-400 mt-2">
                    Defina uma nova senha para sua conta
                </p>
            </div>

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

                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Nova senha</label>
                        <input
                            type="password"
                            className="input-field"
                            placeholder="Mínimo 6 caracteres"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            minLength={6}
                            autoComplete="new-password"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Confirmar nova senha</label>
                        <input
                            type="password"
                            className="input-field"
                            placeholder="Repita a senha"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            required
                            minLength={6}
                            autoComplete="new-password"
                        />
                    </div>

                    <button type="submit" className="btn-primary mt-2" disabled={loading}>
                        {loading
                            ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto block" />
                            : 'Salvar nova senha'
                        }
                    </button>
                </form>
            </div>
        </div>
    )
}

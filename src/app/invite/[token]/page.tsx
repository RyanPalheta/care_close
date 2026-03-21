'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

export default function InvitePage() {
    const { token } = useParams<{ token: string }>()
    const { user, loading: authLoading } = useAuth()
    const router = useRouter()
    const [status, setStatus] = useState<'loading' | 'login_required' | 'accepting' | 'success' | 'error'>('loading')
    const [error, setError] = useState('')
    const [inviteInfo, setInviteInfo] = useState<{ invited_by_name: string } | null>(null)

    useEffect(() => {
        if (authLoading) return

        if (!user) {
            // Save invite token and redirect to auth
            sessionStorage.setItem('pending_invite_token', token)
            setStatus('login_required')
            return
        }

        acceptInvite()
    }, [user, authLoading, token])

    async function acceptInvite() {
        setStatus('accepting')

        // Call the accept_invite RPC function
        const { data, error: rpcError } = await supabase.rpc('accept_invite', {
            p_token: token,
        })

        if (rpcError) {
            setError(rpcError.message)
            setStatus('error')
            return
        }

        if (data?.error) {
            setError(data.error)
            setStatus('error')
            return
        }

        setStatus('success')

        // Redirect based on license type
        setTimeout(() => {
            if (data?.license_type === 'cuidador') {
                router.replace('/caregiver/home')
            } else {
                router.replace('/patient/home')
            }
        }, 2000)
    }

    // Check for pending invite after login
    useEffect(() => {
        if (user && status === 'login_required') {
            acceptInvite()
        }
    }, [user, status])

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#e8f5fd] to-white px-6">
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 w-full max-w-sm text-center">
                {status === 'loading' && (
                    <>
                        <span className="w-10 h-10 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin mx-auto block mb-4" />
                        <p className="text-gray-500">Verificando convite...</p>
                    </>
                )}

                {status === 'login_required' && (
                    <>
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-sky-100 flex items-center justify-center mb-4">
                            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#42b6f0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="8.5" cy="7" r="4" />
                                <line x1="20" y1="8" x2="20" y2="14" />
                                <line x1="23" y1="11" x2="17" y2="11" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-extrabold text-gray-900 mb-2">Voce foi convidado!</h2>
                        <p className="text-sm text-gray-400 mb-6">
                            Faca login ou crie uma conta para aceitar o convite e acessar a plataforma.
                        </p>
                        <button
                            onClick={() => router.push('/auth?mode=login')}
                            className="w-full py-3 rounded-2xl bg-[#42b6f0] text-white font-bold mb-3 hover:bg-[#2ea8e3] transition-colors"
                        >
                            Entrar
                        </button>
                        <button
                            onClick={() => router.push('/auth?mode=signup')}
                            className="w-full py-3 rounded-2xl bg-white border-2 border-gray-200 text-gray-700 font-bold hover:border-[#42b6f0] transition-colors"
                        >
                            Criar conta
                        </button>
                    </>
                )}

                {status === 'accepting' && (
                    <>
                        <span className="w-10 h-10 border-4 border-[#42b6f0]/30 border-t-[#42b6f0] rounded-full animate-spin mx-auto block mb-4" />
                        <p className="text-gray-500">Aceitando convite...</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
                            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-extrabold text-gray-900 mb-2">Convite aceito!</h2>
                        <p className="text-sm text-gray-400">Redirecionando para a plataforma...</p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-100 flex items-center justify-center mb-4">
                            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-extrabold text-gray-900 mb-2">Erro no convite</h2>
                        <p className="text-sm text-red-500 mb-6">{error}</p>
                        <button
                            onClick={() => router.push('/')}
                            className="w-full py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
                        >
                            Ir para o inicio
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

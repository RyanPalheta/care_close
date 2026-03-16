'use client'

import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function CaregiverLicensePage() {
    const { user, profile } = useAuth()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [licenseInfo, setLicenseInfo] = useState<any>(null)

    useEffect(() => {
        if (!user) return
        // Fetch the caregiver's license
        supabase
            .from('licenses')
            .select(`
                code,
                status,
                activated_at,
                institutions (
                    name,
                    cnpj
                )
            `)
            .eq('assigned_to', user.id)
            .maybeSingle()
            .then(({ data }) => {
                setLicenseInfo(data)
                setLoading(false)
            })
    }, [user])

    return (
        <div className="min-h-screen bg-[#f7f8fc] pb-24" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {/* Header */}
            <div className="bg-white px-5 pt-12 pb-5 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-extrabold text-gray-900">Minha Licença</h1>
                        <p className="text-xs text-gray-400 font-medium">Visualizar Vínculo Profissional</p>
                    </div>
                </div>
            </div>

            <div className="px-4 pt-6">
                {loading ? (
                    <div className="flex justify-center p-10">
                        <span className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : licenseInfo ? (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
                            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-extrabold text-gray-900 leading-tight mb-1">Licença Ativada</h2>
                        <p className="text-sm text-gray-400 font-medium mb-6">Você está vinculado a uma instituição.</p>

                        <div className="bg-gray-50 rounded-2xl p-4 text-left flex flex-col gap-3">
                            <div>
                                <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wide">Instituição</p>
                                <p className="font-bold text-gray-800">{licenseInfo.institutions?.name || 'Não informada'}</p>
                            </div>
                            <div>
                                <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wide">Código de Ativação</p>
                                <p className="font-bold text-gray-800 tracking-wider">{licenseInfo.code}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
                            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-extrabold text-gray-900 leading-tight mb-1">Sem Licença Ativa</h2>
                        <p className="text-sm text-gray-400 font-medium mb-6">Você ainda não está vinculado a uma instituição parceira no sistema.</p>
                        <p className="text-xs text-gray-500 font-medium bg-amber-50 p-4 rounded-xl border border-amber-100">
                            Para obter acesso profissional completo, você precisa receber um código de convite de uma instituição e ativá-lo por meio do suporte.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface InstitutionData {
    id: string
    name: string
    cnpj: string | null
    plan: string | null
    status: string
    total_licenses: number
    next_billing: string | null
}

export default function InstitutionDashboardPage() {
    const { user } = useAuth()
    const router = useRouter()
    const [inst, setInst] = useState<InstitutionData | null>(null)
    const [usedLicenses, setUsedLicenses] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!user) return

        async function load() {
            // Fetch institution owned by this user
            const { data: instRows } = await supabase
                .from('institutions')
                .select('*')
                .eq('owner_user_id', user!.id)
                .order('created_at', { ascending: false })
                .limit(1)

            const instData = instRows?.[0] ?? null

            if (!instData) { setLoading(false); return }
            setInst(instData)

            // Count active licenses
            const { count } = await supabase
                .from('licenses')
                .select('*', { count: 'exact', head: true })
                .eq('institution_id', instData.id)
                .eq('status', 'active')

            setUsedLicenses(count ?? 0)
            setLoading(false)
        }

        load()
    }, [user])

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/auth')
    }

    const licensePercent = inst ? Math.round((usedLicenses / inst.total_licenses) * 100) : 0
    const available = inst ? inst.total_licenses - usedLicenses : 0

    const formatDate = (d: string | null) => {
        if (!d) return '—'
        return new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
                <span className="w-10 h-10 border-4 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
            </div>
        )
    }

    if (!inst) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f5f5f5] p-6">
                <p className="text-gray-500 font-medium text-center">Nenhuma instituição encontrada para esta conta.</p>
                <button onClick={handleLogout} className="text-orange-500 font-bold underline">Sair</button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#f5f5f5] pb-24" style={{ fontFamily: 'Lexend, sans-serif' }}>

            {/* Header */}
            <div className="bg-white px-5 pt-12 pb-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-400 font-medium">Bem-vindo,</p>
                        <h1 className="text-xl font-extrabold text-gray-900">Painel da Instituição B2B</h1>
                    </div>
                    <button onClick={handleLogout} className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="px-4 pt-4 flex flex-col gap-4">

                {/* Institution Identity Card */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-extrabold text-orange-500 uppercase tracking-wide flex items-center gap-1 mb-0.5">
                                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                                Painel Corporativo
                            </p>
                            <p className="font-extrabold text-gray-900 text-base leading-tight">{inst.name}</p>
                            {inst.cnpj && <p className="text-xs text-gray-400 mt-0.5">CNPJ: {inst.cnpj}</p>}
                            <span className={`inline-flex items-center gap-1 mt-2 text-xs font-extrabold rounded-xl px-3 py-1 ${inst.status === 'active' ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${inst.status === 'active' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                                {inst.status === 'active' ? 'Assinatura Ativa' : 'Assinatura Inativa'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* License Usage Card */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[12px] font-extrabold text-gray-400 uppercase tracking-wide">Gestão de Licenças (Cuidadores)</p>
                        <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="10" y1="14" x2="14" y2="14" />
                            </svg>
                        </div>
                    </div>
                    <div className="flex items-end gap-1 mt-3 mb-1">
                        <span className="text-4xl font-black text-gray-900">{usedLicenses}</span>
                        <span className="text-lg font-bold text-gray-400 mb-1">/ {inst.total_licenses}</span>
                    </div>
                    <p className="text-xs text-gray-500 font-medium mb-3">Licenças utilizadas</p>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                        <div
                            className="h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(licensePercent, 100)}%`, background: licensePercent > 85 ? '#f97316' : '#42b6f0' }}
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-orange-400" />
                            <span className="text-[11px] text-gray-500 font-medium">{usedLicenses} Cuidadores Ativos</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-gray-300" />
                            <span className="text-[11px] text-gray-500 font-medium">{available} Disponíveis</span>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div>
                    <p className="text-[12px] font-extrabold text-gray-400 uppercase tracking-wide mb-3 px-1">Atalhos Administrativos</p>
                    <div className="grid grid-cols-2 gap-3">
                        <Link href="/institution/licenses" className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col items-center gap-3 hover:bg-orange-50 transition-colors">
                            <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center">
                                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                                </svg>
                            </div>
                            <p className="text-sm font-extrabold text-gray-800 text-center">Gerenciar Licenças</p>
                        </Link>
                        <Link href="/institution/reports" className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col items-center gap-3 hover:bg-blue-50 transition-colors">
                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#42b6f0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                            </div>
                            <p className="text-sm font-extrabold text-gray-800 text-center">Relatório Mensal</p>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <Link href="/institution/dashboard" className="bottom-nav-item active">
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                    <span style={{ color: '#f97316' }}>Início</span>
                </Link>
                <Link href="/institution/licenses" className="bottom-nav-item">
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
                    <span>Licenças</span>
                </Link>
                <Link href="/institution/reports" className="bottom-nav-item">
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                    <span>Relatórios</span>
                </Link>
                <Link href="/institution/settings" className="bottom-nav-item">
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                    <span>Ajustes</span>
                </Link>
            </nav>
        </div>
    )
}

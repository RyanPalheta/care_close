'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface LicenseEntry {
    id: string
    code: string
    status: string
    activated_at: string | null
    user_name: string | null
    user_role: string | null
}

interface Stats {
    total: number
    active: number
    revoked: number
    pending: number
    caregivers: number
    patients: number
    totalCapacity: number
    occupancyPct: number
    institutionName: string
}

export default function InstitutionReportsPage() {
    const { user } = useAuth()
    const router = useRouter()
    const [stats, setStats] = useState<Stats | null>(null)
    const [licenses, setLicenses] = useState<LicenseEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [exported, setExported] = useState(false)

    useEffect(() => {
        if (!user) return
        async function load() {
            // Get institution
            const { data: instRows } = await supabase
                .from('institutions')
                .select('id, name, total_licenses')
                .eq('owner_user_id', user!.id)
                .order('created_at', { ascending: false })
                .limit(1)
            const inst = instRows?.[0] ?? null
            if (!inst) { setLoading(false); return }

            // Get all licenses via RPC (bypasses RLS, includes user names)
            const { data: rpcData } = await supabase
                .rpc('get_institution_licenses', { p_institution_id: inst.id })

            const rows: LicenseEntry[] = (rpcData ?? []).map((l: any) => ({
                id: l.id,
                code: l.code,
                status: l.status,
                activated_at: l.activated_at,
                user_name: l.user_name,
                user_role: l.user_role,
            }))
            setLicenses(rows)

            const active = rows.filter(r => r.status === 'active').length
            const revoked = rows.filter(r => r.status === 'revoked').length
            const pending = rows.filter(r => r.status === 'pending').length
            const caregivers = rows.filter(r => r.user_role === 'caregiver').length
            const patients = rows.filter(r => r.user_role === 'patient').length
            const used = active + pending

            setStats({
                total: rows.length,
                active,
                revoked,
                pending,
                caregivers,
                patients,
                totalCapacity: inst.total_licenses,
                occupancyPct: inst.total_licenses > 0 ? Math.round((used / inst.total_licenses) * 100) : 0,
                institutionName: inst.name,
            })
            setLoading(false)
        }
        load()
    }, [user])

    function exportCSV() {
        const header = 'Nome,Código,Status,Tipo,Data de Ativação'
        const rows = licenses.map(l =>
            `"${l.user_name ?? 'Sem nome'}","${l.code}","${l.status}","${l.user_role ?? '—'}","${l.activated_at ? new Date(l.activated_at).toLocaleDateString('pt-BR') : '—'}"`
        )
        const csvContent = [header, ...rows].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `relatorio-licencas-${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        setExported(true)
        setTimeout(() => setExported(false), 3000)
    }

    const formatDate = (d: string | null) =>
        d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

    return (
        <div className="min-h-screen bg-[#f5f5f5] pb-28" style={{ fontFamily: 'Lexend, sans-serif' }}>

            {/* Header */}
            <div className="bg-white px-5 pt-12 pb-5 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-extrabold text-gray-900">Relatório de Licenças</h1>
                        <p className="text-xs text-gray-400 font-medium">{stats?.institutionName ?? '—'}</p>
                    </div>
                    <button
                        onClick={exportCSV}
                        className={`flex items-center gap-2 text-xs font-extrabold px-4 py-2.5 rounded-xl transition-all ${exported ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
                    >
                        {exported
                            ? <><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> Baixado!</>
                            : <><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg> CSV</>
                        }
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <span className="w-10 h-10 border-4 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
                </div>
            ) : !stats ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 px-8 text-center">
                    <p className="text-gray-400 font-medium">Nenhuma instituição encontrada.</p>
                </div>
            ) : (
                <div className="px-4 pt-4 flex flex-col gap-4">

                    {/* Occupancy Hero Card */}
                    <div className="bg-gradient-to-br from-orange-500 to-amber-400 rounded-3xl p-6 shadow-lg shadow-orange-100 text-white">
                        <p className="text-xs font-extrabold uppercase tracking-widest text-white/70 mb-1">Taxa de Ocupação</p>
                        <div className="flex items-end gap-2 mb-3">
                            <span className="text-6xl font-black leading-none">{stats.occupancyPct}%</span>
                            <span className="text-white/60 font-bold text-lg mb-1">{stats.active}/{stats.totalCapacity}</span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-white/20 rounded-full h-2.5 mb-4">
                            <div
                                className="h-2.5 rounded-full bg-white transition-all"
                                style={{ width: `${Math.min(stats.occupancyPct, 100)}%` }}
                            />
                        </div>
                        <div className="flex items-center gap-4 text-sm font-medium text-white/80">
                            <span><strong className="text-white">{stats.totalCapacity - stats.active}</strong> vagas disponíveis</span>
                            <span>·</span>
                            <span><strong className="text-white">{stats.active}</strong> ativas</span>
                        </div>
                    </div>

                    {/* Role Breakdown */}
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                        <p className="text-[12px] font-extrabold text-gray-400 uppercase tracking-wide mb-4">Distribuição por Papel</p>
                        <div className="flex gap-3">
                            <div className="flex-1 bg-violet-50 rounded-2xl p-4 text-center">
                                <div className="text-3xl mb-1">🩺</div>
                                <p className="text-2xl font-black text-violet-700">{stats.caregivers}</p>
                                <p className="text-xs font-extrabold text-violet-400 mt-0.5">Cuidadores</p>
                            </div>
                            <div className="flex-1 bg-blue-50 rounded-2xl p-4 text-center">
                                <div className="text-3xl mb-1">👤</div>
                                <p className="text-2xl font-black text-blue-700">{stats.patients}</p>
                                <p className="text-xs font-extrabold text-blue-400 mt-0.5">Pacientes</p>
                            </div>
                        </div>
                        {/* Visual bar */}
                        <div className="mt-4">
                            <div className="flex text-xs text-gray-400 justify-between font-bold mb-1">
                                <span>Cuidadores</span>
                                <span>Pacientes</span>
                            </div>
                            <div className="flex h-3 rounded-full overflow-hidden">
                                {stats.total > 0 && (
                                    <>
                                        <div className="bg-violet-400 transition-all" style={{ width: `${(stats.caregivers / stats.total) * 100}%` }} />
                                        <div className="bg-blue-400 transition-all flex-1" />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Status Summary Cards */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                            <p className="text-2xl font-black text-emerald-600">{stats.active}</p>
                            <div className="flex items-center justify-center gap-1 mt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <p className="text-[10px] font-extrabold text-gray-400 uppercase">Ativas</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                            <p className="text-2xl font-black text-amber-500">{stats.pending}</p>
                            <div className="flex items-center justify-center gap-1 mt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                <p className="text-[10px] font-extrabold text-gray-400 uppercase">Pendentes</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                            <p className="text-2xl font-black text-gray-400">{stats.revoked}</p>
                            <div className="flex items-center justify-center gap-1 mt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                <p className="text-[10px] font-extrabold text-gray-400 uppercase">Revogadas</p>
                            </div>
                        </div>
                    </div>

                    {/* License Detail Table */}
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                        <p className="text-[12px] font-extrabold text-gray-400 uppercase tracking-wide mb-4">Lista Completa de Licenças</p>
                        <div className="flex flex-col gap-2">
                            {licenses.length === 0 && (
                                <p className="text-gray-400 font-medium text-sm text-center py-4">Nenhuma licença emitida.</p>
                            )}
                            {licenses.map(lic => (
                                <div key={lic.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${lic.user_role === 'caregiver' ? 'bg-violet-100' : 'bg-blue-100'}`}>
                                        {lic.user_role === 'caregiver' ? '🩺' : '👤'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-extrabold text-gray-900 text-sm truncate">{lic.user_name ?? 'Sem nome'}</p>
                                        <p className="text-[11px] text-gray-300 font-mono">{lic.code}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                            lic.status === 'active' ? 'bg-emerald-50 text-emerald-600'
                                            : lic.status === 'pending' ? 'bg-amber-50 text-amber-600'
                                            : 'bg-gray-100 text-gray-400'
                                        }`}>
                                            {lic.status === 'active' ? 'ATIVA' : lic.status === 'pending' ? 'PEND.' : 'REV.'}
                                        </span>
                                        <p className="text-[10px] text-gray-300 font-medium mt-0.5">{formatDate(lic.activated_at)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Coming Soon Card */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-5 shadow-sm text-white">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-extrabold text-sm">Métricas de Engajamento</p>
                                <p className="text-xs text-white/50">Em breve</p>
                            </div>
                        </div>
                        <p className="text-xs text-white/60 font-medium leading-relaxed">
                            Em breve você poderá visualizar quais cuidadores estão mais ativos, frequência de registros por paciente, e muito mais.
                        </p>
                    </div>

                </div>
            )}

            {/* Bottom Nav */}
            <nav className="bottom-nav" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <Link href="/institution/dashboard" className="bottom-nav-item">
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                    <span>Início</span>
                </Link>
                <Link href="/institution/licenses" className="bottom-nav-item">
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
                    <span>Licenças</span>
                </Link>
                <Link href="/institution/reports" className="bottom-nav-item active">
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                    <span style={{ color: '#f97316' }}>Relatórios</span>
                </Link>
                <Link href="/institution/settings" className="bottom-nav-item">
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                    <span>Ajustes</span>
                </Link>
            </nav>
        </div>
    )
}

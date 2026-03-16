'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface LicenseRow {
    id: string
    code: string
    status: 'active' | 'pending' | 'revoked'
    activated_at: string | null
    assigned_to: string | null
    userName: string | null
    userRole: string | null
}

type UserRole = 'patient' | 'caregiver'

export default function InstitutionLicensesPage() {
    const { user } = useAuth()
    const router = useRouter()
    const [institutionId, setInstitutionId] = useState<string | null>(null)
    const [totalLicenses, setTotalLicenses] = useState(0)
    const [licenses, setLicenses] = useState<LicenseRow[]>([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<'all' | 'active' | 'pending' | 'revoked'>('all')
    const [search, setSearch] = useState('')
    const [showCode, setShowCode] = useState(false)
    const [generatedCode, setGeneratedCode] = useState('')

    // Action sheet state
    const [selectedLicense, setSelectedLicense] = useState<LicenseRow | null>(null)
    const [actionLoading, setActionLoading] = useState(false)
    const [showRoleModal, setShowRoleModal] = useState(false)

    async function loadLicenses(instId: string) {
        const { data: rpcData, error: rpcErr } = await supabase
            .rpc('get_institution_licenses', { p_institution_id: instId })
        if (rpcErr) { console.error('RPC error:', rpcErr); return }
        const enriched: LicenseRow[] = (rpcData ?? []).map((l: any) => ({
            id: l.id,
            code: l.code,
            status: l.status,
            activated_at: l.activated_at,
            assigned_to: l.assigned_to,
            userName: l.user_name ?? null,
            userRole: l.user_role ?? null,
        }))
        setLicenses(enriched)
    }

    useEffect(() => {
        if (!user) return
        async function load() {
            const { data: instRows } = await supabase
                .from('institutions')
                .select('id, total_licenses')
                .eq('owner_user_id', user!.id)
                .order('created_at', { ascending: false })
                .limit(1)
            const inst = instRows?.[0] ?? null
            if (!inst) { setLoading(false); return }
            setInstitutionId(inst.id)
            setTotalLicenses(inst.total_licenses)
            await loadLicenses(inst.id)
            setLoading(false)
        }
        load()
    }, [user])

    function generateCode() {
        const code = `INST-${Math.floor(1000 + Math.random() * 9000)}`
        setGeneratedCode(code)
        setShowCode(true)
    }

    async function handleRevoke() {
        if (!selectedLicense) return
        setActionLoading(true)
        await supabase.from('licenses').update({ status: 'revoked' }).eq('id', selectedLicense.id)
        await loadLicenses(institutionId!)
        setSelectedLicense(null)
        setActionLoading(false)
    }

    async function handleDelete() {
        if (!selectedLicense) return
        setActionLoading(true)
        await supabase.from('licenses').delete().eq('id', selectedLicense.id)
        await loadLicenses(institutionId!)
        setSelectedLicense(null)
        setActionLoading(false)
    }

    async function handleRestore() {
        if (!selectedLicense) return
        setActionLoading(true)
        await supabase.from('licenses').update({ status: 'active' }).eq('id', selectedLicense.id)
        await loadLicenses(institutionId!)
        setSelectedLicense(null)
        setActionLoading(false)
    }

    async function handleChangeRole(newRole: UserRole) {
        if (!selectedLicense?.assigned_to) return
        setActionLoading(true)
        await supabase.from('users').update({ role: newRole }).eq('id', selectedLicense.assigned_to)
        await loadLicenses(institutionId!)
        setShowRoleModal(false)
        setSelectedLicense(null)
        setActionLoading(false)
    }

    const filtered = licenses.filter(l => {
        const matchesTab = tab === 'all' || l.status === tab
        const matchesSearch = (l.userName ?? l.code).toLowerCase().includes(search.toLowerCase())
        return matchesTab && matchesSearch
    })

    const activeCount = licenses.filter(l => l.status === 'active').length
    const pendingCount = licenses.filter(l => l.status === 'pending').length
    const used = licenses.filter(l => l.status !== 'revoked').length

    const formatDate = (d: string | null) =>
        d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

    const roleLabel = (r: string | null) => r === 'caregiver' ? '🩺 Cuidador' : r === 'patient' ? '👤 Paciente' : '—'

    return (
        <div className="min-h-screen bg-[#f5f5f5] pb-24" style={{ fontFamily: 'Lexend, sans-serif' }}>

            {/* Header */}
            <div className="bg-white px-5 pt-12 pb-5 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-extrabold text-gray-900">Gestão de Licenças</h1>
                        <p className="text-xs text-gray-400 font-medium">Equipe de Cuidadores</p>
                    </div>
                </div>
            </div>

            <div className="px-4 pt-4 flex flex-col gap-4">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <span className="w-10 h-10 border-4 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Capacity Card */}
                        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                            <div className="mb-3">
                                <div className="flex items-end gap-1">
                                    <span className="text-3xl font-black text-gray-900">{used}</span>
                                    <span className="text-gray-400 font-bold text-lg mb-0.5">/{totalLicenses}</span>
                                </div>
                                <p className="text-xs text-orange-500 font-extrabold mt-0.5">
                                    Capacidade Total · {totalLicenses - used} disponíveis
                                </p>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-4">
                                <div className="h-2.5 rounded-full bg-[#f97316] transition-all" style={{ width: `${Math.min((used / totalLicenses) * 100, 100)}%` }} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Link href="/auth/caregiver-register" className="bg-[#f97316] hover:bg-orange-500 active:scale-[0.98] transition-all text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm shadow-md shadow-orange-100">
                                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                                    </svg>
                                    Vincular Cuidador
                                </Link>
                                <button onClick={generateCode} className="bg-white border-2 border-gray-200 text-gray-700 font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm hover:border-orange-300 hover:text-orange-500 transition-all">
                                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                                    </svg>
                                    Gerar Código
                                </button>
                            </div>
                            {showCode && (
                                <div className="mt-3 bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 text-center">
                                    <p className="text-xs font-bold text-orange-500 mb-1 uppercase tracking-wide">Código de Convite</p>
                                    <p className="text-3xl font-black text-orange-600 tracking-[0.3em]">{generatedCode}</p>
                                    <p className="text-xs text-orange-400 font-medium mt-1">Compartilhe com o usuário para criar a conta</p>
                                </div>
                            )}
                        </div>

                        {/* Search */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 px-4">
                            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input type="text" className="flex-1 py-3.5 text-sm font-medium text-gray-800 placeholder-gray-300 bg-transparent outline-none" placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {([
                                { key: 'all', label: `Todos (${licenses.length})` },
                                { key: 'active', label: `Ativos (${activeCount})` },
                                { key: 'pending', label: `Pendentes (${pendingCount})` },
                            ] as const).map(t => (
                                <button key={t.key} onClick={() => setTab(t.key)}
                                    className={`px-4 py-2 rounded-full text-xs font-extrabold transition-all whitespace-nowrap flex-shrink-0 ${tab === t.key ? (t.key === 'pending' ? 'bg-amber-500 text-white' : 'bg-[#f97316] text-white shadow-sm') : 'bg-white text-gray-500 border border-gray-200'}`}>
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* License List */}
                        <div className="flex flex-col gap-2">
                            {filtered.length === 0 && (
                                <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-100">
                                    <p className="text-gray-400 font-medium text-sm">{licenses.length === 0 ? 'Nenhuma licença emitida ainda.' : 'Nenhum resultado encontrado.'}</p>
                                </div>
                            )}
                            {filtered.map(lic => {
                                const displayName = lic.userName ?? 'Sem nome'
                                const initial = displayName[0].toUpperCase()
                                return (
                                    <div key={lic.id} className="bg-white rounded-2xl px-4 py-4 shadow-sm border border-gray-100 flex items-center gap-4">
                                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-200 to-purple-300 flex items-center justify-center flex-shrink-0">
                                            <span className="text-white font-extrabold text-base">{initial}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-extrabold text-gray-900 text-sm leading-tight truncate">{displayName}</p>
                                            <p className="text-xs text-gray-400 font-medium mt-0.5">
                                                {roleLabel(lic.userRole)} ·{' '}
                                                {lic.status === 'pending' ? <span className="text-amber-500 font-bold">Pendente</span>
                                                    : lic.status === 'active' ? `Ativo desde ${formatDate(lic.activated_at)}`
                                                    : 'Revogada'}
                                            </p>
                                            <p className="text-[11px] text-gray-300 font-mono mt-0.5">{lic.code}</p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${lic.status === 'active' ? 'bg-emerald-50 text-emerald-600' : lic.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                                                {lic.status === 'active' ? 'ATIVA' : lic.status === 'pending' ? 'PEND.' : 'REV.'}
                                            </span>
                                            {/* ⋮ Menu button */}
                                            <button onClick={() => setSelectedLicense(lic)} className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-orange-50 flex items-center justify-center transition-colors">
                                                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="5" r="1" fill="#6b7280" /><circle cx="12" cy="12" r="1" fill="#6b7280" /><circle cx="12" cy="19" r="1" fill="#6b7280" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* ── ACTION SHEET ── */}
            {selectedLicense && !showRoleModal && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedLicense(null)} />
                    <div className="relative bg-white rounded-t-3xl p-6 flex flex-col gap-3 shadow-2xl">
                        {/* User info */}
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-200 to-purple-300 flex items-center justify-center">
                                <span className="text-white font-extrabold text-lg">{(selectedLicense.userName ?? 'S')[0].toUpperCase()}</span>
                            </div>
                            <div>
                                <p className="font-extrabold text-gray-900">{selectedLicense.userName ?? 'Sem nome'}</p>
                                <p className="text-sm text-gray-400">{roleLabel(selectedLicense.userRole)} · <span className="font-mono text-xs">{selectedLicense.code}</span></p>
                            </div>
                        </div>

                        {/* Actions */}
                        <button
                            onClick={() => setShowRoleModal(true)}
                            className="w-full flex items-center gap-4 bg-blue-50 hover:bg-blue-100 active:scale-[0.99] transition-all rounded-2xl px-5 py-4"
                        >
                            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
                                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </div>
                            <div className="text-left">
                                <p className="font-extrabold text-blue-700 text-sm">Alterar Tipo de Usuário</p>
                                <p className="text-xs text-blue-400">Mudar entre Cuidador e Paciente</p>
                            </div>
                        </button>

                        {selectedLicense.status === 'revoked' ? (
                            <button
                                onClick={handleRestore}
                                disabled={actionLoading}
                                className="w-full flex items-center gap-4 bg-emerald-50 hover:bg-emerald-100 active:scale-[0.99] transition-all rounded-2xl px-5 py-4 disabled:opacity-50"
                            >
                                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                    </svg>
                                </div>
                                <div className="text-left">
                                    <p className="font-extrabold text-emerald-700 text-sm">Restaurar Licença</p>
                                    <p className="text-xs text-emerald-400">Reativar acesso do usuário</p>
                                </div>
                            </button>
                        ) : (
                            <button
                                onClick={handleRevoke}
                                disabled={actionLoading}
                                className="w-full flex items-center gap-4 bg-amber-50 hover:bg-amber-100 active:scale-[0.99] transition-all rounded-2xl px-5 py-4 disabled:opacity-50"
                            >
                                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                    </svg>
                                </div>
                                <div className="text-left">
                                    <p className="font-extrabold text-amber-700 text-sm">Revogar Licença</p>
                                    <p className="text-xs text-amber-400">Suspende o acesso do usuário</p>
                                </div>
                            </button>
                        )}

                        <button
                            onClick={handleDelete}
                            disabled={actionLoading}
                            className="w-full flex items-center gap-4 bg-red-50 hover:bg-red-100 active:scale-[0.99] transition-all rounded-2xl px-5 py-4 disabled:opacity-50"
                        >
                            <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
                                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                </svg>
                            </div>
                            <div className="text-left">
                                <p className="font-extrabold text-red-700 text-sm">Excluir Licença</p>
                                <p className="text-xs text-red-400">Remove permanentemente do sistema</p>
                            </div>
                        </button>

                        <button onClick={() => setSelectedLicense(null)} className="w-full py-3.5 rounded-2xl bg-gray-100 font-extrabold text-gray-500 text-sm mt-1">
                            Cancelar
                        </button>

                        {actionLoading && (
                            <div className="absolute inset-0 bg-white/70 rounded-t-3xl flex items-center justify-center">
                                <span className="w-8 h-8 border-4 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── ROLE CHANGE MODAL ── */}
            {showRoleModal && selectedLicense && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ fontFamily: 'Lexend, sans-serif' }}>
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowRoleModal(false)} />
                    <div className="relative bg-white rounded-t-3xl p-6 flex flex-col gap-3 shadow-2xl">
                        <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wide mb-1">Alterar tipo de usuário</p>
                        <p className="text-sm text-gray-600 font-medium mb-3">Selecione o novo papel para <strong>{selectedLicense.userName}</strong>:</p>

                        <button onClick={() => handleChangeRole('caregiver')} disabled={actionLoading || selectedLicense.userRole === 'caregiver'}
                            className={`w-full flex items-center gap-4 rounded-2xl px-5 py-4 transition-all ${selectedLicense.userRole === 'caregiver' ? 'bg-violet-100 border-2 border-violet-400' : 'bg-gray-50 hover:bg-violet-50 border-2 border-transparent'}`}>
                            <div className="text-3xl">🩺</div>
                            <div className="text-left flex-1">
                                <p className="font-extrabold text-gray-900 text-sm">Cuidador</p>
                                <p className="text-xs text-gray-400">Acessa e gerencia pacientes</p>
                            </div>
                            {selectedLicense.userRole === 'caregiver' && (
                                <span className="text-xs font-extrabold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">Atual</span>
                            )}
                        </button>

                        <button onClick={() => handleChangeRole('patient')} disabled={actionLoading || selectedLicense.userRole === 'patient'}
                            className={`w-full flex items-center gap-4 rounded-2xl px-5 py-4 transition-all ${selectedLicense.userRole === 'patient' ? 'bg-blue-100 border-2 border-blue-400' : 'bg-gray-50 hover:bg-blue-50 border-2 border-transparent'}`}>
                            <div className="text-3xl">👤</div>
                            <div className="text-left flex-1">
                                <p className="font-extrabold text-gray-900 text-sm">Paciente</p>
                                <p className="text-xs text-gray-400">Usuário de cuidados da plataforma</p>
                            </div>
                            {selectedLicense.userRole === 'patient' && (
                                <span className="text-xs font-extrabold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Atual</span>
                            )}
                        </button>

                        <button onClick={() => setShowRoleModal(false)} className="w-full py-3.5 rounded-2xl bg-gray-100 font-extrabold text-gray-500 text-sm mt-1">
                            Cancelar
                        </button>

                        {actionLoading && (
                            <div className="absolute inset-0 bg-white/70 rounded-t-3xl flex items-center justify-center">
                                <span className="w-8 h-8 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                <Link href="/institution/dashboard" className="bottom-nav-item">
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                    <span>Início</span>
                </Link>
                <Link href="/institution/licenses" className="bottom-nav-item active">
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
                    <span style={{ color: '#f97316' }}>Licenças</span>
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

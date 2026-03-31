'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { IconHome, IconPill, IconRoutine, IconBarChart } from '@/components/Icons'

interface Invite {
    id: string
    invite_token: string
    status: string
    accepted_by: string | null
    created_at: string
    accepted_at: string | null
    accepted_user_name?: string
}

export default function PatientTeamPage() {
    const { user } = useAuth()
    const [invites, setInvites] = useState<Invite[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [licenseId, setLicenseId] = useState<string | null>(null)
    const [maxMembers, setMaxMembers] = useState(5)
    const [copied, setCopied] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!user) return
        loadData()
    }, [user])

    async function loadData() {
        // Get user's license
        const { data: license } = await supabase
            .from('licenses')
            .select('id, max_members')
            .or(`owner_id.eq.${user!.id},assigned_to.eq.${user!.id}`)
            .eq('status', 'active')
            .maybeSingle()

        if (!license) {
            setLoading(false)
            return
        }

        setLicenseId(license.id)
        setMaxMembers(license.max_members)

        // Get all invites for this license
        const { data: inviteData } = await supabase
            .from('invites')
            .select('id, invite_token, status, accepted_by, created_at, accepted_at')
            .eq('license_id', license.id)
            .order('created_at', { ascending: false })

        if (inviteData) {
            // Fetch names of accepted users
            const enriched: Invite[] = []
            for (const inv of inviteData) {
                let accepted_user_name: string | undefined
                if (inv.accepted_by) {
                    const { data: u } = await supabase
                        .from('users')
                        .select('name')
                        .eq('id', inv.accepted_by)
                        .maybeSingle()
                    accepted_user_name = u?.name || undefined
                }
                enriched.push({ ...inv, accepted_user_name })
            }
            setInvites(enriched)
        }

        setLoading(false)
    }

    async function createInvite() {
        if (!licenseId) return
        setCreating(true)
        setError(null)

        const acceptedCount = invites.filter(i => i.status === 'accepted').length
        if (acceptedCount >= maxMembers) {
            setError(`Limite de ${maxMembers} convidados atingido.`)
            setCreating(false)
            return
        }

        const { data, error: err } = await supabase
            .from('invites')
            .insert({
                license_id: licenseId,
                invited_by: user!.id,
            })
            .select('id, invite_token, status, accepted_by, created_at, accepted_at')
            .single()

        if (err) {
            setError(err.message)
        } else if (data) {
            setInvites([data, ...invites])
            // Auto-copy link
            const link = `${window.location.origin}/invite/${data.invite_token}`
            await navigator.clipboard.writeText(link).catch(() => {})
            setCopied(true)
            setTimeout(() => setCopied(false), 3000)
        }

        setCreating(false)
    }

    async function revokeInvite(id: string) {
        await supabase.from('invites').update({ status: 'revoked' }).eq('id', id)
        setInvites(invites.map(i => i.id === id ? { ...i, status: 'revoked' } : i))
    }

    async function deleteInvite(id: string) {
        await supabase.from('invites').delete().eq('id', id)
        setInvites(invites.filter(i => i.id !== id))
    }

    async function copyLink(token: string) {
        const link = `${window.location.origin}/invite/${token}`
        await navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const acceptedCount = invites.filter(i => i.status === 'accepted').length

    return (
        <div className="min-h-screen bg-[#f7f8fc] pb-28" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {/* Header */}
            <div className="bg-gradient-to-br from-sky-400 to-blue-500 px-5 pt-12 pb-16 text-white relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
                <div className="relative z-10">
                    <h1 className="text-xl font-extrabold">Minha Equipe</h1>
                    <p className="text-sky-200 text-sm mt-0.5">Convide cuidadores e familiares</p>
                    <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 mt-4 flex justify-around">
                        <div className="text-center">
                            <p className="text-2xl font-bold">{acceptedCount}</p>
                            <p className="text-xs text-sky-200">Ativos</p>
                        </div>
                        <div className="w-px bg-white/20" />
                        <div className="text-center">
                            <p className="text-2xl font-bold">{maxMembers}</p>
                            <p className="text-xs text-sky-200">Maximo</p>
                        </div>
                        <div className="w-px bg-white/20" />
                        <div className="text-center">
                            <p className="text-2xl font-bold">{maxMembers - acceptedCount}</p>
                            <p className="text-xs text-sky-200">Disponiveis</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-4 -mt-6 relative z-10">
                {loading ? (
                    <div className="flex justify-center p-10">
                        <span className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : !licenseId ? (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center">
                        <p className="text-gray-500">Voce precisa de uma licenca ativa para convidar pessoas.</p>
                    </div>
                ) : (
                    <>
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3 mb-4">
                                {error}
                            </div>
                        )}

                        {copied && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl px-4 py-3 mb-4 font-bold">
                                Link copiado! Envie por WhatsApp ou email.
                            </div>
                        )}

                        {/* Create invite button */}
                        <button
                            onClick={createInvite}
                            disabled={creating || acceptedCount >= maxMembers}
                            className="w-full bg-[#42b6f0] text-white font-extrabold py-4 rounded-2xl mb-4 flex items-center justify-center gap-2 hover:bg-sky-500 transition-colors disabled:opacity-50 shadow-lg shadow-sky-200"
                        >
                            {creating ? (
                                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                    Gerar Link de Convite
                                </>
                            )}
                        </button>

                        {/* Invite list */}
                        {invites.length === 0 ? (
                            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center">
                                <p className="text-4xl mb-3">🤝</p>
                                <p className="font-bold text-gray-700">Nenhum convite ainda</p>
                                <p className="text-sm text-gray-400 mt-1">Gere um link acima para convidar alguem</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {invites.map(invite => (
                                    <div key={invite.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2.5 h-2.5 rounded-full ${
                                                    invite.status === 'accepted' ? 'bg-emerald-400' :
                                                    invite.status === 'revoked' ? 'bg-red-400' : 'bg-amber-400'
                                                }`} />
                                                <span className="text-sm font-bold text-gray-800">
                                                    {invite.status === 'accepted'
                                                        ? invite.accepted_user_name || 'Aceito'
                                                        : invite.status === 'revoked'
                                                        ? 'Revogado'
                                                        : 'Pendente'}
                                                </span>
                                            </div>
                                            <span className="text-xs text-gray-400">
                                                {new Date(invite.created_at).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>

                                        <div className="flex gap-2 mt-3">
                                            {invite.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => copyLink(invite.invite_token)}
                                                        className="flex-1 py-2 rounded-xl bg-sky-50 text-[#42b6f0] text-sm font-bold border border-sky-200 hover:bg-sky-100 transition-colors"
                                                    >
                                                        Copiar link
                                                    </button>
                                                    <button
                                                        onClick={() => revokeInvite(invite.id)}
                                                        className="px-4 py-2 rounded-xl bg-red-50 text-red-500 text-sm font-bold border border-red-200 hover:bg-red-100 transition-colors"
                                                    >
                                                        Revogar
                                                    </button>
                                                </>
                                            )}
                                            {(invite.status === 'accepted' || invite.status === 'revoked') && (
                                                <button
                                                    onClick={() => deleteInvite(invite.id)}
                                                    className="flex-1 py-2 rounded-xl bg-red-50 text-red-500 text-sm font-bold border border-red-200 hover:bg-red-100 transition-colors"
                                                >
                                                    Remover
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                <Link href="/patient/home" className="bottom-nav-item">
                    <IconHome size={22} /><span>Inicio</span>
                </Link>
                <Link href="/patient/medications" className="bottom-nav-item">
                    <IconPill size={22} /><span>Remedios</span>
                </Link>
                <Link href="/patient/routine" className="bottom-nav-item">
                    <IconRoutine size={22} /><span>Rotina</span>
                </Link>
                <Link href="/patient/reports" className="bottom-nav-item">
                    <IconBarChart size={22} /><span>Relatorios</span>
                </Link>
            </nav>
        </div>
    )
}

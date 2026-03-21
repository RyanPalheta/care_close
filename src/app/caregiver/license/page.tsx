'use client'

import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { IconHome, IconCalendar, IconBarChart, IconSettings } from '@/components/Icons'

interface LicenseData {
    id: string
    license_type: string
    status: string
    max_patients: number
    max_members: number
    purchased_at: string | null
    code: string | null
}

export default function CaregiverLicensePage() {
    const { user } = useAuth()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [license, setLicense] = useState<LicenseData | null>(null)
    const [patientCount, setPatientCount] = useState(0)

    useEffect(() => {
        if (!user) return
        loadLicense()
    }, [user])

    async function loadLicense() {
        // Buscar licenca do usuario (owner_id ou assigned_to)
        const { data } = await supabase
            .from('licenses')
            .select('id, license_type, status, max_patients, max_members, purchased_at, code')
            .or(`owner_id.eq.${user!.id},assigned_to.eq.${user!.id}`)
            .eq('status', 'active')
            .maybeSingle()

        setLicense(data)

        if (data) {
            // Contar pacientes vinculados
            const { count } = await supabase
                .from('patients')
                .select('id', { count: 'exact', head: true })
                .eq('license_id', data.id)
            setPatientCount(count || 0)
        }

        setLoading(false)
    }

    const typeLabels: Record<string, string> = {
        cuidador: 'Cuidador Profissional',
        paciente: 'Paciente Individual',
    }

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
                        <h1 className="text-lg font-extrabold text-gray-900">Minha Licenca</h1>
                        <p className="text-xs text-gray-400 font-medium">Detalhes do seu plano</p>
                    </div>
                </div>
            </div>

            <div className="px-4 pt-6">
                {loading ? (
                    <div className="flex justify-center p-10">
                        <span className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : license ? (
                    <div className="flex flex-col gap-4">
                        {/* License Card */}
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-4 mb-5">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
                                    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                        <polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-lg font-extrabold text-gray-900">Licenca Ativa</h2>
                                    <p className="text-sm text-gray-400">{typeLabels[license.license_type] || license.license_type}</p>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-3">
                                {license.code && (
                                    <div>
                                        <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wide">Codigo</p>
                                        <p className="font-bold text-gray-800 tracking-wider">{license.code}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wide">Pacientes</p>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-gray-800">{patientCount} / {license.max_patients}</p>
                                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500"
                                                style={{ width: `${Math.min((patientCount / license.max_patients) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                {license.max_members > 0 && (
                                    <div>
                                        <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wide">Convidados permitidos</p>
                                        <p className="font-bold text-gray-800">{license.max_members}</p>
                                    </div>
                                )}
                                {license.purchased_at && (
                                    <div>
                                        <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wide">Comprada em</p>
                                        <p className="font-bold text-gray-800">
                                            {new Date(license.purchased_at).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wide">Tipo</p>
                                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                                        Vitalicia
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* No License */
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
                            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-extrabold text-gray-900 leading-tight mb-1">Sem Licenca Ativa</h2>
                        <p className="text-sm text-gray-400 font-medium mb-6">
                            Voce ainda nao possui uma licenca. Adquira a sua para ter acesso completo a plataforma.
                        </p>
                        <p className="text-xs text-gray-500 font-medium bg-amber-50 p-4 rounded-xl border border-amber-100">
                            Acesse nossa pagina de vendas para adquirir sua licenca vitalicia e comecar a gerenciar seus pacientes.
                        </p>
                    </div>
                )}
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                <Link href="/caregiver/home" className="bottom-nav-item">
                    <IconHome size={22} /><span>Pacientes</span>
                </Link>
                <Link href="/caregiver/schedule" className="bottom-nav-item">
                    <IconCalendar size={22} /><span>Agenda</span>
                </Link>
                <Link href="/caregiver/alerts" className="bottom-nav-item">
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    <span>Avisos</span>
                </Link>
                <Link href="/caregiver/settings" className="bottom-nav-item">
                    <IconSettings size={22} /><span>Config</span>
                </Link>
            </nav>
        </div>
    )
}

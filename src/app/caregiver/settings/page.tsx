'use client'

import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { IconHome, IconCalendar, IconBarChart, IconSettings, IconLogout, IconBell, IconUsers } from '@/components/Icons'
import { useRouter } from 'next/navigation'

export default function CaregiverSettingsPage() {
    const { user, profile } = useAuth()
    const router = useRouter()

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/auth')
    }

    const userName = profile?.name ?? 'Cuidador'

    return (
        <div className="pb-24">
            {/* Header */}
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-6 pt-12 pb-20 text-white relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10" />
                <div className="relative z-10">
                    <h1 className="text-xl font-bold mb-1">Configurações</h1>
                    <p className="text-violet-200 text-sm break-words">{userName} • {user?.email}</p>
                </div>
            </div >

            <div className="px-4 -mt-12">
                <div className="card shadow-sm mb-6 pb-2">
                    <h2 className="font-bold text-gray-800 mb-4 px-2">Sua Conta</h2>

                    <div className="flex flex-col gap-2">
                        <button className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors text-left border border-transparent">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
                                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                                    </svg>
                                </div>
                                <span className="font-semibold text-gray-700">Meu Plano (Licença)</span>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>


                        <div className="h-px bg-gray-100 mx-4" />

                        <button className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors text-left border border-transparent">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <IconUsers size={16} color="#42b6f0" />
                                </div>
                                <span className="font-semibold text-gray-700">Equipe de Cuidadores</span>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="card shadow-sm mb-6 pb-2">
                    <h2 className="font-bold text-gray-800 mb-4 px-2">Aplicativo</h2>

                    <div className="flex flex-col gap-2">
                        <button className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors text-left border border-transparent">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center">
                                    <IconBell size={16} color="#f87171" />
                                </div>
                                <span className="font-semibold text-gray-700">Notificações</span>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>

                        <div className="h-px bg-gray-100 mx-4" />

                        <button className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors text-left border border-transparent">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
                                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.94 14a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.88 3.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 10a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg>
                                </div>
                                <span className="font-semibold text-gray-700">Ajuda e Suporte</span>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="w-full card bg-red-50 text-red-600 font-bold border border-red-100 flex items-center justify-center gap-2 hover:bg-red-100 transition-colors py-4 rounded-2xl"
                >
                    <IconLogout size={18} color="#ef4444" />
                    Sair da Conta
                </button>
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                <Link href="/caregiver/home" className="bottom-nav-item">
                    <IconHome size={22} />
                    <span>Pacientes</span>
                </Link>
                <Link href="/caregiver/schedule" className="bottom-nav-item">
                    <IconCalendar size={22} />
                    <span>Agenda</span>
                </Link>
                <Link href="/caregiver/reports" className="bottom-nav-item">
                    <IconBarChart size={22} />
                    <span>Relatórios</span>
                </Link>
                <Link href="/caregiver/settings" className="bottom-nav-item active">
                    <IconSettings size={22} color="#42b6f0" />
                    <span>Config</span>
                </Link>
            </nav>
        </div >
    )
}

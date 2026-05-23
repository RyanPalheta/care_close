'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { enablePushNotifications, updatePushLeadMinutes, showTestNotification } from '@/lib/push-notifications'

export default function CaregiverNotificationsPage() {
    const { user } = useAuth()
    const router = useRouter()
    const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('unsupported')
    const [loading, setLoading] = useState(false)
    const [leadMinutes, setLeadMinutes] = useState(5)

    useEffect(() => {
        if (!('Notification' in window)) {
            setPermissionState('unsupported')
            return
        }
        const perm = Notification.permission
        setPermissionState(perm === 'granted' ? 'granted' : perm === 'denied' ? 'denied' : 'prompt')

        // Load saved preference
        const saved = localStorage.getItem('cc_notif_lead_minutes')
        const lead = saved ? parseInt(saved) : 5
        if (saved) setLeadMinutes(lead)

        // Auto-sync: if permission already granted, ensure server subscription exists
        if (perm === 'granted') {
            enablePushNotifications(lead).then(r => {
                if (!r.ok) console.warn('Auto-resubscribe failed:', r.reason)
            })
        }
    }, [])

    async function enableNotifications() {
        setLoading(true)
        const result = await enablePushNotifications(leadMinutes)
        if (result.ok) {
            setPermissionState('granted')
        } else if (result.reason === 'permission-denied') {
            setPermissionState('denied')
        } else {
            alert('Não foi possível ativar as notificações: ' + (result.reason || 'erro'))
        }
        setLoading(false)
    }

    function updateLeadMinutes(value: number) {
        setLeadMinutes(value)
        localStorage.setItem('cc_notif_lead_minutes', value.toString())
        if (Notification.permission === 'granted') {
            updatePushLeadMinutes(value)
        }
    }

    async function sendTestNotification() {
        await showTestNotification()
    }

    return (
        <div className="min-h-screen bg-[#f7f8fc] pb-10" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {/* Header */}
            <div className="bg-white px-5 pt-12 pb-5 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-extrabold text-gray-900">Notificacoes</h1>
                        <p className="text-xs text-gray-400 font-medium">Lembretes de medicacao</p>
                    </div>
                </div>
            </div>

            <div className="px-4 pt-6 flex flex-col gap-4">
                {/* Status Card */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                            permissionState === 'granted' ? 'bg-emerald-100' :
                            permissionState === 'denied' ? 'bg-red-100' : 'bg-amber-100'
                        }`}>
                            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={
                                permissionState === 'granted' ? '#10b981' :
                                permissionState === 'denied' ? '#ef4444' : '#f59e0b'
                            } strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-extrabold text-gray-900">
                                {permissionState === 'granted' ? 'Ativadas' :
                                 permissionState === 'denied' ? 'Bloqueadas' :
                                 permissionState === 'unsupported' ? 'Nao suportado' : 'Desativadas'}
                            </h2>
                            <p className="text-sm text-gray-400">
                                {permissionState === 'granted' ? 'Voce recebera lembretes no celular' :
                                 permissionState === 'denied' ? 'Permissao bloqueada pelo navegador' :
                                 permissionState === 'unsupported' ? 'Seu navegador nao suporta notificacoes' :
                                 'Ative para receber lembretes de medicacao'}
                            </p>
                        </div>
                    </div>

                    {permissionState === 'prompt' && (
                        <button
                            onClick={enableNotifications}
                            disabled={loading}
                            className="w-full py-3.5 rounded-2xl bg-[#42b6f0] text-white font-extrabold hover:bg-sky-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                    </svg>
                                    Ativar Notificacoes
                                </>
                            )}
                        </button>
                    )}

                    {permissionState === 'denied' && (
                        <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
                            <p className="text-sm text-red-600 font-medium">
                                As notificacoes foram bloqueadas. Para reativar, acesse as configuracoes do seu navegador e permita notificacoes para este site.
                            </p>
                        </div>
                    )}

                    {permissionState === 'granted' && (
                        <button
                            onClick={sendTestNotification}
                            className="w-full py-3 rounded-2xl bg-emerald-50 text-emerald-600 font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors"
                        >
                            Enviar notificacao de teste
                        </button>
                    )}
                </div>

                {/* Settings */}
                {permissionState === 'granted' && (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <h3 className="font-extrabold text-gray-900 mb-4">Configuracoes</h3>

                        <div className="mb-4">
                            <label className="text-sm font-bold text-gray-600 mb-2 block">
                                Lembrar antes do horario
                            </label>
                            <div className="flex gap-2">
                                {[0, 5, 10, 15, 30].map(min => (
                                    <button
                                        key={min}
                                        onClick={() => updateLeadMinutes(min)}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                            leadMinutes === min
                                                ? 'bg-[#42b6f0] text-white shadow-md'
                                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                    >
                                        {min === 0 ? 'Na hora' : `${min}min`}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-2">
                                {leadMinutes === 0
                                    ? 'Voce sera notificado exatamente no horario da medicacao'
                                    : `Voce sera notificado ${leadMinutes} minutos antes do horario`}
                            </p>
                        </div>

                        <div className="border-t border-gray-100 pt-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">Medicacoes dos pacientes</p>
                                    <p className="text-xs text-gray-400">Receber avisos de todos os pacientes vinculados</p>
                                </div>
                                <div className="w-12 h-7 bg-emerald-400 rounded-full relative cursor-pointer">
                                    <div className="w-5 h-5 bg-white rounded-full absolute top-1 right-1 shadow-sm" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Info */}
                <div className="bg-sky-50 rounded-2xl p-4 border border-sky-100">
                    <p className="text-sm text-sky-700 font-medium">
                        As notificacoes push funcionam mesmo com o aplicativo fechado. Para melhor experiencia, adicione o Care Close a tela inicial do seu celular.
                    </p>
                </div>
            </div>
        </div>
    )
}

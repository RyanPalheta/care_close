'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { enablePushNotifications, disablePushNotifications, updatePushLeadMinutes, showTestNotification } from '@/lib/push-notifications'

interface NotifPrefs {
    medReminders: boolean
    medLeadMinutes: number
    stockAlerts: boolean
    routineReminder: boolean
    routineTime: string
}

const DEFAULT_PREFS: NotifPrefs = {
    medReminders: true,
    medLeadMinutes: 5,
    stockAlerts: true,
    routineReminder: false,
    routineTime: '20:00',
}

function loadPrefs(): NotifPrefs {
    try {
        const saved = localStorage.getItem('cc_notif_prefs')
        if (saved) {
            return { ...DEFAULT_PREFS, ...JSON.parse(saved) }
        }
        // Migrate old lead minutes
        const oldLead = localStorage.getItem('cc_notif_lead_minutes')
        if (oldLead) {
            return { ...DEFAULT_PREFS, medLeadMinutes: parseInt(oldLead) || 5 }
        }
    } catch { /* ignore */ }
    return { ...DEFAULT_PREFS }
}

function savePrefs(prefs: NotifPrefs) {
    localStorage.setItem('cc_notif_prefs', JSON.stringify(prefs))
    // Keep old key for backwards compatibility with home page
    localStorage.setItem('cc_notif_lead_minutes', prefs.medLeadMinutes.toString())
}

export default function PatientNotificationsPage() {
    const { user } = useAuth()
    const router = useRouter()
    const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('unsupported')
    const [loading, setLoading] = useState(false)
    const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)

    useEffect(() => {
        if (!('Notification' in window)) {
            setPermissionState('unsupported')
            return
        }
        const perm = Notification.permission
        setPermissionState(perm === 'granted' ? 'granted' : perm === 'denied' ? 'denied' : 'prompt')
        setPrefs(loadPrefs())
    }, [])

    function updatePref<K extends keyof NotifPrefs>(key: K, value: NotifPrefs[K]) {
        const updated = { ...prefs, [key]: value }
        setPrefs(updated)
        savePrefs(updated)
        // Sync lead time to server-side subscription
        if (key === 'medLeadMinutes' && Notification.permission === 'granted') {
            updatePushLeadMinutes(value as number)
        }
    }

    async function enableNotifications() {
        setLoading(true)
        const result = await enablePushNotifications(prefs.medLeadMinutes)
        if (result.ok) {
            setPermissionState('granted')
        } else if (result.reason === 'permission-denied') {
            setPermissionState('denied')
        } else {
            alert('Não foi possível ativar as notificações: ' + (result.reason || 'erro desconhecido'))
        }
        setLoading(false)
    }

    async function sendTestNotification() {
        await showTestNotification()
    }

    const Toggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
        <button
            onClick={onToggle}
            className={`relative w-12 h-7 rounded-full transition-colors ${enabled ? 'bg-[#42b6f0]' : 'bg-gray-300'}`}
        >
            <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
    )

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
                        <p className="text-xs text-gray-400 font-medium">Configure seus lembretes</p>
                    </div>
                </div>
            </div>

            <div className="px-4 pt-6 flex flex-col gap-4">
                {/* Permission Status */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            permissionState === 'granted' ? 'bg-emerald-100' :
                            permissionState === 'denied' ? 'bg-red-100' : 'bg-amber-100'
                        }`}>
                            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={
                                permissionState === 'granted' ? '#10b981' :
                                permissionState === 'denied' ? '#ef4444' : '#f59e0b'
                            } strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h2 className="font-extrabold text-gray-900">
                                {permissionState === 'granted' ? 'Notificacoes Ativas' :
                                 permissionState === 'denied' ? 'Bloqueadas' :
                                 permissionState === 'unsupported' ? 'Nao suportado' : 'Desativadas'}
                            </h2>
                            <p className="text-xs text-gray-400">
                                {permissionState === 'granted' ? 'Voce recebera lembretes no celular' :
                                 permissionState === 'denied' ? 'Desbloqueie nas config. do navegador' :
                                 permissionState === 'unsupported' ? 'Navegador incompativel' :
                                 'Ative para receber lembretes'}
                            </p>
                        </div>
                        {permissionState === 'prompt' && (
                            <button
                                onClick={enableNotifications}
                                disabled={loading}
                                className="px-4 py-2.5 rounded-2xl bg-[#42b6f0] text-white font-bold text-sm hover:bg-sky-500 transition-colors disabled:opacity-50"
                            >
                                {loading ? (
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                                ) : 'Ativar'}
                            </button>
                        )}
                        {permissionState === 'granted' && (
                            <button
                                onClick={sendTestNotification}
                                className="px-4 py-2.5 rounded-2xl bg-emerald-50 text-emerald-600 font-bold text-sm border border-emerald-200 hover:bg-emerald-100 transition-colors"
                            >
                                Testar
                            </button>
                        )}
                    </div>
                </div>

                {/* Medication Reminders */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 pb-0">
                        <div className="flex items-center gap-3 mb-1">
                            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                            </svg>
                            <h3 className="font-extrabold text-gray-900">Medicamentos</h3>
                        </div>
                    </div>

                    <div className="divide-y divide-gray-50">
                        {/* Toggle reminders */}
                        <div className="flex items-center justify-between px-5 py-4">
                            <div>
                                <p className="text-sm font-bold text-gray-800">Lembretes de remedios</p>
                                <p className="text-xs text-gray-400">Notificar nos horarios agendados</p>
                            </div>
                            <Toggle enabled={prefs.medReminders} onToggle={() => updatePref('medReminders', !prefs.medReminders)} />
                        </div>

                        {/* Lead time */}
                        {prefs.medReminders && (
                            <div className="px-5 py-4">
                                <p className="text-sm font-bold text-gray-800 mb-3">Antecedencia</p>
                                <div className="flex gap-2">
                                    {[0, 5, 10, 15, 30].map(min => (
                                        <button
                                            key={min}
                                            onClick={() => updatePref('medLeadMinutes', min)}
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                                prefs.medLeadMinutes === min
                                                    ? 'bg-[#7c3aed] text-white shadow-md shadow-violet-200'
                                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                            }`}
                                        >
                                            {min === 0 ? 'Na hora' : `${min}min`}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[11px] text-gray-400 mt-2">
                                    {prefs.medLeadMinutes === 0
                                        ? 'Notificacao exatamente no horario'
                                        : `Notificacao ${prefs.medLeadMinutes} minutos antes`}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stock Alerts */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between p-5">
                        <div className="flex items-center gap-3">
                            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 7h-9" /><path d="M14 17H5" />
                                <circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />
                            </svg>
                            <div>
                                <p className="text-sm font-bold text-gray-800">Alerta de estoque</p>
                                <p className="text-xs text-gray-400">Avisar quando remedio estiver acabando</p>
                            </div>
                        </div>
                        <Toggle enabled={prefs.stockAlerts} onToggle={() => updatePref('stockAlerts', !prefs.stockAlerts)} />
                    </div>
                </div>

                {/* Routine Reminder */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="flex items-center justify-between p-5">
                        <div className="flex items-center gap-3">
                            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                                <path d="M12 6v6l4 2" />
                            </svg>
                            <div>
                                <p className="text-sm font-bold text-gray-800">Lembrete de rotina</p>
                                <p className="text-xs text-gray-400">Lembrar de preencher a rotina diaria</p>
                            </div>
                        </div>
                        <Toggle enabled={prefs.routineReminder} onToggle={() => updatePref('routineReminder', !prefs.routineReminder)} />
                    </div>

                    {prefs.routineReminder && (
                        <div className="px-5 pb-5 pt-0">
                            <p className="text-sm font-bold text-gray-800 mb-2">Horario do lembrete</p>
                            <input
                                type="time"
                                value={prefs.routineTime}
                                onChange={e => updatePref('routineTime', e.target.value)}
                                className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-gray-900 text-sm font-medium focus:outline-none focus:border-[#10b981] focus:ring-2 focus:ring-emerald-100 transition-all"
                            />
                            <p className="text-[11px] text-gray-400 mt-2">
                                Voce sera lembrado todos os dias as {prefs.routineTime}
                            </p>
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="bg-sky-50 rounded-2xl p-4 border border-sky-100">
                    <p className="text-sm text-sky-700 font-medium">
                        Para melhor experiencia, adicione o Care Close a tela inicial do seu celular. As notificacoes funcionam mesmo com o app fechado.
                    </p>
                </div>
            </div>
        </div>
    )
}

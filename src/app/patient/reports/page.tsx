'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { IconHome, IconPill, IconRoutine, IconBarChart, IconCheckCircle, IconXCircle, IconSkip } from '@/components/Icons'

interface ScheduleItem {
    id: string
    scheduled_time: string
    status: 'pending' | 'taken' | 'missed' | 'skipped'
    medication: { name: string; dosage: string; unit: string }
}

interface DayStats { date: string; total: number; taken: number; missed: number; skipped: number }

function ReportsContent() {
    const { user, profile } = useAuth()
    const searchParams = useSearchParams()
    const [patientId, setPatientId] = useState<string | null>(null)
    const [stats, setStats] = useState<DayStats[]>([])
    const [todaySchedules, setTodaySchedules] = useState<ScheduleItem[]>([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<7 | 14 | 30>(7)
    const [patientName, setPatientName] = useState('')

    const loadData = useCallback(async () => {
        if (!user) return
        setLoading(true)

        let pId = searchParams.get('patientId')
        if (!pId) {
            const { data: patient } = await supabase
                .from('patients').select('id, name').eq('user_id', user.id).maybeSingle()
            if (!patient) { setLoading(false); return }
            pId = patient.id
            setPatientName(patient.name ?? '')
        } else {
            const { data: pat } = await supabase.from('patients').select('name').eq('id', pId).maybeSingle()
            setPatientName(pat?.name ?? '')
        }
        setPatientId(pId)

        // Today's schedules (for timeline)
        const today = new Date()
        const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
        const endToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

        const { data: todaySched } = await supabase
            .from('medication_schedules')
            .select('id, scheduled_time, status, medication:medications!medication_id(name, dosage, unit)')
            .eq('patient_id', pId)
            .gte('scheduled_time', startToday)
            .lt('scheduled_time', endToday)
            .order('scheduled_time', { ascending: true })
        setTodaySchedules((todaySched as unknown as ScheduleItem[]) ?? [])

        // Historical stats
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - period)
        const { data } = await supabase
            .from('medication_schedules')
            .select('scheduled_time, status')
            .eq('patient_id', pId)
            .gte('scheduled_time', startDate.toISOString())
            .order('scheduled_time', { ascending: true })

        const grouped: Record<string, DayStats> = {}
        for (const item of data ?? []) {
            const date = new Date(item.scheduled_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            if (!grouped[date]) grouped[date] = { date, total: 0, taken: 0, missed: 0, skipped: 0 }
            grouped[date].total++
            if (item.status === 'taken') grouped[date].taken++
            else if (item.status === 'missed') grouped[date].missed++
            else if (item.status === 'skipped') grouped[date].skipped++
        }
        setStats(Object.values(grouped))
        setLoading(false)
    }, [user, period, searchParams])

    useEffect(() => { loadData() }, [loadData])

    const overallTaken = stats.reduce((s, d) => s + d.taken, 0)
    const overallTotal = stats.reduce((s, d) => s + d.total, 0)
    const overallRate = overallTotal > 0 ? Math.round((overallTaken / overallTotal) * 100) : 0

    const circleR = 52
    const circumference = 2 * Math.PI * circleR
    const dashoffset = circumference - (overallRate / 100) * circumference

    const rateColor = overallRate >= 80 ? '#7c3aed' : overallRate >= 50 ? '#f59e0b' : '#ef4444'
    const todayDate = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })

    function formatTime(iso: string) {
        return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="min-h-screen bg-[#f7f8fc] pb-28" style={{ fontFamily: 'Lexend, sans-serif' }}>

            {/* Header */}
            <div className="bg-white px-5 pt-12 pb-4 shadow-sm flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-extrabold text-gray-900">Relatório Diário</h1>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">Hoje, {todayDate}</p>
                </div>
            </div>

            <div className="px-4 pt-4 flex flex-col gap-4">

                {/* Circular progress card */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 text-center">
                    <div className="relative w-36 h-36 mx-auto mb-4">
                        <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r={circleR} fill="none" stroke="#e5e7eb" strokeWidth="10" />
                            <circle
                                cx="60" cy="60" r={circleR} fill="none"
                                stroke={rateColor}
                                strokeWidth="10"
                                strokeDasharray={circumference}
                                strokeDashoffset={dashoffset}
                                strokeLinecap="round"
                                className="transition-all duration-700"
                            />
                        </svg>
                        {overallRate === 100 && (
                            <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#4ade80] flex items-center justify-center">
                                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black text-gray-900">{overallRate}%</span>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">concluído</span>
                        </div>
                    </div>
                    <p className="font-extrabold text-gray-900 text-base">
                        {overallRate >= 80 ? 'Ótimo trabalho' : overallRate >= 50 ? 'Continue assim' : 'Pode melhorar'}{patientName ? `, ${patientName.split(' ')[0]}!` : '!'}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                        Você tomou {overallTaken} de {overallTotal} doses
                        nos últimos {period} dias.
                    </p>

                    {/* Share buttons */}
                    <div className="flex gap-2 mt-4">
                        <button className="flex-1 flex items-center justify-center gap-2 bg-[#25d366] text-white text-sm font-bold py-3 rounded-2xl hover:bg-[#1ebe5c] transition-colors">
                            <svg width={16} height={16} viewBox="0 0 24 24" fill="white">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                            Compartilhar WhatsApp
                        </button>
                        <button className="flex-1 flex items-center justify-center gap-2 bg-[#7c3aed] text-white text-sm font-bold py-3 rounded-2xl hover:bg-[#6d28d9] transition-colors">
                            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                            </svg>
                            Enviar por E-mail
                        </button>
                    </div>
                </div>

                {/* Period selector */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-1.5 flex gap-1">
                    {([7, 14, 30] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all
                                ${period === p ? 'bg-[#7c3aed] text-white shadow-md shadow-violet-100' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            {p} dias
                        </button>
                    ))}
                </div>

                {/* Linha do Tempo de Hoje */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 pt-5 pb-3">
                        <h2 className="font-extrabold text-gray-900">Linha do Tempo de Hoje</h2>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-10">
                            <span className="w-8 h-8 border-4 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
                        </div>
                    ) : todaySchedules.length === 0 ? (
                        <div className="text-center pb-8 px-5">
                            <p className="text-gray-400 text-sm">Nenhuma dose registrada hoje</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {todaySchedules.map((s) => {
                                const isTaken = s.status === 'taken'
                                const isMissed = s.status === 'missed'
                                return (
                                    <div key={s.id} className="flex items-center gap-4 px-5 py-4">
                                        {/* Time + left accent bar */}
                                        <div className={`w-1 h-12 rounded-full flex-shrink-0 ${isTaken ? 'bg-[#4ade80]' : isMissed ? 'bg-[#f87171]' : 'bg-gray-200'}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-bold text-gray-400 mb-0.5">{formatTime(s.scheduled_time)}</p>
                                                    <p className="font-extrabold text-gray-900 text-sm">{s.medication.name}</p>
                                                </div>
                                                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1
                                                    ${isTaken ? 'bg-emerald-50 text-emerald-600' : ''}
                                                    ${isMissed ? 'bg-red-50 text-red-600' : ''}
                                                    ${s.status === 'pending' ? 'bg-amber-50 text-amber-600' : ''}
                                                    ${s.status === 'skipped' ? 'bg-gray-50 text-gray-400' : ''}
                                                `}>
                                                    {isTaken && <><IconCheckCircle size={10} color="#16a34a" /> Tomado</>}
                                                    {isMissed && <>⚠ Perdido</>}
                                                    {s.status === 'pending' && 'Pendente'}
                                                    {s.status === 'skipped' && 'Pulado'}
                                                </span>
                                            </div>
                                            {/* Medication dots */}
                                            <div className="flex items-center gap-1 mt-1.5">
                                                <span className={`w-2 h-2 rounded-full ${isTaken ? 'bg-[#4ade80]' : isMissed ? 'bg-[#f87171]' : 'bg-gray-200'}`} />
                                                <p className="text-[11px] text-gray-400">
                                                    {s.medication.dosage} {s.medication.unit}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Historical breakdown */}
                {stats.length > 0 && (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-5 pt-5 pb-3">
                            <h2 className="font-extrabold text-gray-900">Histórico por Dia</h2>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {stats.slice(-10).reverse().map(day => {
                                const rate = day.total > 0 ? Math.round((day.taken / day.total) * 100) : 0
                                return (
                                    <div key={day.date} className="px-5 py-3 flex items-center gap-3">
                                        <p className="text-xs font-bold text-gray-400 w-12 flex-shrink-0">{day.date}</p>
                                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${rate >= 80 ? 'bg-[#4ade80]' : rate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                                style={{ width: `${rate}%` }}
                                            />
                                        </div>
                                        <span className={`text-xs font-bold w-8 text-right ${rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                            {rate}%
                                        </span>
                                        <div className="flex gap-2 text-[10px] text-gray-400">
                                            <span className="flex items-center gap-0.5"><IconCheckCircle size={10} color="#4ade80" /> {day.taken}</span>
                                            <span className="flex items-center gap-0.5"><IconXCircle size={10} color="#f87171" /> {day.missed}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                {profile?.role === 'caregiver' ? (
                    <>
                        <Link href="/caregiver/home" className="bottom-nav-item"><IconHome size={22} /><span>Pacientes</span></Link>
                        <Link href={`/patient/reports?patientId=${patientId}`} className="bottom-nav-item active"><IconBarChart size={22} color="#42b6f0" /><span>Relatório</span></Link>
                    </>
                ) : (
                    <>
                        <Link href="/patient/home" className="bottom-nav-item"><IconHome size={22} /><span>Início</span></Link>
                        <Link href="/patient/medications" className="bottom-nav-item"><IconPill size={22} /><span>Remédios</span></Link>
                        <Link href="/patient/routine" className="bottom-nav-item"><IconRoutine size={22} /><span>Rotina</span></Link>
                        <Link href="/patient/reports" className="bottom-nav-item active"><IconBarChart size={22} color="#42b6f0" /><span>Relatórios</span></Link>
                    </>
                )}
            </nav>
        </div>
    )
}

export default function ReportsPage() {
    return (
        <Suspense>
            <ReportsContent />
        </Suspense>
    )
}

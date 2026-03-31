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

interface RoutineData {
    water: number;
    walk: number;
    food: 'vermelho' | 'amarelo' | 'verde' | null;
}

interface DayStats {
    date: string;
    total: number;
    taken: number;
    missed: number;
    skipped: number;
    routine?: RoutineData;
}

const CupIcon = () => (
    <svg width={14} height={14} viewBox="0 0 24 24" stroke="#42b6f0" fill="#bae6fd" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.2 22H8.8a2 2 0 0 1-2-1.79L5 3h14l-1.81 17.21A2 2 0 0 1 15.2 22Z" />
        <path d="M6 12h12" />
    </svg>
)

const WalkIcon = () => (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="4" r="1.5" /><path d="M9 20l2-7-3-3 4-5 4 5-3 3 2 7" /></svg>
)

const FoodIcon = ({ color }: { color: string }) => (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M3 2h1l1.5 7M7 15h12l-1.68-8.39A2 2 0 0 0 15.36 5H8.64a2 2 0 0 0-1.97 1.67L5.5 9M16 17a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM9 17a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" /></svg>
)

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
        const startDateIso = startDate.toISOString()
        const startDateOnly = startDateIso.split('T')[0]

        // Load Meds
        const { data: medData } = await supabase
            .from('medication_schedules')
            .select('scheduled_time, status')
            .eq('patient_id', pId)
            .gte('scheduled_time', startDateIso)
            .order('scheduled_time', { ascending: true })

        // Load Routines
        const { data: routeData } = await supabase
            .from('daily_routines')
            .select('date, water_glasses, food_notes')
            .eq('patient_id', pId)
            .gte('date', startDateOnly)

        const grouped: Record<string, DayStats> = {}

        for (const item of medData ?? []) {
            const d = new Date(item.scheduled_time)
            const dateKey = d.toISOString().split('T')[0]
            const dateLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            if (!grouped[dateKey]) grouped[dateKey] = { date: dateLabel, total: 0, taken: 0, missed: 0, skipped: 0 }
            grouped[dateKey].total++
            if (item.status === 'taken') grouped[dateKey].taken++
            else if (item.status === 'missed') grouped[dateKey].missed++
            else if (item.status === 'skipped') grouped[dateKey].skipped++
        }

        for (const r of routeData ?? []) {
            const dateKey = r.date // YYYY-MM-DD
            // If there's no medications that day, create an entry
            if (!grouped[dateKey]) {
                const parts = dateKey.split('-')
                grouped[dateKey] = { date: `${parts[2]}/${parts[1]}`, total: 0, taken: 0, missed: 0, skipped: 0 }
            }

            let routineObj: RoutineData = { water: r.water_glasses ?? 0, walk: 0, food: null }
            if (r.food_notes) {
                try {
                    if (r.food_notes.startsWith('{')) {
                        const parsed = JSON.parse(r.food_notes)
                        routineObj.walk = parsed.walkDuration ?? 0
                        routineObj.food = parsed.food ?? null
                    } else {
                        routineObj.walk = r.food_notes.includes('walked') ? 15 : 0
                        routineObj.food = r.food_notes.includes('ate_well') ? 'verde' : null
                    }
                } catch (e) { }
            }
            grouped[dateKey].routine = routineObj
        }

        // Sort keys (dateKey is YYYY-MM-DD)
        const sortedKeys = Object.keys(grouped).sort()
        const sortedStatsArr = sortedKeys.map(k => grouped[k])

        setStats(sortedStatsArr)
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

    const generateReportText = () => {
        const lines: string[] = []
        lines.push(`*Relatorio de Bem-Estar - ${patientName || 'Paciente'}*`)
        lines.push(`Periodo: Ultimos ${period} dias`)
        lines.push(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`)
        lines.push('')

        // Medication adherence
        lines.push(`*Adesao de Medicamentos: ${overallRate}%*`)
        lines.push(`- Tomados: ${overallTaken}`)
        lines.push(`- Perdidos: ${stats.reduce((s, d) => s + d.missed, 0)}`)
        lines.push(`- Pulados: ${stats.reduce((s, d) => s + d.skipped, 0)}`)
        lines.push(`- Total de doses: ${overallTotal}`)
        lines.push('')

        // Routine averages
        const daysWithRoutine = stats.filter(d => d.routine)
        if (daysWithRoutine.length > 0) {
            const avgWater = Math.round(daysWithRoutine.reduce((s, d) => s + (d.routine?.water ?? 0), 0) / daysWithRoutine.length)
            const totalWalk = daysWithRoutine.filter(d => (d.routine?.walk ?? 0) > 0).length
            const foodCounts = { verde: 0, amarelo: 0, vermelho: 0 }
            daysWithRoutine.forEach(d => {
                if (d.routine?.food) foodCounts[d.routine.food]++
            })

            lines.push(`*Rotina Diaria (media de ${daysWithRoutine.length} dias)*`)
            lines.push(`- Agua: ${avgWater} copos/dia`)
            lines.push(`- Caminhadas: ${totalWalk} de ${daysWithRoutine.length} dias`)
            if (foodCounts.verde + foodCounts.amarelo + foodCounts.vermelho > 0) {
                lines.push(`- Alimentacao: Boa(${foodCounts.verde}) Regular(${foodCounts.amarelo}) Ruim(${foodCounts.vermelho})`)
            }
            lines.push('')
        }

        // Today's doses
        if (todaySchedules.length > 0) {
            lines.push(`*Doses de Hoje*`)
            todaySchedules.forEach(s => {
                const time = formatTime(s.scheduled_time)
                const status = s.status === 'taken' ? 'Tomado' : s.status === 'missed' ? 'Perdido' : s.status === 'skipped' ? 'Pulado' : 'Pendente'
                lines.push(`- ${time} ${s.medication.name} (${s.medication.dosage} ${s.medication.unit}) - ${status}`)
            })
            lines.push('')
        }

        lines.push('Enviado pelo App Care Close')
        return lines.join('\n')
    }

    const shareWhatsApp = () => {
        const text = encodeURIComponent(generateReportText());
        window.open(`https://wa.me/?text=${text}`, '_blank');
    }

    const shareEmail = () => {
        const text = encodeURIComponent(generateReportText());
        window.open(`mailto:?subject=Relatório de Cuidados - ${patientName}&body=${text}`, '_blank');
    }

    return (
        <div className="min-h-screen bg-[#f7f8fc] pb-28" style={{ fontFamily: 'Lexend, sans-serif' }}>

            {/* Header */}
            <div className="bg-white px-5 pt-12 pb-4 shadow-sm flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-extrabold text-gray-900">Relatório Diário</h1>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">Visão Geral, {todayDate}</p>
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
                            <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#4ade80] flex items-center justify-center shadow-sm">
                                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black text-gray-900">{overallRate}%</span>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">adesão</span>
                        </div>
                    </div>
                    <p className="font-extrabold text-gray-900 text-lg">
                        {overallRate >= 80 ? 'Ótimo trabalho' : overallRate >= 50 ? 'Pode melhorar' : 'Atenção'}{patientName ? `, ${patientName.split(' ')[0]}!` : '!'}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                        Doses tomadas: {overallTaken} de {overallTotal} nos últimos {period} dias.
                    </p>

                    {/* Share buttons using Grid for equal sizing and no overflowing text */}
                    <div className="grid grid-cols-2 gap-3 mt-6">
                        <button onClick={shareWhatsApp} className="flex flex-col items-center justify-center gap-1.5 bg-[#25d366] text-white py-3 rounded-xl hover:bg-[#1ebe5c] transition-colors active:scale-95 shadow-sm">
                            <svg width={22} height={22} viewBox="0 0 24 24" fill="white">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                            <span className="text-[11px] font-bold">WhatsApp</span>
                        </button>
                        <button onClick={shareEmail} className="flex flex-col items-center justify-center gap-1.5 bg-[#7c3aed] text-white py-3 rounded-xl hover:bg-[#6d28d9] transition-colors active:scale-95 shadow-sm">
                            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                            </svg>
                            <span className="text-[11px] font-bold">E-mail</span>
                        </button>
                    </div>
                </div>

                {/* Period selector */}
                <div data-onboarding="reports-period" className="bg-white rounded-3xl shadow-sm border border-gray-100 p-1.5 flex gap-1 relative z-10">
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

                {/* Historical breakdown (Moved UP) */}
                {stats.length > 0 && (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-5 pt-5 pb-3">
                            <h2 className="font-extrabold text-gray-900 text-lg">Histórico por Dia</h2>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {stats.slice(-10).reverse().map(day => {
                                const rate = day.total > 0 ? Math.round((day.taken / day.total) * 100) : 0
                                const r = day.routine
                                return (
                                    <div key={day.date} className="px-5 py-3.5 flex flex-col gap-2">
                                        <div className="flex items-center gap-3">
                                            <p className="text-xs font-bold text-gray-400 w-12 flex-shrink-0">{day.date}</p>
                                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${rate >= 80 ? 'bg-[#4ade80]' : rate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                                    style={{ width: `${day.total === 0 ? 0 : rate}%` }}
                                                />
                                            </div>
                                            <span className={`text-xs font-bold w-10 text-right ${day.total === 0 ? 'text-gray-300' : rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                {day.total === 0 ? '--' : rate + '%'}
                                            </span>
                                            <div className="flex gap-2 text-[10px] text-gray-400 w-14 justify-end">
                                                <span className="flex items-center gap-0.5"><IconCheckCircle size={10} color={day.taken > 0 ? "#4ade80" : "#d1d5db"} /> {day.taken}</span>
                                                <span className="flex items-center gap-0.5"><IconXCircle size={10} color={day.missed > 0 ? "#f87171" : "#d1d5db"} /> {day.missed}</span>
                                            </div>
                                        </div>
                                        {/* Routine Summary Icons */}
                                        {r && (r.water > 0 || r.walk > 0 || r.food) && (
                                            <div className="flex items-center gap-4 pl-[60px]">
                                                {r.water > 0 && (
                                                    <div className="flex items-center gap-1.5 bg-sky-50 px-2 py-0.5 rounded-md">
                                                        <CupIcon /> <span className="text-[10px] font-bold text-sky-600">{r.water}</span>
                                                    </div>
                                                )}
                                                {r.walk > 0 && (
                                                    <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-md">
                                                        <WalkIcon /> <span className="text-[10px] font-bold text-emerald-600">{r.walk}m</span>
                                                    </div>
                                                )}
                                                {r.food && (
                                                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${r.food === 'verde' ? 'bg-green-50' : r.food === 'amarelo' ? 'bg-amber-50' : 'bg-red-50'}`}>
                                                        <FoodIcon color={r.food === 'verde' ? '#22c55e' : r.food === 'amarelo' ? '#f59e0b' : '#ef4444'} />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Linha do Tempo de Hoje (Moved DOWN) */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-4">
                    <div className="px-5 pt-5 pb-3">
                        <h2 className="font-extrabold text-gray-900 text-lg">Doses de Hoje</h2>
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

'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { generateAllSchedulesForPatient } from '@/lib/schedule-generator'
import {
    IconHome, IconCalendar, IconBell, IconSettings,
    IconClock, IconCheckCircle, IconPill, IconSkip,
    IconCamera, IconX, IconInfo
} from '@/components/Icons'

interface MedSchedule {
    id: string
    scheduled_time: string
    status: 'pending' | 'taken' | 'missed' | 'skipped'
    taken_at: string | null
    proof_url: string | null
    patient_id: string
    patient_name?: string
    medication: {
        id: string
        name: string
        dosage: string
        unit: string
        instructions: string | null
        stock_quantity: number
        stock_alert_at: number
    }
}

export default function CaregiverSchedulePage() {
    const { user, loading: authLoading } = useAuth()

    const [schedules, setSchedules] = useState<MedSchedule[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState<MedSchedule | null>(null)
    const [showProofUrl, setShowProofUrl] = useState<string | null>(null)
    const [confirmingDose, setConfirmingDose] = useState(false)
    const [proofFile, setProofFile] = useState<File | null>(null)
    const [uploadProgress, setUploadProgress] = useState(0)

    const loadData = useCallback(async () => {
        if (!user) return
        const { data: patientsData } = await supabase
            .from('patients')
            .select('id, name')
            .eq('user_id', user.id)

        if (!patientsData || patientsData.length === 0) {
            setSchedules([])
            setLoading(false)
            return
        }

        const patientMap: Record<string, string> = {}
        const patientIds: string[] = []
        for (const p of patientsData) {
            patientMap[p.id] = p.name
            patientIds.push(p.id)
            await generateAllSchedulesForPatient(p.id)
        }

        const today = new Date()
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

        const { data: sData } = await supabase
            .from('medication_schedules')
            .select(`
                id, scheduled_time, status, taken_at, proof_url, patient_id,
                medication:medications!medication_id (id, name, dosage, unit, instructions, stock_quantity, stock_alert_at)
            `)
            .in('patient_id', patientIds)
            .gte('scheduled_time', startOfDay)
            .lt('scheduled_time', endOfDay)
            .order('scheduled_time', { ascending: true })

        const enriched = (sData as unknown as MedSchedule[])?.map(s => ({
            ...s,
            patient_name: patientMap[s.patient_id] || 'Desconhecido'
        })) ?? []

        setSchedules(enriched)
        setLoading(false)
    }, [user])

    useEffect(() => {
        if (!authLoading && user) loadData()
        else if (!authLoading) setLoading(false)
    }, [authLoading, user, loadData])

    async function confirmDose(schedule: MedSchedule) {
        setConfirmingDose(true)
        setUploadProgress(10)
        let uploadedUrl: string | null = null

        if (proofFile) {
            setUploadProgress(30)
            const fileExt = proofFile.name.split('.').pop()
            const fileName = `${schedule.id}-${Date.now()}.${fileExt}`
            const filePath = `${schedule.patient_id}/${fileName}`
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('proofs').upload(filePath, proofFile, { upsert: true })
            setUploadProgress(70)
            if (!uploadError && uploadData) {
                const { data: pub } = supabase.storage.from('proofs').getPublicUrl(filePath)
                uploadedUrl = pub.publicUrl
            }
        }
        setUploadProgress(80)
        await supabase.from('medication_schedules').update({
            status: 'taken', taken_at: new Date().toISOString(),
            taken_by: user!.id, proof_url: uploadedUrl,
        }).eq('id', schedule.id)
        if (schedule.medication.stock_quantity > 0) {
            await supabase.from('medications')
                .update({ stock_quantity: schedule.medication.stock_quantity - 1 })
                .eq('id', schedule.medication.id)
        }
        setUploadProgress(100)
        setTimeout(() => {
            setShowModal(null); setConfirmingDose(false);
            setProofFile(null); setUploadProgress(0);
            loadData()
        }, 400)
    }

    function formatTime(iso: string) {
        return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }

    const takenCount = schedules.filter(s => s.status === 'taken').length
    const totalCount = schedules.length
    const pendingCount = schedules.filter(s => s.status === 'pending').length
    const progress = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0

    // Group by time
    const grouped: Record<string, MedSchedule[]> = {}
    for (const s of schedules) {
        const t = formatTime(s.scheduled_time)
        if (!grouped[t]) grouped[t] = []
        grouped[t].push(s)
    }
    const sortedTimes = Object.keys(grouped).sort()

    const today = new Date()
    const dateLabel = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <span className="w-10 h-10 border-4 border-[#f87b7b] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#f7f8fc] pb-28" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {/* Header */}
            <div className="bg-white px-5 pt-12 pb-5 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                    <div>
                        <p className="text-xs font-medium text-gray-400 capitalize">{dateLabel}</p>
                        <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">Agenda do Dia</h1>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#f0f8ff] flex items-center justify-center shadow-sm">
                        <IconCalendar size={22} color="#42b6f0" />
                    </div>
                </div>
            </div>

            <div className="px-4 pt-4 flex flex-col gap-5">
                {/* Progress Summary Card */}
                <div data-onboarding="caregiver-schedule-progress" className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Aderência hoje</p>
                            <p className="text-3xl font-black text-gray-900">{progress}<span className="text-lg font-bold text-gray-400">%</span></p>
                        </div>
                        <div className="flex gap-3">
                            <div className="text-center bg-[#f0fdf4] rounded-2xl px-4 py-2.5">
                                <p className="text-xl font-black text-emerald-600">{takenCount}</p>
                                <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">Tomados</p>
                            </div>
                            <div className="text-center bg-[#fef3f3] rounded-2xl px-4 py-2.5">
                                <p className="text-xl font-black text-[#f87171]">{pendingCount}</p>
                                <p className="text-[10px] font-semibold text-[#f87171] uppercase tracking-wide">Pendentes</p>
                            </div>
                        </div>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                                width: `${progress}%`,
                                background: progress >= 80 ? '#10b981' : progress >= 50 ? '#f59e0b' : '#f87171'
                            }}
                        />
                    </div>
                </div>

                {/* Schedule */}
                {totalCount === 0 ? (
                    <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-gray-100">
                        <div className="w-16 h-16 bg-[#fef3f3] rounded-full flex items-center justify-center mx-auto mb-3">
                            <span className="text-3xl">🌿</span>
                        </div>
                        <h2 className="text-lg font-extrabold text-gray-800 mb-1">Agenda limpa!</h2>
                        <p className="text-gray-400 text-sm">Nenhum medicamento agendado para hoje.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {sortedTimes.map((time) => (
                            <div key={time} className="mb-1">
                                {/* Time label */}
                                <div className="flex items-center gap-2 py-2 px-1">
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#f87171]/10 text-[#f87171] text-xs font-bold">
                                        <IconClock size={12} color="#f87171" /> {time}
                                    </span>
                                    <div className="flex-1 h-px bg-gray-100" />
                                </div>

                                {/* Schedule items */}
                                <div className="flex flex-col gap-2">
                                    {grouped[time].map((schedule) => {
                                        const isPending = schedule.status === 'pending'
                                        const isTaken = schedule.status === 'taken'
                                        const hasProof = !!schedule.proof_url

                                        return (
                                            <button
                                                key={schedule.id}
                                                onClick={() => {
                                                    if (isPending) setShowModal(schedule)
                                                    else if (hasProof) setShowProofUrl(schedule.proof_url)
                                                }}
                                                className={`bg-white rounded-2xl px-4 py-3.5 w-full text-left flex items-center gap-4 border transition-all
                                                    ${isPending
                                                        ? 'border-[#f87171]/30 shadow-sm active:scale-[0.99] cursor-pointer'
                                                        : hasProof
                                                            ? 'border-violet-100 shadow-sm cursor-pointer'
                                                            : 'border-gray-100 opacity-75 cursor-default'
                                                    }`}
                                            >
                                                {/* Icon */}
                                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                                                    ${isTaken ? 'bg-[#f0fdf4]' : isPending ? 'bg-[#fef3f3]' : 'bg-gray-50'}`}>
                                                    {isTaken
                                                        ? <IconCheckCircle size={20} color="#4ade80" />
                                                        : isPending
                                                            ? <IconPill size={20} color="#f87171" />
                                                            : <IconSkip size={20} color="#94a3b8" />}
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-bold text-sm leading-tight truncate ${isTaken ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                                        {schedule.medication.name}
                                                    </p>
                                                    <p className="text-xs text-gray-400 font-medium mt-0.5 flex items-center gap-1">
                                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#42b6f0]" />
                                                        {schedule.patient_name}
                                                        <span className="text-gray-200 mx-0.5">·</span>
                                                        {schedule.medication.dosage} {schedule.medication.unit}
                                                    </p>
                                                    {hasProof && (
                                                        <p className="text-[10px] text-violet-500 font-semibold mt-1 flex items-center gap-1">
                                                            <IconCamera size={10} color="#8b5cf6" /> Ver comprovante
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Right badge */}
                                                {isPending ? (
                                                    <span className="flex-shrink-0 bg-[#f87171] text-white text-[10px] font-extrabold uppercase px-3 py-1.5 rounded-full shadow-sm">
                                                        Registrar
                                                    </span>
                                                ) : isTaken ? (
                                                    <span className="flex-shrink-0 bg-[#f0fdf4] text-emerald-600 text-[10px] font-extrabold uppercase px-3 py-1.5 rounded-full">
                                                        Tomado
                                                    </span>
                                                ) : (
                                                    <span className="flex-shrink-0 bg-gray-100 text-gray-400 text-[10px] font-semibold uppercase px-3 py-1.5 rounded-full">
                                                        Pulado
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* === PROOF VIEWER === */}
            {showProofUrl && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowProofUrl(null)}>
                    <div onClick={e => e.stopPropagation()} className="relative w-full max-w-sm bg-white rounded-3xl overflow-hidden flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                            <h3 className="font-extrabold text-gray-800 text-sm">Comprovante de Dose</h3>
                            <button onClick={() => setShowProofUrl(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200">
                                <IconX size={14} color="#6b7280" />
                            </button>
                        </div>
                        <div className="bg-black w-full aspect-[3/4] flex items-center justify-center">
                            {showProofUrl.match(/\.(mp4|webm|ogg)$/i)
                                ? <video src={showProofUrl} controls autoPlay className="max-w-full max-h-full" />
                                : <img src={showProofUrl} alt="Comprovante" className="max-w-full max-h-full object-contain" />
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* === DOSE REGISTRATION MODAL === */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center backdrop-blur-sm" onClick={() => !confirmingDose && setShowModal(null)}>
                    <div
                        className="bg-white w-full max-w-md rounded-t-[2rem] p-6 pb-10 flex flex-col max-h-[88vh] shadow-2xl"
                        onClick={e => e.stopPropagation()}
                        style={{ fontFamily: 'Lexend, sans-serif' }}
                    >
                        {/* Handle drag indicator */}
                        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

                        {/* Medication info */}
                        <div className="text-center mb-5 flex-shrink-0">
                            <div className="inline-flex items-center gap-1.5 bg-[#f0f8ff] px-3 py-1 rounded-full mb-3">
                                <span className="w-2 h-2 rounded-full bg-[#42b6f0] inline-block" />
                                <span className="text-[#42b6f0] font-extrabold text-xs">{showModal.patient_name}</span>
                            </div>
                            <h3 className="text-xl font-extrabold text-gray-900 mb-1 leading-tight">{showModal.medication.name}</h3>
                            <p className="text-gray-400 text-sm font-medium">
                                {showModal.medication.dosage} {showModal.medication.unit}
                                <span className="mx-1.5 text-gray-200">·</span>
                                <span className="text-[#f87171] font-bold">{formatTime(showModal.scheduled_time)}</span>
                            </p>
                            {showModal.medication.instructions && (
                                <p className="text-sm text-gray-600 bg-gray-50 rounded-2xl px-4 py-3 mt-4 border border-gray-100 text-left">
                                    <span className="font-bold text-gray-700 flex items-center gap-1 mb-1">
                                        <IconInfo size={14} color="#64748b" /> Instruções:
                                    </span>
                                    {showModal.medication.instructions}
                                </p>
                            )}
                        </div>

                        {/* Photo upload */}
                        <div className="mb-5 flex-1 overflow-y-auto">
                            <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                                <IconCamera size={16} color="#374151" /> Comprovante <span className="font-medium text-gray-400">(Opcional)</span>
                            </p>
                            <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-2xl cursor-pointer transition-all
                                ${proofFile ? 'border-[#f87171] bg-[#fef3f3]' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}>
                                <div className="flex flex-col items-center justify-center py-5">
                                    {proofFile ? (
                                        <>
                                            <IconCamera size={28} color="#f87171" />
                                            <p className="text-xs font-bold text-[#f87171] px-4 text-center truncate w-full mt-1">{proofFile.name}</p>
                                        </>
                                    ) : (
                                        <>
                                            <IconCamera size={28} color="#94a3b8" />
                                            <p className="text-sm font-semibold text-gray-500 mt-1">Tirar Foto ou Gravar Vídeo</p>
                                            <p className="text-xs text-gray-400">Toque aqui para capturar</p>
                                        </>
                                    )}
                                </div>
                                <input type="file" className="hidden" accept="image/*,video/*" capture="environment"
                                    onChange={(e) => { if (e.target.files?.[0]) setProofFile(e.target.files[0]) }} />
                            </label>
                        </div>

                        {/* Progress bar */}
                        {confirmingDose && uploadProgress > 0 && (
                            <div className="w-full mb-4">
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-[#f87171] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                </div>
                                <p className="text-xs text-center text-gray-400 mt-1.5 font-medium">Salvando...</p>
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="mt-auto flex-shrink-0 flex flex-col gap-2">
                            <button
                                onClick={() => confirmDose(showModal)}
                                disabled={confirmingDose}
                                className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-200 disabled:opacity-60"
                            >
                                {confirmingDose
                                    ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    : <><IconCheckCircle size={18} color="white" /> Confirmar Ingestão</>}
                            </button>
                            <button onClick={() => setShowModal(null)} disabled={confirmingDose}
                                className="w-full py-3.5 rounded-2xl border-2 border-gray-100 text-sm font-bold text-gray-400 hover:bg-gray-50 transition-colors">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                <Link href="/caregiver/home" className="bottom-nav-item">
                    <IconHome size={22} />
                    <span>Pacientes</span>
                </Link>
                <Link href="/caregiver/schedule" className="bottom-nav-item active">
                    <IconCalendar size={22} color="#42b6f0" />
                    <span>Agenda</span>
                </Link>
                <Link href="/caregiver/alerts" className="bottom-nav-item">
                    <IconBell size={22} />
                    <span>Avisos</span>
                </Link>
                <Link href="/caregiver/settings" className="bottom-nav-item">
                    <IconSettings size={22} />
                    <span>Config</span>
                </Link>
            </nav>
        </div>
    )
}

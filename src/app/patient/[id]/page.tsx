'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { generateAllSchedulesForPatient } from '@/lib/schedule-generator'

interface MedSchedule {
    id: string
    scheduled_time: string
    status: 'pending' | 'taken' | 'missed' | 'skipped'
    taken_at: string | null
    proof_url: string | null
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

interface Patient {
    id: string
    name: string
    birth_date: string | null
    medical_notes: string | null
}

const statusConfig = {
    pending: { label: 'Pendente', badge: 'bg-amber-50 text-amber-600 border-amber-200', icon: '⏳' },
    taken: { label: 'Tomado', badge: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: '✅' },
    missed: { label: 'Perdido', badge: 'bg-red-50 text-red-600 border-red-200', icon: '❌' },
    skipped: { label: 'Pulado', badge: 'bg-gray-50 text-gray-500 border-gray-200', icon: '⏭️' },
}

export default function CaregiverPatientPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params)
    const patientId = resolvedParams.id
    const router = useRouter()
    const { user, loading: authLoading } = useAuth()

    const [patient, setPatient] = useState<Patient | null>(null)
    const [schedules, setSchedules] = useState<MedSchedule[]>([])
    const [loading, setLoading] = useState(true)

    // Modal state
    const [showModal, setShowModal] = useState<MedSchedule | null>(null)
    const [showProofUrl, setShowProofUrl] = useState<string | null>(null)
    const [confirmingDose, setConfirmingDose] = useState(false)
    const [proofFile, setProofFile] = useState<File | null>(null)
    const [uploadProgress, setUploadProgress] = useState(0)

    const loadData = useCallback(async () => {
        if (!user || !patientId) return

        // Get patient details
        const { data: pData } = await supabase
            .from('patients')
            .select('*')
            .eq('id', patientId)
            .single()

        if (pData) setPatient(pData)

        // Ensure schedules are generated
        await generateAllSchedulesForPatient(patientId)

        // Get schedules
        const today = new Date()
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

        // Check if proof_url exists in the query result. If not, the table hasn't been updated yet,
        // so we just query without it but gracefully handle errors if the column is missing in the DB.
        // We will assume `proof_url` is added via the SQL script provided to the user.
        const { data: sData } = await supabase
            .from('medication_schedules')
            .select(`
                id, scheduled_time, status, taken_at, proof_url,
                medication:medications!medication_id (id, name, dosage, unit, instructions, stock_quantity, stock_alert_at)
            `)
            .eq('patient_id', patientId)
            .gte('scheduled_time', startOfDay)
            .lt('scheduled_time', endOfDay)
            .order('scheduled_time', { ascending: true })

        setSchedules((sData as unknown as MedSchedule[]) ?? [])
        setLoading(false)
    }, [user, patientId])

    useEffect(() => {
        if (!authLoading && user) loadData()
        else if (!authLoading) setLoading(false)
    }, [authLoading, user, loadData])

    async function confirmDose(schedule: MedSchedule) {
        setConfirmingDose(true)
        setUploadProgress(10)

        let uploadedUrl: string | null = null

        // 1. Upload proof file if provided
        if (proofFile) {
            setUploadProgress(30)
            const fileExt = proofFile.name.split('.').pop()
            const fileName = `${schedule.id}-${Date.now()}.${fileExt}`
            const filePath = `${patientId}/${fileName}`

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('proofs')
                .upload(filePath, proofFile, { upsert: true })

            setUploadProgress(70)

            if (!uploadError && uploadData) {
                const { data: publicUrlData } = supabase.storage
                    .from('proofs')
                    .getPublicUrl(filePath)
                uploadedUrl = publicUrlData.publicUrl
            } else {
                console.error('Failed to upload proof:', uploadError)
                alert('Erro ao enviar a foto/vídeo. A dose será confirmada sem o anexo.')
            }
        }

        setUploadProgress(80)

        // 2. Mark schedule as taken
        await supabase
            .from('medication_schedules')
            .update({
                status: 'taken',
                taken_at: new Date().toISOString(),
                taken_by: user!.id,
                proof_url: uploadedUrl,
            })
            .eq('id', schedule.id)

        // 3. Decrement stock
        if (schedule.medication.stock_quantity > 0) {
            await supabase
                .from('medications')
                .update({ stock_quantity: schedule.medication.stock_quantity - 1 })
                .eq('id', schedule.medication.id)
        }

        setUploadProgress(100)

        setTimeout(() => {
            setShowModal(null)
            setConfirmingDose(false)
            setProofFile(null)
            setUploadProgress(0)
            loadData()
        }, 500)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <span className="w-10 h-10 border-4 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
            </div>
        )
    }

    if (!patient) {
        return (
            <div className="page-container flex items-center justify-center min-h-screen">
                <p className="text-gray-500">Paciente não encontrado.</p>
            </div>
        )
    }

    const takenCount = schedules.filter(s => s.status === 'taken').length
    const totalCount = schedules.length
    const progress = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0

    function formatTime(iso: string) {
        return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="pb-24">
            {/* Header */}
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 px-6 pt-10 pb-16 text-white relative overflow-hidden">
                <button onClick={() => router.back()} className="text-violet-200 flex items-center gap-1 text-sm mb-4 w-fit hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Voltar
                </button>

                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-2xl font-bold flex-shrink-0">
                        {patient.name[0]?.toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">{patient.name}</h1>
                        <p className="text-violet-200 text-sm">{patient.medical_notes || 'Sem observações médicas'}</p>
                    </div>
                </div>
            </div>

            <div className="px-4 -mt-10">
                {/* Progress summary */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5 text-center">
                    <p className="text-sm font-semibold text-gray-500 mb-2">Aderência hoje</p>
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-3xl font-black text-violet-600">{progress}%</span>
                        <span className="text-sm text-gray-400 font-medium">{takenCount} de {totalCount} doses</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Patient Actions */}
                <div className="flex gap-2 mb-6">
                    <Link href={`/patient/medications/add?patientId=${patient.id}`} className="flex-1 text-center py-2.5 rounded-xl bg-violet-50 border border-violet-100 text-sm font-semibold text-violet-600 hover:bg-violet-100 transition-colors">
                        + Medicamento
                    </Link>
                    <Link href={`/patient/reports?patientId=${patient.id}`} className="flex-1 text-center py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                        📈 Ver Rotina (Relatórios)
                    </Link>
                </div>

                {/* Today's schedule */}
                <h2 className="font-bold text-gray-800 mb-3 ml-1">Agenda do Dia</h2>

                {schedules.length === 0 ? (
                    <div className="card text-center py-10">
                        <span className="text-3xl mb-2 block">📅</span>
                        <p className="text-gray-500 text-sm">Nenhum medicamento agendado</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {schedules.map(schedule => {
                            const sc = statusConfig[schedule.status]
                            const isPending = schedule.status === 'pending'
                            const hasProof = !!schedule.proof_url

                            return (
                                <button
                                    key={schedule.id}
                                    onClick={() => {
                                        if (isPending) setShowModal(schedule)
                                        else if (hasProof) setShowProofUrl(schedule.proof_url)
                                    }}
                                    className={`card flex items-center gap-3 text-left w-full transition-all ${isPending || hasProof ? 'hover:border-violet-300 ring-2 ring-transparent focus:ring-violet-200 cursor-pointer shadow-sm' : 'opacity-80 bg-gray-50/50 cursor-default'}`}
                                >
                                    <div className="text-2xl flex-shrink-0">{sc.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-semibold ${schedule.status === 'taken' ? 'text-gray-400 line-through' : 'text-gray-900'} truncate`}>
                                            {schedule.medication.name}
                                        </p>
                                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                                            {schedule.medication.dosage} {schedule.medication.unit} · {formatTime(schedule.scheduled_time)}
                                        </p>

                                        {hasProof && (
                                            <p className="text-xs text-violet-600 mt-1 flex items-center gap-1 font-semibold">
                                                <span>📸</span> Ver Comprovante anexado
                                            </p>
                                        )}
                                    </div>
                                    {isPending ? (
                                        <span className="px-3 py-1.5 rounded-xl bg-violet-500 text-white text-xs font-bold shadow-sm">
                                            Registrar
                                        </span>
                                    ) : (
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${sc.badge}`}>
                                            {sc.label}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* === PROOF VIEWER MODAL === */}
            {showProofUrl && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowProofUrl(null)}>
                    <div onClick={e => e.stopPropagation()} className="relative w-full max-w-sm bg-white rounded-3xl overflow-hidden flex flex-col">
                        <div className="bg-gray-100 flex items-center justify-between px-4 py-3 border-b border-gray-200">
                            <h3 className="font-bold text-gray-800 text-sm">Comprovante de Dose</h3>
                            <button onClick={() => setShowProofUrl(null)} className="w-8 h-8 flex items-center justify-center bg-gray-200 text-gray-600 rounded-full font-bold hover:bg-gray-300">
                                ✕
                            </button>
                        </div>
                        <div className="bg-black w-full aspect-[3/4] relative flex items-center justify-center">
                            {/* Assuming media might be video or image, we handle image primarily. An advanced implementation checks the URL extension. */}
                            {showProofUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                                <video src={showProofUrl} controls autoPlay className="max-w-full max-h-full" />
                            ) : (
                                <img src={showProofUrl} alt="Comprovante" className="max-w-full max-h-full object-contain" />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* === DOSE REGISTRATION MODAL === */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center backdrop-blur-sm" onClick={() => !confirmingDose && setShowModal(null)}>
                    <div
                        className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-10 animate-up flex flex-col max-h-[90vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />

                        <div className="text-center mb-6 flex-shrink-0">
                            <h3 className="text-xl font-black text-gray-900 leading-tight mb-1">{showModal.medication.name}</h3>
                            <p className="text-gray-500 font-medium">
                                {showModal.medication.dosage} {showModal.medication.unit} · <span className="text-violet-600">{formatTime(showModal.scheduled_time)}</span>
                            </p>
                            {showModal.medication.instructions && (
                                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3 mt-4 border border-gray-100 text-left">
                                    <span className="font-semibold block mb-1">ℹ️ Instruções:</span>
                                    {showModal.medication.instructions}
                                </p>
                            )}
                        </div>

                        {/* Photo/Video Evidence Upload */}
                        <div className="mb-6 flex-1 overflow-y-auto">
                            <label className="block text-sm font-bold text-gray-700 mb-2">📸 Comprovante (Opcional)</label>

                            <label className={`
                                flex flex-col items-center justify-center w-full h-32 
                                border-2 border-dashed rounded-2xl cursor-pointer 
                                transition-all
                                ${proofFile ? 'border-violet-500 bg-violet-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}
                            `}>
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    {proofFile ? (
                                        <>
                                            <span className="text-3xl mb-2">🖼️</span>
                                            <p className="text-sm font-semibold text-violet-700 px-4 text-center truncate w-full">{proofFile.name}</p>
                                            <p className="text-xs text-violet-500 mt-1">Clique para trocar</p>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-8 h-8 mb-2 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
                                            </svg>
                                            <p className="mb-1 text-sm font-semibold text-gray-600">Tirar foto ou gravar vídeo</p>
                                            <p className="text-xs text-gray-500">Toque aqui para capturar</p>
                                        </>
                                    )}
                                </div>
                                {/* HTML5 mobile file input that opens camera natively */}
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*,video/*"
                                    capture="environment"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setProofFile(e.target.files[0])
                                        }
                                    }}
                                />
                            </label>
                        </div>

                        {/* Confirmation Button */}
                        <div className="mt-auto pt-2 flex-shrink-0">
                            {confirmingDose && uploadProgress > 0 ? (
                                <div className="w-full bg-gray-100 rounded-full h-3 mb-4 overflow-hidden">
                                    <div className="bg-violet-600 h-3 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                    <p className="text-xs text-center text-gray-500 mt-2 font-medium">Salvando registro...</p>
                                </div>
                            ) : null}

                            <button
                                onClick={() => confirmDose(showModal)}
                                disabled={confirmingDose}
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-md shadow-violet-200 mb-3 flex items-center justify-center gap-2"
                            >
                                {confirmingDose ? (
                                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>✅ Confirmar Dose</>
                                )}
                            </button>

                            <button
                                onClick={() => setShowModal(null)}
                                disabled={confirmingDose}
                                className="w-full py-4 rounded-2xl border-2 border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

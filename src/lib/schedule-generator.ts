import { supabase } from './supabase'

interface Medication {
    id: string
    patient_id: string
    frequency: string
    period: string | null
}

/**
 * Maps frequency + period to scheduled hours of the day.
 */
interface ScheduleTime {
    hour: number
    minute: number
}

function getScheduleTimes(frequency: string, period: string | null): ScheduleTime[] {
    // Check if period contains specific times (JSON format)
    if (period && period.startsWith('{')) {
        try {
            const parsed = JSON.parse(period)
            if (parsed.mode === 'time' && Array.isArray(parsed.times)) {
                return parsed.times.map((t: string) => {
                    const [h, m] = t.split(':').map(Number)
                    return { hour: h || 0, minute: m || 0 }
                })
            }
        } catch { /* fall through to meal-based */ }
    }

    // Period-based times (approximate meal times in Brazil)
    const periodTimes: Record<string, ScheduleTime> = {
        antes_cafe: { hour: 7, minute: 0 },
        depois_cafe: { hour: 8, minute: 0 },
        antes_almoco: { hour: 11, minute: 0 },
        depois_almoco: { hour: 13, minute: 0 },
        antes_jantar: { hour: 18, minute: 0 },
        depois_jantar: { hour: 20, minute: 0 },
    }

    switch (frequency) {
        case 'daily':
            return [period && periodTimes[period] ? periodTimes[period] : { hour: 8, minute: 0 }]
        case 'twice_day':
            return [{ hour: 8, minute: 0 }, { hour: 20, minute: 0 }]
        case 'three_day':
            return [{ hour: 8, minute: 0 }, { hour: 14, minute: 0 }, { hour: 20, minute: 0 }]
        case 'weekly':
            return [{ hour: 8, minute: 0 }]
        case 'as_needed':
            return []
        default:
            return [{ hour: 8, minute: 0 }]
    }
}

/**
 * Generates today's schedules for a single medication.
 * Skips if schedules already exist for today.
 */
export async function generateDailySchedules(medication: Medication): Promise<number> {
    const times = getScheduleTimes(medication.frequency, medication.period)
    if (times.length === 0) return 0

    const today = new Date()
    const dateStr = today.toISOString().split('T')[0]

    // Check if schedules already exist for today
    const startOfDay = `${dateStr}T00:00:00`
    const endOfDay = `${dateStr}T23:59:59`

    const { data: existing } = await supabase
        .from('medication_schedules')
        .select('id')
        .eq('medication_id', medication.id)
        .gte('scheduled_time', startOfDay)
        .lte('scheduled_time', endOfDay)

    if (existing && existing.length > 0) return 0 // already generated

    // Create schedule entries
    const schedules = times.map(t => ({
        medication_id: medication.id,
        patient_id: medication.patient_id,
        scheduled_time: `${dateStr}T${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}:00`,
        status: 'pending',
    }))

    const { error } = await supabase
        .from('medication_schedules')
        .insert(schedules)

    if (error) {
        console.error('Error generating schedules:', error)
        return 0
    }

    return schedules.length
}

/**
 * Generates today's schedules for ALL active medications of a patient.
 */
export async function generateAllSchedulesForPatient(patientId: string): Promise<number> {
    const { data: medications } = await supabase
        .from('medications')
        .select('id, patient_id, frequency, period')
        .eq('patient_id', patientId)
        .eq('active', true)

    if (!medications || medications.length === 0) return 0

    let totalCreated = 0
    for (const med of medications) {
        const created = await generateDailySchedules(med)
        totalCreated += created
    }

    return totalCreated
}

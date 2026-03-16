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
function getScheduleHours(frequency: string, period: string | null): number[] {
    // Period-based times (approximate meal times in Brazil)
    const periodTimes: Record<string, number> = {
        antes_cafe: 7,
        depois_cafe: 8,
        antes_almoco: 11,
        depois_almoco: 13,
        antes_jantar: 18,
        depois_jantar: 20,
    }

    switch (frequency) {
        case 'daily':
            return [period && periodTimes[period] ? periodTimes[period] : 8]
        case 'twice_day':
            return [8, 20]
        case 'three_day':
            return [8, 14, 20]
        case 'weekly':
            return [8] // once on this day
        case 'as_needed':
            return [] // no auto-schedule
        default:
            return [8]
    }
}

/**
 * Generates today's schedules for a single medication.
 * Skips if schedules already exist for today.
 */
export async function generateDailySchedules(medication: Medication): Promise<number> {
    const hours = getScheduleHours(medication.frequency, medication.period)
    if (hours.length === 0) return 0

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
    const schedules = hours.map(hour => ({
        medication_id: medication.id,
        patient_id: medication.patient_id,
        scheduled_time: `${dateStr}T${String(hour).padStart(2, '0')}:00:00`,
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

import { supabase } from './supabase'

export interface EnsurePatientResult {
    patientId: string | null
    created: boolean
    reason?: string
}

/**
 * Guarantees that a patient-role user has a `patients` record.
 *
 * Background: the Hotmart webhook is supposed to auto-create the patient row on
 * purchase, but a bug (upsert onConflict:'user_id' with no unique constraint)
 * caused it to fail silently for paciente licenses — leaving buyers unable to
 * add medications. This is the client-side safety net: whenever a patient-role
 * user opens the app without a patient record, we recreate it from their active
 * license. RLS allows the user to insert their own patient row (user_id = auth.uid()).
 *
 * Idempotent: if the record already exists, returns it without writing.
 *
 * IMPORTANT: only ever creates a record for role='patient' users. Caregivers
 * legitimately own MANY patient rows (all sharing the caregiver's user_id),
 * so auto-creating one for a caregiver would produce a phantom patient.
 */
export async function ensurePatientForUser(
    userId: string,
    fallbackName?: string,
): Promise<EnsurePatientResult> {
    // 1. Already has a patient record?
    const { data: existing } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

    if (existing) {
        return { patientId: existing.id, created: false }
    }

    // Guard: never auto-create a patient record for caregiver/family accounts.
    const { data: profile } = await supabase
        .from('users')
        .select('role, name')
        .eq('id', userId)
        .maybeSingle()

    if (profile && profile.role !== 'patient') {
        return { patientId: null, created: false, reason: 'not-a-patient-role' }
    }

    // 2. Find an active license owned by / assigned to this user (may be none)
    const { data: license } = await supabase
        .from('licenses')
        .select('id')
        .or(`owner_id.eq.${userId},assigned_to.eq.${userId}`)
        .eq('status', 'active')
        .maybeSingle()

    // 3. Resolve a name (caller fallback → profile name → generic)
    const name = fallbackName?.trim() || profile?.name?.trim() || 'Paciente'

    // 4. Create the missing patient record (license_id may be null for manual signups)
    const { data: created, error } = await supabase
        .from('patients')
        .insert({
            user_id: userId,
            license_id: license?.id ?? null,
            name,
        })
        .select('id')
        .single()

    if (error) {
        console.error('ensurePatientForUser insert failed:', error)
        return { patientId: null, created: false, reason: error.message }
    }

    return { patientId: created.id, created: true }
}

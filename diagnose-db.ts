import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

async function diagnose() {
    // 1. Check licenses
    const { data: licenses, error: le } = await supabase
        .from('licenses')
        .select('id, code, status, assigned_to')
        .eq('institution_id', 'd16cd264-7970-4f89-981a-8bedeca9ee8c')

    console.log('LICENSES:', JSON.stringify(licenses, null, 2))
    if (le) console.error('License error:', le)

    const ids = (licenses ?? []).map(l => l.assigned_to).filter(Boolean)
    console.log('\nAssigned IDs:', ids)

    // 2. Check users for those IDs
    const { data: users, error: ue } = await supabase
        .from('users')
        .select('id, name, role')
        .in('id', ids)

    console.log('\nUSERS MATCHING:', JSON.stringify(users, null, 2))
    if (ue) console.error('Users error:', ue)

    // 3. Check all users regardless
    const { data: allUsers } = await supabase
        .from('users')
        .select('id, name, role')
        .in('role', ['caregiver', 'patient'])
    
    console.log('\nALL CAREGIVERS/PATIENTS:', JSON.stringify(allUsers, null, 2))
}

diagnose()

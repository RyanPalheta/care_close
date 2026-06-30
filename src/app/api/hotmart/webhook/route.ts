import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env var')
    }
    return createClient(url, key)
}

// Hotmart webhook hottok for validation (set in env)
const HOTMART_HOTTOK = process.env.HOTMART_HOTTOK || ''

// Map Hotmart product IDs to license types
const PRODUCT_LICENSE_MAP: Record<string, { type: 'cuidador' | 'paciente'; max_patients: number; max_members: number }> = {
    // Configure these with your actual Hotmart product IDs
    [process.env.HOTMART_PRODUCT_CUIDADOR || 'cuidador']: { type: 'cuidador', max_patients: 10, max_members: 0 },
    [process.env.HOTMART_PRODUCT_PACIENTE || 'paciente']: { type: 'paciente', max_patients: 1, max_members: 5 },
}

export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabaseAdmin()
        const body = await request.json()

        // Validate hottok: reject only if both are present and don't match
        if (HOTMART_HOTTOK && body.hottok && body.hottok !== HOTMART_HOTTOK) {
            return NextResponse.json({ error: 'Invalid hottok' }, { status: 401 })
        }

        const event = body.event || body.data?.purchase?.status

        // Only process approved purchases
        if (event !== 'PURCHASE_APPROVED' && event !== 'approved') {
            return NextResponse.json({ message: 'Event ignored', event })
        }

        // Extract buyer info from Hotmart payload
        const buyerEmail = body.data?.buyer?.email || body.buyer?.email
        const buyerName = body.data?.buyer?.name || body.buyer?.name
        const productId = body.data?.product?.id?.toString() || body.data?.product?.name || 'paciente'
        const transactionId = body.data?.purchase?.transaction || body.purchase?.transaction || ''

        if (!buyerEmail) {
            return NextResponse.json({ error: 'Missing buyer email' }, { status: 400 })
        }

        // Determine license type from product (default to paciente if unknown product like test)
        const DEFAULT_LICENSE = { type: 'paciente' as const, max_patients: 1, max_members: 5 }
        const licenseConfig = PRODUCT_LICENSE_MAP[productId] || DEFAULT_LICENSE

        // Try to create user - if already exists, find them
        let userId: string | null = null
        let isNewUser = false

        const tempPassword = crypto.randomUUID()
        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
            email: buyerEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { name: buyerName },
        })

        if (createErr) {
            // If "already registered", try to find in auth.identities or deleted users
            // First try: search all auth users
            const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000, page: 1 })
            const found = listData?.users?.find(u => u.email === buyerEmail)

            if (found) {
                userId = found.id
            } else {
                // User might be in a broken state - try deleting and recreating
                // Or the email might be in identities but not users
                // Return detailed error for debugging
                return NextResponse.json({
                    error: 'Cannot create or find user',
                    createError: createErr.message,
                    email: buyerEmail,
                    authUsersCount: listData?.users?.length || 0,
                }, { status: 500 })
            }

            // Ensure profile exists
            await supabase.from('users').upsert({
                id: userId,
                name: buyerName || buyerEmail.split('@')[0],
                role: licenseConfig.type === 'cuidador' ? 'caregiver' : 'patient',
            }, { onConflict: 'id' })
        } else {
            userId = newUser.user.id
            isNewUser = true

            // Create profile in users table
            await supabase.from('users').upsert({
                id: userId,
                name: buyerName || buyerEmail.split('@')[0],
                role: licenseConfig.type === 'cuidador' ? 'caregiver' : 'patient',
            }, { onConflict: 'id' })
        }

        // Check if user already has an active license
        const { data: existingLicense } = await supabase
            .from('licenses')
            .select('id')
            .eq('owner_id', userId)
            .eq('status', 'active')
            .maybeSingle()

        if (existingLicense) {
            return NextResponse.json({ message: 'User already has active license', license_id: existingLicense.id })
        }

        // Generate license code
        const code = `CC-${licenseConfig.type.toUpperCase().slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`

        // Create license
        const { data: license, error: licenseErr } = await supabase
            .from('licenses')
            .insert({
                owner_id: userId,
                assigned_to: userId,
                code,
                license_type: licenseConfig.type,
                max_patients: licenseConfig.max_patients,
                max_members: licenseConfig.max_members,
                status: 'active',
                activated_at: new Date().toISOString(),
                purchased_at: new Date().toISOString(),
                hotmart_transaction_id: transactionId,
            })
            .select('id')
            .single()

        if (licenseErr) {
            console.error('Error creating license:', licenseErr)
            return NextResponse.json({ error: 'Failed to create license', licenseError: JSON.stringify(licenseErr), userId, productId }, { status: 500 })
        }

        // If patient license, create patient record.
        // Use a manual exists-check + insert instead of upsert(onConflict:'user_id')
        // because that requires a UNIQUE constraint on user_id; if it's ever missing
        // the upsert throws and the buyer silently ends up with no patient record.
        if (licenseConfig.type === 'paciente') {
            const { data: existingPatient } = await supabase
                .from('patients')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle()

            if (!existingPatient) {
                const { error: patientErr } = await supabase.from('patients').insert({
                    user_id: userId,
                    license_id: license.id,
                    name: buyerName || buyerEmail.split('@')[0],
                })
                if (patientErr) {
                    console.error('Failed to create patient record:', patientErr)
                    return NextResponse.json({
                        error: 'License created but patient record failed',
                        patientError: patientErr.message,
                        user_id: userId,
                        license_id: license.id,
                    }, { status: 500 })
                }
            }
        }

        // Send password setup email to new user
        if (isNewUser) {
            const anonClient = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            )
            await anonClient.auth.resetPasswordForEmail(buyerEmail, {
                redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://care-close.vercel.app'}/auth/set-password`,
            })
        }


        return NextResponse.json({
            success: true,
            license_id: license.id,
            license_type: licenseConfig.type,
            user_id: userId,
        })
    } catch (err) {
        console.error('Webhook error:', err)
        const message = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 })
    }
}

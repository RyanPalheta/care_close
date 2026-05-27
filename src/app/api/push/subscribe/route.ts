import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/push/subscribe
 * Saves a Web Push subscription to the database.
 *
 * Body: { endpoint, keys: { p256dh, auth }, leadMinutes? }
 * Headers: Authorization: Bearer <supabase-access-token>
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })
        }
        const accessToken = authHeader.slice(7)

        // Validate user via anon client + access token
        const anon = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
        )
        const { data: { user }, error: userErr } = await anon.auth.getUser()
        if (userErr || !user) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
        }

        const body = await request.json()
        const { endpoint, keys, leadMinutes, timezone } = body

        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return NextResponse.json({ error: 'Missing subscription fields' }, { status: 400 })
        }

        // Service role for the actual write (bypass RLS, upsert by endpoint)
        const admin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
        )

        const { error: upsertError } = await admin
            .from('push_subscriptions')
            .upsert({
                user_id: user.id,
                endpoint,
                p256dh: keys.p256dh,
                auth: keys.auth,
                lead_minutes: typeof leadMinutes === 'number' ? leadMinutes : 5,
                timezone: typeof timezone === 'string' && timezone.length > 0 ? timezone : 'America/Sao_Paulo',
                user_agent: request.headers.get('user-agent') || null,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'endpoint' })

        if (upsertError) {
            console.error('Subscription upsert failed:', upsertError)
            return NextResponse.json({ error: upsertError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('Subscribe error:', err)
        return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
    }
}

/**
 * DELETE /api/push/subscribe?endpoint=<url>
 * Removes a subscription (when user disables notifications or device).
 */
export async function DELETE(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })
        }
        const accessToken = authHeader.slice(7)

        const anon = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
        )
        const { data: { user }, error: userErr } = await anon.auth.getUser()
        if (userErr || !user) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
        }

        const endpoint = request.nextUrl.searchParams.get('endpoint')
        if (!endpoint) {
            return NextResponse.json({ error: 'Missing endpoint param' }, { status: 400 })
        }

        const admin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
        )

        await admin
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', endpoint)

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

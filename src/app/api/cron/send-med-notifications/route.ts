import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET/POST /api/cron/send-med-notifications
 *
 * Cron worker that fires medication reminder push notifications.
 * Should be called every 1-5 minutes by:
 *   - Vercel Cron (vercel.json)
 *   - External cron service (cron-job.org, EasyCron, Uptime Robot)
 *   - Supabase pg_cron
 *
 * Auth: Header "x-cron-secret: <CRON_SECRET>" or "Authorization: Bearer <CRON_SECRET>"
 *
 * Logic:
 *   1. Fetch all push_subscriptions
 *   2. For each subscription, find pending medication_schedules where
 *      scheduled_time is between (now) and (now + lead_minutes + 1min buffer)
 *      AND notification_sent_at IS NULL
 *   3. Send push, then mark notification_sent_at
 */
export async function GET(request: NextRequest) {
    return handle(request)
}

export async function POST(request: NextRequest) {
    return handle(request)
}

async function handle(request: NextRequest) {
    // Auth
    const secret = request.headers.get('x-cron-secret')
        || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const vapidPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPriv = process.env.VAPID_PRIVATE_KEY
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:contato@appcareclose.com'

    if (!vapidPub || !vapidPriv) {
        return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
    }

    webpush.setVapidDetails(vapidSubject, vapidPub, vapidPriv)

    const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // 1. Get all push subscriptions
    const { data: subs, error: subsErr } = await admin
        .from('push_subscriptions')
        .select('id, user_id, endpoint, p256dh, auth, lead_minutes')

    if (subsErr) {
        console.error('Failed to fetch subs:', subsErr)
        return NextResponse.json({ error: subsErr.message }, { status: 500 })
    }

    if (!subs || subs.length === 0) {
        return NextResponse.json({ sent: 0, message: 'No subscriptions' })
    }

    const now = new Date()
    let sentCount = 0
    let failedCount = 0
    let removedCount = 0
    const errors: string[] = []

    // Group subscriptions by user
    const subsByUser = new Map<string, typeof subs>()
    for (const sub of subs) {
        const arr = subsByUser.get(sub.user_id) || []
        arr.push(sub)
        subsByUser.set(sub.user_id, arr)
    }

    for (const [userId, userSubs] of subsByUser.entries()) {
        // Use the largest lead time among the user's devices
        const leadMin = Math.max(...userSubs.map(s => s.lead_minutes || 5))

        // Window: now → now + leadMin + 1min buffer (cron may run slightly late)
        const windowEnd = new Date(now.getTime() + (leadMin + 1) * 60 * 1000)

        // Find patient records associated with this user (either patient.user_id or caregiver via licenses)
        const patientIds: string[] = []

        const { data: ownPatient } = await admin
            .from('patients')
            .select('id')
            .eq('user_id', userId)
        if (ownPatient) patientIds.push(...ownPatient.map(p => p.id))

        // Patients under licenses owned/assigned to this caregiver
        const { data: licenses } = await admin
            .from('licenses')
            .select('id')
            .or(`owner_id.eq.${userId},assigned_to.eq.${userId}`)
            .eq('status', 'active')

        if (licenses && licenses.length > 0) {
            const licIds = licenses.map(l => l.id)
            const { data: caregiverPatients } = await admin
                .from('patients')
                .select('id')
                .in('license_id', licIds)
            if (caregiverPatients) patientIds.push(...caregiverPatients.map(p => p.id))
        }

        if (patientIds.length === 0) continue

        // 2. Find due medications
        const { data: dueScheds, error: schedErr } = await admin
            .from('medication_schedules')
            .select(`
                id, scheduled_time, patient_id,
                medication:medications!medication_id (name, dosage, unit),
                patient:patients!patient_id (name)
            `)
            .in('patient_id', Array.from(new Set(patientIds)))
            .eq('status', 'pending')
            .is('notification_sent_at', null)
            .gte('scheduled_time', now.toISOString())
            .lt('scheduled_time', windowEnd.toISOString())

        if (schedErr) {
            errors.push(`Schedules fetch for ${userId}: ${schedErr.message}`)
            continue
        }

        if (!dueScheds || dueScheds.length === 0) continue

        // 3. Send push for each due schedule, to each device of the user
        for (const sched of dueScheds as any[]) {
            const med = sched.medication
            const patient = sched.patient
            const time = new Date(sched.scheduled_time).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
            })

            const payload = JSON.stringify({
                title: `💊 ${med?.name || 'Medicamento'}`,
                body: patient?.name
                    ? `${patient.name} — ${med?.dosage || ''} ${med?.unit || ''} às ${time}`
                    : `${med?.dosage || ''} ${med?.unit || ''} às ${time}`,
                tag: `med-${sched.id}`,
                url: '/patient/home',
                scheduleId: sched.id,
            })

            for (const sub of userSubs) {
                try {
                    await webpush.sendNotification({
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.p256dh, auth: sub.auth },
                    }, payload)
                    sentCount++
                } catch (err: any) {
                    failedCount++
                    // 410 Gone or 404 = subscription expired, remove it
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await admin
                            .from('push_subscriptions')
                            .delete()
                            .eq('id', sub.id)
                        removedCount++
                    } else {
                        errors.push(`Push to ${sub.endpoint.slice(-20)}: ${err.statusCode} ${err.body || err.message}`)
                    }
                }
            }

            // Mark as sent
            await admin
                .from('medication_schedules')
                .update({ notification_sent_at: new Date().toISOString() })
                .eq('id', sched.id)
        }
    }

    return NextResponse.json({
        sent: sentCount,
        failed: failedCount,
        removed: removedCount,
        errors: errors.slice(0, 5),
    })
}

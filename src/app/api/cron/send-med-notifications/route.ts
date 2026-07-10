import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import * as Sentry from '@sentry/nextjs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * scheduled_time is stored as a naive wall-clock forced into UTC — e.g.
 * "2026-05-27T08:00:00+00" actually means "08:00 in the user's local time".
 * This reinterprets that wall-clock in the given IANA timezone and returns the
 * TRUE epoch (ms) the medication is due. Brazil has no DST, so this is stable.
 */
function intendedInstantMs(scheduledTimeIso: string, timeZone: string): number {
    const d = new Date(scheduledTimeIso)
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    const parts = dtf.formatToParts(d)
    const map: Record<string, string> = {}
    for (const p of parts) map[p.type] = p.value
    const asUTC = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second)
    const offsetMin = (asUTC - d.getTime()) / 60000
    return d.getTime() - offsetMin * 60000
}

/** Format the stored wall-clock (HH:MM) without any timezone shift. */
function wallClockLabel(scheduledTimeIso: string): string {
    try {
        return new Intl.DateTimeFormat('pt-BR', {
            hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
        }).format(new Date(scheduledTimeIso))
    } catch {
        return scheduledTimeIso.slice(11, 16)
    }
}

/**
 * Maps frequency + period to the wall-clock times of the day.
 * KEEP IN SYNC with src/lib/schedule-generator.ts (client-side copy).
 */
function getScheduleTimes(frequency: string, period: string | null): Array<{ hour: number; minute: number }> {
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
    const periodTimes: Record<string, { hour: number; minute: number }> = {
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
 * Server-side schedule generation. Previously schedules were only created when
 * a user OPENED the app (generateAllSchedulesForPatient on home load) — so a
 * user who didn't open the app before their first med of the day silently got
 * no reminder (the cron had no row to send). The cron now guarantees today's
 * and tomorrow's rows exist for every active medication, independent of app
 * usage. Mirrors the client's dedupe rule: skip a med+day if ANY schedule
 * already exists for that day.
 */
async function ensureSchedulesExist(admin: SupabaseClient): Promise<number> {
    const { data: meds } = await admin
        .from('medications')
        .select('id, patient_id, frequency, period')
        .eq('active', true)

    if (!meds || meds.length === 0) return 0

    const today = new Date()
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const dates = [today.toISOString().split('T')[0], tomorrow.toISOString().split('T')[0]]

    const { data: existing } = await admin
        .from('medication_schedules')
        .select('medication_id, scheduled_time')
        .gte('scheduled_time', `${dates[0]}T00:00:00`)
        .lte('scheduled_time', `${dates[1]}T23:59:59`)

    const have = new Set(
        (existing || []).map((e: any) => `${e.medication_id}|${String(e.scheduled_time).slice(0, 10)}`)
    )

    const rows: any[] = []
    for (const med of meds as any[]) {
        const times = getScheduleTimes(med.frequency, med.period)
        if (times.length === 0) continue
        for (const date of dates) {
            if (have.has(`${med.id}|${date}`)) continue
            for (const t of times) {
                rows.push({
                    medication_id: med.id,
                    patient_id: med.patient_id,
                    scheduled_time: `${date}T${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}:00`,
                    status: 'pending',
                })
            }
        }
    }

    if (rows.length > 0) {
        const { error } = await admin.from('medication_schedules').insert(rows)
        if (error) {
            console.error('ensureSchedulesExist insert failed:', error)
            Sentry.captureMessage('Cron schedule generation failed', {
                level: 'error',
                extra: { error: error.message, attempted: rows.length },
            })
            return 0
        }
    }
    return rows.length
}

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

    // 0. Guarantee today's/tomorrow's schedule rows exist for every active
    //    medication — reminders must not depend on the user opening the app.
    const generated = await ensureSchedulesExist(admin)

    // 1. Get all push subscriptions
    const { data: subs, error: subsErr } = await admin
        .from('push_subscriptions')
        .select('id, user_id, endpoint, p256dh, auth, lead_minutes, timezone')

    if (subsErr) {
        console.error('Failed to fetch subs:', subsErr)
        return NextResponse.json({ error: subsErr.message }, { status: 500 })
    }

    if (!subs || subs.length === 0) {
        return NextResponse.json({ sent: 0, generated, message: 'No subscriptions' })
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

        // Timezone the schedules should be interpreted in (recipient's device).
        // Defaults to Brasília if unknown.
        const userTz = userSubs.find(s => s.timezone)?.timezone || 'America/Sao_Paulo'

        // A notification is due when the med's intended instant falls in
        // [now, now + leadMin + 1min]. Because scheduled_time is a naive
        // wall-clock, its stored value sits up to ~14h away from the intended
        // instant, so we fetch a wide DB window and filter precisely in JS.
        const windowEndMs = now.getTime() + (leadMin + 1) * 60 * 1000
        const fetchFrom = new Date(now.getTime() - 14 * 60 * 60 * 1000).toISOString()
        const fetchTo = new Date(now.getTime() + 14 * 60 * 60 * 1000).toISOString()

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

        // 2. Fetch candidate schedules in a wide window, then filter by the
        //    intended instant (wall-clock reinterpreted in the user's timezone).
        const { data: candidates, error: schedErr } = await admin
            .from('medication_schedules')
            .select(`
                id, scheduled_time, patient_id,
                medication:medications!medication_id (name, dosage, unit),
                patient:patients!patient_id (name)
            `)
            .in('patient_id', Array.from(new Set(patientIds)))
            .eq('status', 'pending')
            .is('notification_sent_at', null)
            .gte('scheduled_time', fetchFrom)
            .lt('scheduled_time', fetchTo)

        if (schedErr) {
            errors.push(`Schedules fetch for ${userId}: ${schedErr.message}`)
            continue
        }

        const dueScheds = (candidates || []).filter(s => {
            const due = intendedInstantMs(s.scheduled_time, userTz)
            return due >= now.getTime() && due < windowEndMs
        })

        if (dueScheds.length === 0) continue

        // 3. Send push for each due schedule, to each device of the user
        for (const sched of dueScheds as any[]) {
            const med = sched.medication
            const patient = sched.patient

            // scheduled_time is a naive wall-clock, so show it as-is (no shift)
            const time = wallClockLabel(sched.scheduled_time)

            let deliveredToAtLeastOne = false

            for (const sub of userSubs) {
                const dose = `${med?.dosage || ''} ${med?.unit || ''}`.trim()
                const payload = JSON.stringify({
                    title: `⏰ Está na hora do remédio`,
                    body: patient?.name
                        ? `${patient.name}: tomar ${med?.name || 'medicamento'}${dose ? ` (${dose})` : ''} — ${time}`
                        : `Tomar ${med?.name || 'seu medicamento'}${dose ? ` (${dose})` : ''} — ${time}`,
                    tag: `med-${sched.id}`,
                    url: `/patient/home?confirm=${sched.id}`,
                    scheduleId: sched.id,
                })

                try {
                    await webpush.sendNotification({
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.p256dh, auth: sub.auth },
                    }, payload, {
                        // High urgency asks FCM to wake a dozing device now;
                        // TTL 30min drops the push instead of delivering a stale
                        // "hora do remédio" an hour late.
                        urgency: 'high',
                        TTL: 1800,
                    })
                    sentCount++
                    deliveredToAtLeastOne = true
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

            // Mark as sent ONLY if at least one device accepted the push.
            // If every send failed (expired sub, push-service error), leave it
            // null so the next cron run retries while the med is still due.
            if (deliveredToAtLeastOne) {
                await admin
                    .from('medication_schedules')
                    .update({ notification_sent_at: new Date().toISOString() })
                    .eq('id', sched.id)
            } else {
                errors.push(`No device accepted push for schedule ${sched.id} (user ${userId})`)
            }
        }
    }

    // Surface any accumulated soft errors (push failures, per-user fetch errors)
    // to Sentry so they're monitored even though the request returns 200.
    if (errors.length > 0) {
        Sentry.captureMessage(`Cron send-med-notifications had ${errors.length} error(s)`, {
            level: 'warning',
            extra: { errors: errors.slice(0, 20), sent: sentCount, failed: failedCount },
        })
    }

    return NextResponse.json({
        sent: sentCount,
        failed: failedCount,
        removed: removedCount,
        generated,
        errors: errors.slice(0, 5),
    })
}

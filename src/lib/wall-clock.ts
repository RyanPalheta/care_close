/**
 * medication_schedules.scheduled_time is a NAIVE wall-clock stored with a fake
 * UTC offset — "2026-07-14T09:45:00+00:00" means "09:45 on the user's clock",
 * not 09:45 UTC. Formatting it with Date#toLocaleTimeString (no timeZone)
 * shifts it into the device timezone (−3h/−4h in Brazil), which is how a med
 * registered for 07:00 showed up as "04:00" on some screens.
 *
 * Always display it through these helpers.
 */

/** "HH:MM" exactly as stored (no timezone shift). */
export function wallTime(iso: string): string {
    const m = iso?.match(/T(\d{2}):(\d{2})/)
    if (m) return `${m[1]}:${m[2]}`
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

/** "DD/MM" exactly as stored (no timezone shift). */
export function wallDate(iso: string): string {
    const m = iso?.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (m) return `${m[3]}/${m[2]}`
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

/**
 * Interpret the stored wall-clock as a Date in the DEVICE's local timezone.
 * Use this for time math against `new Date()` (e.g. "how many hours late"),
 * never `new Date(scheduled_time)` directly.
 */
export function wallClockAsLocalDate(iso: string): Date {
    const m = iso?.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
    if (!m) return new Date(iso)
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))
}

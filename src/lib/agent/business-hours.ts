// src/lib/agent/business-hours.ts
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
// The agent had no idea what time it was.
//
// Nothing in the engine ever told the model the date, the hour, or when
// the business is open. So at 23:30 a customer said "today", and the
// booking tool turned that into `new Date().toISOString()` — a midnight
// consultation, saved as a real request, that no clinic will ever honour.
// The model could not have caught it: it was never given the clock.
//
// This module is that missing clock. It gives the engine two things:
//
//   1. describeHoursForPrompt() — a short block of text stating today's
//      date, the local time, and the opening hours, so the model can
//      reason about "today" and "tonight" like a receptionist would.
//
//   2. resolveSlot() — turns what the customer actually said ("today",
//      "tomorrow 3pm", "Monday morning") into a real instant that falls
//      INSIDE opening hours, or refuses and hands back the next slot
//      that does. This is the guard rail: no phrasing, in any language
//      the model invents, can produce a midnight appointment any more.
//
// ── ON TIME ZONES ────────────────────────────────────────────────────
// Everything is stored as UTC (the column is timestamptz) but reasoned
// about in the tenant's zone. A Delhi clinic closing at 19:00 closes at
// 19:00 in Delhi, not on the server. We use Intl rather than pulling in
// a date library — it ships with Node and knows every zone's DST rules.

/** One day's trading window in local wall-clock time, or null when shut. */
export interface DayHours {
  /** "HH:MM", 24-hour, local to the business. */
  open: string
  /** "HH:MM", 24-hour, local to the business. */
  close: string
}

export interface BusinessHours {
  /** IANA zone, e.g. "Asia/Kolkata". */
  timezone: string
  /** Index 0 = Sunday … 6 = Saturday, matching Date#getDay(). */
  days: (DayHours | null)[]
  /** Appointment granularity in minutes. Used to place and round slots. */
  slotMinutes: number
  /**
   * How far ahead the earliest bookable slot must be. Somebody messaging
   * at 09:58 should not be handed a 10:00 appointment two minutes later —
   * nobody can get there, and the clinic cannot prepare.
   */
  minLeadMinutes: number
}

/**
 * What most Indian SMBs actually run, and a far better default than
 * "open all hours", which is what the absence of this file amounted to.
 * Sunday closed, 10:00–19:00 the rest of the week.
 */
export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  timezone: 'Asia/Kolkata',
  days: [
    null,                             // Sun — closed
    { open: '10:00', close: '19:00' }, // Mon
    { open: '10:00', close: '19:00' }, // Tue
    { open: '10:00', close: '19:00' }, // Wed
    { open: '10:00', close: '19:00' }, // Thu
    { open: '10:00', close: '19:00' }, // Fri
    { open: '10:00', close: '17:00' }, // Sat — short day
  ],
  slotMinutes: 30,
  minLeadMinutes: 60,
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/* ─────────────────────────────────────────────────────────────────────
   Parsing what is stored on the agent row
   ───────────────────────────────────────────────────────────────────── */

/**
 * Read `agents.business_hours` (JSONB) into a usable shape.
 *
 * Deliberately forgiving. This value is edited by hand in a dashboard and
 * read on the customer's critical path — a typo in one day's close time
 * must not take the agent down, it must fall back to a sane default for
 * that day only.
 */
export function parseBusinessHours(raw: unknown): BusinessHours {
  if (!raw) return DEFAULT_BUSINESS_HOURS

  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return DEFAULT_BUSINESS_HOURS
    }
  }
  if (typeof value !== 'object' || value === null) return DEFAULT_BUSINESS_HOURS

  const obj = value as Record<string, unknown>
  const timezone =
    typeof obj.timezone === 'string' && isValidZone(obj.timezone)
      ? obj.timezone
      : DEFAULT_BUSINESS_HOURS.timezone

  const rawDays = Array.isArray(obj.days) ? obj.days : []
  const days: (DayHours | null)[] = []
  for (let i = 0; i < 7; i++) {
    days.push(parseDay(rawDays[i], DEFAULT_BUSINESS_HOURS.days[i]))
  }

  // A configuration where every day is closed would make the agent
  // unable to ever offer a time — almost certainly a mistake rather than
  // a business that never opens, so we fall back rather than deadlock.
  if (days.every((d) => d === null)) return { ...DEFAULT_BUSINESS_HOURS, timezone }

  return {
    timezone,
    days,
    slotMinutes: clampInt(obj.slotMinutes, 5, 240, DEFAULT_BUSINESS_HOURS.slotMinutes),
    minLeadMinutes: clampInt(obj.minLeadMinutes, 0, 60 * 24 * 7, DEFAULT_BUSINESS_HOURS.minLeadMinutes),
  }
}

function parseDay(raw: unknown, fallback: DayHours | null): DayHours | null {
  // An explicit null means "closed" and must be honoured, not defaulted.
  if (raw === null) return null
  if (typeof raw !== 'object' || raw === undefined) return fallback

  const d = raw as Record<string, unknown>
  if (d.closed === true) return null

  const open = normaliseHhMm(d.open)
  const close = normaliseHhMm(d.close)
  if (!open || !close) return fallback
  // A window that closes before it opens is unusable; keep the default
  // rather than produce a day with no valid slots at all.
  if (toMinutes(close) <= toMinutes(open)) return fallback

  return { open, close }
}

function normaliseHhMm(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function isValidZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Wall-clock arithmetic in a named zone, without a date library
   ───────────────────────────────────────────────────────────────────── */

interface LocalParts {
  year: number
  month: number // 1-12
  day: number   // 1-31
  hour: number
  minute: number
  weekday: number // 0 = Sunday
}

/** What the wall clock in `timezone` reads at instant `at`. */
export function localParts(at: Date, timezone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })

  const parts: Record<string, string> = {}
  for (const p of fmt.formatToParts(at)) parts[p.type] = p.value

  // Intl renders midnight as "24" in some ICU versions; normalise it.
  const hour = Number(parts.hour) % 24
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    weekday: weekdayIndex < 0 ? new Date(at).getUTCDay() : weekdayIndex,
  }
}

/**
 * The reverse: the instant at which the clock in `timezone` reads the
 * given wall-clock time.
 *
 * Done in two passes because the offset itself depends on the instant —
 * around a DST boundary the first guess can be an hour out, and the
 * second pass corrects it. India has no DST, but this code should not
 * quietly break the first time somebody sells to a business in London.
 */
export function instantFromLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
  let offset = zoneOffsetMs(new Date(wall), timezone)
  offset = zoneOffsetMs(new Date(wall - offset), timezone)
  return new Date(wall - offset)
}

/** How far ahead of UTC the zone is, at that instant, in milliseconds. */
function zoneOffsetMs(at: Date, timezone: string): number {
  const p = localParts(at, timezone)
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0)
  // Seconds and ms are not in `p`; align both sides to the minute.
  const actual = Math.floor(at.getTime() / 60000) * 60000
  return asIfUtc - actual
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function formatHhMm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "3:30 PM" — how a human writes a time back to a customer. */
export function humanTime(totalMinutes: number): string {
  const h24 = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const suffix = h24 < 12 ? 'AM' : 'PM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

/* ─────────────────────────────────────────────────────────────────────
   Open / closed
   ───────────────────────────────────────────────────────────────────── */

export function isOpenAt(at: Date, hours: BusinessHours): boolean {
  const p = localParts(at, hours.timezone)
  const day = hours.days[p.weekday]
  if (!day) return false
  const minutes = p.hour * 60 + p.minute
  return minutes >= toMinutes(day.open) && minutes < toMinutes(day.close)
}

/**
 * The first bookable slot at or after `from`, honouring opening hours,
 * the lead time, and slot granularity.
 *
 * Searches 14 days and then gives up. A business that is shut for a
 * fortnight has a problem this function cannot solve, and looping
 * forever on a customer's message would be worse than returning null.
 */
export function nextOpenSlot(from: Date, hours: BusinessHours): Date | null {
  const earliest = new Date(from.getTime() + hours.minLeadMinutes * 60_000)

  for (let offset = 0; offset < 14; offset++) {
    const probe = new Date(earliest.getTime() + offset * 86_400_000)
    const p = localParts(probe, hours.timezone)
    const day = hours.days[p.weekday]
    if (!day) continue

    const openMin = toMinutes(day.open)
    const closeMin = toMinutes(day.close)

    // On the first day we must start from now-plus-lead; on later days
    // the whole window is available.
    const fromMin = offset === 0 ? Math.max(openMin, p.hour * 60 + p.minute) : openMin
    const slotMin = roundUpToSlot(fromMin, openMin, hours.slotMinutes)

    // The slot has to start early enough to finish before closing.
    if (slotMin + hours.slotMinutes > closeMin) continue

    return instantFromLocal(p.year, p.month, p.day, Math.floor(slotMin / 60), slotMin % 60, hours.timezone)
  }

  return null
}

/** Snap a minute-of-day up onto the slot grid, measured from opening. */
function roundUpToSlot(minute: number, openMinute: number, slotMinutes: number): number {
  if (minute <= openMinute) return openMinute
  const past = minute - openMinute
  return openMinute + Math.ceil(past / slotMinutes) * slotMinutes
}

/* ─────────────────────────────────────────────────────────────────────
   The prompt block
   ───────────────────────────────────────────────────────────────────── */

/**
 * The text handed to the model on every turn. Short on purpose — this is
 * paid-for context on every single message — but it carries the three
 * facts the model cannot derive: what day it is, what time it is, and
 * when the business is actually open.
 */
export function describeHoursForPrompt(hours: BusinessHours, now: Date = new Date()): string {
  const p = localParts(now, hours.timezone)
  const open = isOpenAt(now, hours)
  const today = hours.days[p.weekday]

  const lines = [
    `\n[Current time — this is real, use it]`,
    `Right now it is ${humanTime(p.hour * 60 + p.minute)} on ${DAY_NAMES[p.weekday]}, ${p.day}/${p.month}/${p.year} (${hours.timezone}).`,
    today
      ? `Today's hours: ${humanTime(toMinutes(today.open))} to ${humanTime(toMinutes(today.close))}. The business is ${open ? 'OPEN right now' : 'CLOSED right now'}.`
      : `The business is CLOSED all day today.`,
  ]

  // The weekly grid, collapsed so identical days share a line.
  const schedule = hours.days
    .map((d, i) => `${DAY_NAMES[i].slice(0, 3)} ${d ? `${humanTime(toMinutes(d.open))}–${humanTime(toMinutes(d.close))}` : 'closed'}`)
    .join(', ')
  lines.push(`Weekly hours: ${schedule}.`)

  const next = nextOpenSlot(now, hours)
  if (next) {
    const n = localParts(next, hours.timezone)
    const sameDay = n.day === p.day && n.month === p.month && n.year === p.year
    lines.push(
      `Earliest appointment you may offer: ${sameDay ? 'today' : DAY_NAMES[n.weekday]} ${sameDay ? '' : `${n.day}/${n.month} `}at ${humanTime(n.hour * 60 + n.minute)}.`,
    )
  }

  lines.push(
    `Never offer or accept a time outside these hours. If the customer asks for one, say plainly that the business is closed then and offer the earliest time above.`,
  )

  return lines.join('\n')
}

/* ─────────────────────────────────────────────────────────────────────
   Turning what the customer said into a real appointment
   ───────────────────────────────────────────────────────────────────── */

export type SlotResolution =
  | {
      ok: true
      /** UTC instant to store. */
      iso: string
      /** How to say it back to the customer, e.g. "Tuesday 12/8 at 10 AM". */
      label: string
      /** True when we had to move the time the customer asked for. */
      adjusted: boolean
      /** Present when adjusted — why their time did not work. */
      note?: string
    }
  | {
      ok: false
      /** Plain-English reason, safe to paraphrase to the customer. */
      reason: string
    }

/**
 * Resolve a free-text preference into a bookable instant.
 *
 * The rules, in order:
 *   • No preference given → the next open slot.
 *   • A day but no time  → the first open slot on that day.
 *   • A day and a time   → that exact slot if it is open and far enough
 *                          ahead, otherwise the next open slot, flagged
 *                          as adjusted so the caller tells the truth
 *                          about having moved it.
 *
 * The 23:30 "today" case lands in the third branch: today's window is
 * long gone, so it comes back adjusted, pointing at tomorrow morning,
 * and the model is told to say so rather than confirm midnight.
 */
export function resolveSlot(
  preference: string | undefined,
  hours: BusinessHours,
  now: Date = new Date(),
): SlotResolution {
  const fallback = nextOpenSlot(now, hours)
  if (!fallback) {
    return {
      ok: false,
      reason: 'No opening hours are configured for the next two weeks, so no time can be offered.',
    }
  }

  const text = (preference || '').trim().toLowerCase()
  if (!text) {
    return success(fallback, hours, false)
  }

  const wanted = parsePreference(text, hours, now)
  if (!wanted) {
    // Unparseable phrasing ("sometime soon", "whenever"). Offer the next
    // slot rather than guessing — and say it was our suggestion.
    return success(fallback, hours, true, `We could not read "${preference}" as a date, so this is the earliest available time.`)
  }

  // Past, or inside the lead window — cannot be honoured.
  const earliest = now.getTime() + hours.minLeadMinutes * 60_000
  if (wanted.getTime() < earliest) {
    const p = localParts(now, hours.timezone)
    const day = hours.days[p.weekday]
    const closedNow = !day || (p.hour * 60 + p.minute) >= toMinutes(day.close)
    return success(
      fallback,
      hours,
      true,
      closedNow
        ? `The business is closed for the rest of ${describeWhen(wanted, now, hours)}, so that time is not available.`
        : `That time is too soon to arrange, so this is the earliest we can do.`,
    )
  }

  // Outside opening hours on the requested day.
  if (!isOpenAt(wanted, hours)) {
    const w = localParts(wanted, hours.timezone)
    const day = hours.days[w.weekday]
    return success(
      fallback,
      hours,
      true,
      day
        ? `${DAY_NAMES[w.weekday]} hours are ${humanTime(toMinutes(day.open))} to ${humanTime(toMinutes(day.close))}, so ${humanTime(w.hour * 60 + w.minute)} is outside them.`
        : `The business is closed on ${DAY_NAMES[w.weekday]}.`,
    )
  }

  // A valid slot — snap it onto the grid so the diary stays tidy.
  const w = localParts(wanted, hours.timezone)
  const dayHours = hours.days[w.weekday]!
  const snapped = roundUpToSlot(w.hour * 60 + w.minute, toMinutes(dayHours.open), hours.slotMinutes)
  if (snapped + hours.slotMinutes > toMinutes(dayHours.close)) {
    return success(fallback, hours, true, `That is too close to closing time to fit an appointment.`)
  }

  const exact = instantFromLocal(w.year, w.month, w.day, Math.floor(snapped / 60), snapped % 60, hours.timezone)
  return success(exact, hours, false)
}

function success(at: Date, hours: BusinessHours, adjusted: boolean, note?: string): SlotResolution {
  return { ok: true, iso: at.toISOString(), label: labelFor(at, hours), adjusted, note }
}

/** "Tuesday 12/8 at 10 AM" — unambiguous without being robotic. */
export function labelFor(at: Date, hours: BusinessHours): string {
  const p = localParts(at, hours.timezone)
  return `${DAY_NAMES[p.weekday]} ${p.day}/${p.month} at ${humanTime(p.hour * 60 + p.minute)}`
}

function describeWhen(at: Date, now: Date, hours: BusinessHours): string {
  const a = localParts(at, hours.timezone)
  const n = localParts(now, hours.timezone)
  if (a.year === n.year && a.month === n.month && a.day === n.day) return 'today'
  return DAY_NAMES[a.weekday]
}

/* ── Free-text date/time parsing ──────────────────────────────────────
   Small and deliberately conservative. Anything it cannot read returns
   null, and the caller offers the next open slot instead — a wrong guess
   about a customer's appointment is worse than an honest suggestion. */

function parsePreference(text: string, hours: BusinessHours, now: Date): Date | null {
  const nowParts = localParts(now, hours.timezone)
  const time = parseTimeOfDay(text)

  // ISO or a date the platform's own Date can read ("2026-08-12", "12 Aug 2026").
  const direct = parseExplicitDate(text, hours, time)
  if (direct) return direct

  let dayOffset: number | null = null

  if (/\bday after tomorrow\b/.test(text)) dayOffset = 2
  else if (/\btomorrow\b|\btmrw\b|\bkal\b/.test(text)) dayOffset = 1
  else if (/\btoday\b|\btonight\b|\bnow\b|\baaj\b/.test(text)) dayOffset = 0

  if (dayOffset === null) {
    const weekday = parseWeekday(text)
    if (weekday !== null) {
      // "Monday" means the next Monday; "next Monday" means the one after
      // that if today is already Monday.
      let delta = (weekday - nowParts.weekday + 7) % 7
      if (delta === 0) delta = /\bnext\b/.test(text) ? 7 : 0
      dayOffset = delta
    }
  }

  if (dayOffset === null) return null

  // Walk the calendar date forward by whole local days, then place the
  // time. Adding 86.4M ms to the instant would drift across a DST edge;
  // going through the parts keeps the date correct.
  const base = new Date(now.getTime() + dayOffset * 86_400_000)
  const b = localParts(base, hours.timezone)

  if (time !== null) {
    return instantFromLocal(b.year, b.month, b.day, Math.floor(time / 60), time % 60, hours.timezone)
  }

  // A day with no time: aim at opening, and let the caller's slot search
  // move it forward if that has already passed.
  const day = hours.days[b.weekday]
  const startMin = day ? toMinutes(day.open) : 9 * 60
  const candidate = instantFromLocal(b.year, b.month, b.day, Math.floor(startMin / 60), startMin % 60, hours.timezone)

  // For "today" specifically, opening time is usually in the past. Push
  // to the next real slot within that same day if one exists.
  if (dayOffset === 0 && candidate.getTime() < now.getTime() + hours.minLeadMinutes * 60_000) {
    const next = nextOpenSlot(now, hours)
    if (next) {
      const n = localParts(next, hours.timezone)
      // Only accept it if it is still the same local day — otherwise let
      // the caller report "today is not possible" honestly.
      if (n.year === b.year && n.month === b.month && n.day === b.day) return next
    }
    return candidate // in the past → caller reports today is not available
  }

  return candidate
}

/** Minutes past local midnight, or null when the text names no time. */
function parseTimeOfDay(text: string): number | null {
  // "3pm", "3 pm", "3:30pm", "3.30 pm"
  const ampm = text.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/)
  if (ampm) {
    let h = Number(ampm[1]) % 12
    const m = ampm[2] ? Number(ampm[2]) : 0
    if (ampm[3] === 'pm') h += 12
    if (m < 60) return h * 60 + m
  }

  // "15:00", "at 15.30" — 24-hour, only when it cannot be a date.
  const h24 = text.match(/\b(\d{1,2})[:.](\d{2})\b(?!\s*[/-])/)
  if (h24) {
    const h = Number(h24[1])
    const m = Number(h24[2])
    if (h < 24 && m < 60) return h * 60 + m
  }

  // Rough parts of the day. Better than nothing — a customer who says
  // "tomorrow morning" has told us something real.
  if (/\bmorning\b|\bsubah\b/.test(text)) return 10 * 60
  if (/\bafternoon\b|\bdopahar\b/.test(text)) return 14 * 60
  if (/\bevening\b|\bshaam\b/.test(text)) return 17 * 60
  if (/\bnight\b|\braat\b/.test(text)) return 19 * 60 // will usually fail the hours check, correctly

  return null
}

function parseWeekday(text: string): number | null {
  const names = [
    ['sunday', 'sun'],
    ['monday', 'mon'],
    ['tuesday', 'tue', 'tues'],
    ['wednesday', 'wed'],
    ['thursday', 'thu', 'thurs'],
    ['friday', 'fri'],
    ['saturday', 'sat'],
  ]
  for (let i = 0; i < names.length; i++) {
    for (const n of names[i]) {
      if (new RegExp(`\\b${n}\\b`).test(text)) return i
    }
  }
  return null
}

/**
 * Dates the customer wrote out: "2026-08-12", "12/08", "29 March".
 * Anything ambiguous is left to the weekday/relative parsing above.
 */
function parseExplicitDate(text: string, hours: BusinessHours, time: number | null): Date | null {
  const nowParts = localParts(new Date(), hours.timezone)

  // ISO first — unambiguous.
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) {
    return placeOnDate(Number(iso[1]), Number(iso[2]), Number(iso[3]), time, hours)
  }

  // "12/8" or "12/08/2026" — day first, which is how India writes it.
  const slash = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (slash) {
    const day = Number(slash[1])
    const month = Number(slash[2])
    let year = slash[3] ? Number(slash[3]) : nowParts.year
    if (year < 100) year += 2000
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return placeOnDate(year, month, day, time, hours)
    }
  }

  // "29 March", "March 29", "29 mar"
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const named = text.match(
    /\b(\d{1,2})\s*(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/,
  )
  if (named) {
    const day = Number(named[1] ?? named[4])
    const monthName = (named[2] ?? named[3]) as string
    const month = months.indexOf(monthName) + 1
    if (day >= 1 && day <= 31 && month >= 1) {
      // A month already past this year means they mean next year.
      const year = month < nowParts.month ? nowParts.year + 1 : nowParts.year
      return placeOnDate(year, month, day, time, hours)
    }
  }

  return null
}

function placeOnDate(
  year: number,
  month: number,
  day: number,
  time: number | null,
  hours: BusinessHours,
): Date {
  if (time !== null) {
    return instantFromLocal(year, month, day, Math.floor(time / 60), time % 60, hours.timezone)
  }
  // No time named: aim at that day's opening time.
  const probe = instantFromLocal(year, month, day, 12, 0, hours.timezone)
  const weekday = localParts(probe, hours.timezone).weekday
  const dayHours = hours.days[weekday]
  const startMin = dayHours ? toMinutes(dayHours.open) : 9 * 60
  return instantFromLocal(year, month, day, Math.floor(startMin / 60), startMin % 60, hours.timezone)
}

/** Exposed for the dashboard's hours editor. */
export function formatDayLabel(index: number): string {
  return DAY_NAMES[index]
}

export { toMinutes as hhmmToMinutes, formatHhMm as minutesToHhMm }

// The free chatbot's "demo booking". It reuses the real agent engine's
// opening-hours logic (resolveSlot), so a visitor asking for "tomorrow 11pm"
// is told the clinic is closed, exactly as a paid agent would say it.
//
// Nothing is stored: the free tool has no tenant and no database. Both tools
// below only produce a result for the model and a "lead card" for the preview,
// so the visitor can SEE what their business would receive. Saving real
// leads is what the paid agent does.

import type { LLMTool } from '@/lib/agent/llm-provider'
import {
  DEFAULT_BUSINESS_HOURS,
  describeHoursForPrompt,
  resolveSlot,
  type BusinessHours,
  type DayHours,
} from '@/lib/agent/business-hours'
import type { KnowledgeChunk } from './knowledge'

/* ── Reading opening hours out of free text ───────────────────────────── */

const DAY_INDEX: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
}
const DAY = '(?:sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)'
const TIME = '(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.)?'
const RANGE_SEP = '\\s*(?:to|till|until|se|-|–|—)\\s*'
const DAYS_GROUP = `${DAY}(?:\\s*(?:to|-|–|—|se|,|&|and)\\s*${DAY})*`

const HOURS_RE = new RegExp(`(${DAYS_GROUP})\\s*[:,\\-–—]?\\s*(?:from\\s*)?${TIME}${RANGE_SEP}${TIME}`, 'gi')
const CLOSED_RE = new RegExp(`(${DAYS_GROUP})\\s*[:,\\-–—]?\\s*(?:is\\s*)?(?:closed|off|holiday)`, 'gi')

function expandDays(group: string): number[] {
  const parts = group.split(/(\s*(?:to|-|–|—|se)\s*|\s*(?:,|&|and)\s*)/i)
  const days: number[] = []
  let rangeFrom: number | null = null
  let pendingRange = false
  for (const part of parts) {
    const t = part.trim().toLowerCase()
    if (!t) continue
    if (/^(to|-|–|—|se)$/.test(t)) { pendingRange = true; continue }
    if (/^(,|&|and)$/.test(t)) { pendingRange = false; continue }
    const idx = DAY_INDEX[t]
    if (idx === undefined) continue
    if (pendingRange && rangeFrom !== null) {
      for (let d: number = rangeFrom; ; d = (d + 1) % 7) {
        if (!days.includes(d)) days.push(d)
        if (d === idx) break
      }
      pendingRange = false
    } else {
      if (!days.includes(idx)) days.push(idx)
    }
    rangeFrom = idx
  }
  return days
}

function toMin(h: string, m: string | undefined, ap: string | undefined): number | null {
  let hour = Number(h)
  const min = m ? Number(m) : 0
  if (hour > 24 || min > 59) return null
  const a = ap?.toLowerCase().replace(/\./g, '')
  if (a === 'pm' && hour < 12) hour += 12
  if (a === 'am' && hour === 12) hour = 0
  return hour * 60 + min
}

const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

/** Weekly hours found in one piece of text, or null if it names none. */
export function hoursFromText(text: string): (DayHours | null)[] | null {
  const days: (DayHours | null | undefined)[] = [undefined, undefined, undefined, undefined, undefined, undefined, undefined]
  let found = false

  for (const m of text.matchAll(HOURS_RE)) {
    const open = toMin(m[2], m[3], m[4])
    let close = toMin(m[5], m[6], m[7])
    if (open === null || close === null) continue
    // "10 - 7" with no am/pm anywhere: the 7 can only be the evening.
    if (close <= open && close < 12 * 60 && !m[7]) close += 12 * 60
    if (close <= open) continue
    for (const d of expandDays(m[1])) {
      if (days[d] === undefined) days[d] = { open: hhmm(open), close: hhmm(close) }
      found = true
    }
  }
  for (const m of text.matchAll(CLOSED_RE)) {
    for (const d of expandDays(m[1])) if (days[d] === undefined) days[d] = null
  }
  if (!found) return null
  return days.map((d) => d ?? null)
}

export interface ResolvedHours {
  hours: BusinessHours
  /** True when the hours came from the website, false when they are our default. */
  fromSite: boolean
}

/** Look in the facts block first, then the footer, then every page of the site. */
export function resolveHours(facts: string, chunks: readonly KnowledgeChunk[], timezone: string): ResolvedHours {
  const factLine = facts.split('\n').find((l) => l.startsWith('Opening hours:'))
  const footerLine = facts.split('\n').find((l) => l.startsWith('Footer text:'))
  const sources = [factLine, footerLine, ...chunks.map((c) => c.text)].filter((x): x is string => !!x)
  for (const text of sources) {
    const days = hoursFromText(text)
    if (days) {
      return { fromSite: true, hours: { timezone, days, slotMinutes: 30, minLeadMinutes: 60 } }
    }
  }
  return { fromSite: false, hours: { ...DEFAULT_BUSINESS_HOURS, timezone } }
}

export function safeTimezone(tz: unknown): string {
  if (typeof tz !== 'string' || !tz || tz.length > 60) return 'Asia/Kolkata'
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return tz
  } catch {
    return 'Asia/Kolkata'
  }
}

/* ── The two tools the model may call ─────────────────────────────────── */

export const BOOKING_TOOLS: LLMTool[] = [
  {
    name: 'book_appointment',
    description:
      'Record an appointment / consultation / visit / demo request. Call it ONLY after the visitor has given their name, phone number and preferred day and time.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: "Visitor's full name" },
        phone: { type: 'string', description: "Visitor's phone number with country code if given" },
        service: { type: 'string', description: 'What the visit is for (treatment, service, topic). Optional.' },
        preferred_date: { type: 'string', description: 'Date as YYYY-MM-DD, worked out from today\'s date. Required.' },
        preferred_time: { type: 'string', description: 'Time as 24-hour HH:MM, e.g. 15:30. Optional.' },
      },
      required: ['name', 'phone', 'preferred_date'],
    },
  },
  {
    name: 'capture_lead',
    description:
      'Record a callback / quote / information request when the visitor does NOT want a specific appointment. Call it ONLY after you have their name and phone number.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: "Visitor's full name" },
        phone: { type: 'string', description: "Visitor's phone number" },
        interest: { type: 'string', description: 'What they are interested in, in a few words' },
      },
      required: ['name', 'phone'],
    },
  },
]

export interface LeadCard {
  kind: 'appointment' | 'lead'
  name: string
  phone: string
  service?: string
  /** "Tuesday 15/10 at 10 AM" for a checked slot, or the visitor's own words. */
  when?: string
  /** True when the time had to be moved to the next open slot. */
  adjusted?: boolean
}

export interface ToolContext {
  hours: ResolvedHours
  now: Date
}

export interface ToolOutcome {
  result: string
  card?: LeadCard
}

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

function validPhone(p: string): boolean {
  const n = p.replace(/\D/g, '').length
  return n >= 8 && n <= 15 && /^[+\d\s().-]+$/.test(p)
}

export function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): ToolOutcome {
  const person = clean(args.name, 60)
  const phone = clean(args.phone, 24)
  if (person.length < 2) return { result: 'Not saved: ask the visitor for their name.' }
  if (!validPhone(phone)) return { result: 'Not saved: that phone number is not valid. Ask the visitor to type it again.' }

  if (name === 'capture_lead') {
    const interest = clean(args.interest, 100)
    return {
      result: 'Request received. Tell the visitor the team will contact them on that number. Do not say anything has been confirmed.',
      card: { kind: 'lead', name: person, phone, service: interest || undefined },
    }
  }

  if (name !== 'book_appointment') return { result: `Unknown tool ${name}.` }

  const service = clean(args.service, 100)
  const date = clean(args.preferred_date, 12)
  const time = clean(args.preferred_time, 8)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { result: 'Not saved: the date is missing or not YYYY-MM-DD. Work it out from today\'s date or ask the visitor.' }
  }

  // No hours on the website: do not pretend to know them.
  if (!ctx.hours.fromSite) {
    const when = `${date}${time ? ` at ${time}` : ''}`
    return {
      result: `Request received for ${when}. This website's opening hours could not be read, so the time is NOT checked: say the team will confirm the time. Do not say it is confirmed.`,
      card: { kind: 'appointment', name: person, phone, service: service || undefined, when },
    }
  }

  const slot = resolveSlot(`${date}${time ? ` ${time}` : ''}`, ctx.hours.hours, ctx.now)
  if (!slot.ok) {
    return { result: `Could not offer a time: ${slot.reason} Ask the visitor to choose another day.` }
  }
  const moved = slot.adjusted
    ? ` The visitor's time did NOT work (${slot.note ?? 'outside opening hours'}), so it was moved to ${slot.label}. Say this clearly and ask if that suits them.`
    : ''
  return {
    result: `Appointment request received for ${slot.label}.${moved} The team will confirm it by phone. Do not say it is confirmed.`,
    card: { kind: 'appointment', name: person, phone, service: service || undefined, when: slot.label, adjusted: slot.adjusted },
  }
}

/** The prompt section: today's date and the hours bookings are checked against. */
export function bookingContext(ctx: ToolContext): string {
  if (ctx.hours.fromSite) {
    return `Opening hours used for booking (read from the website):\n${describeHoursForPrompt(ctx.hours.hours, ctx.now)}`
  }
  const now = new Intl.DateTimeFormat('en-GB', {
    timeZone: ctx.hours.hours.timezone,
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(ctx.now)
  return `Now: ${now} (${ctx.hours.hours.timezone}).\nOpening hours: not found on the website. Do not promise or invent any specific time; say the team will confirm.`
}

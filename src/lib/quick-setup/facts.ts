// src/lib/quick-setup/facts.ts
//
// Quick Setup: turn the owner's plain-language text into a small set of
// STRUCTURED FACTS (fee, timings, address link, phone, what to ask a
// customer), and back into the things the engine already understands:
//
//   - agents.business_hours (JSON the engine reads with parseBusinessHours)
//   - agents.fallback_contact
//   - a text block that goes into the agent's persona
//
// Everything here is a PURE function: no network, no database, no clock.
// That is what makes it unit-testable.
//
// Two ways to get facts, and why both exist:
//   1. extractFactsHeuristic  - simple rules (regex). Free, instant, never
//      invents anything, but cannot read every phrasing.
//   2. the model (see the analyze route) - reads any phrasing, but can
//      hallucinate. Its answer is checked by parseExtractedFacts (schema)
//      and groundFacts (a fee/phone/link/time that is NOT in the owner's
//      text is thrown away). If the model fails, the rules above are used.
//
// The owner always sees the result (summarizeFacts) and confirms it.

import { humanTime, hhmmToMinutes, minutesToHhMm } from '@/lib/agent/business-hours'

export type BusinessKind = 'clinic' | 'coaching' | 'salon' | 'other'

/** One opening window. days: 0 = Sunday ... 6 = Saturday (Date#getDay). */
export interface HoursWindow {
  days: number[]
  /** "HH:MM" 24-hour. */
  open: string
  close: string
  /** True when the owner wrote times but no days, so Mon-Sat was assumed. */
  assumed?: boolean
}

export interface ExtractedFacts {
  business_name: string | null
  business_kind: BusinessKind
  fee_amount: number | null
  /** Always rebuilt from fee_amount ("Rs 800"), never taken from the model. */
  fee_text: string | null
  phone: string | null
  address: string | null
  maps_link: string | null
  hours: HoursWindow[]
  booking_questions: string[]
  services: string[]
}

const KINDS: BusinessKind[] = ['clinic', 'coaching', 'salon', 'other']

/** Fresh empty facts (a new object every call, so nobody can mutate a shared one). */
export function emptyFacts(): ExtractedFacts {
  return {
    business_name: null,
    business_kind: 'other',
    fee_amount: null,
    fee_text: null,
    phone: null,
    address: null,
    maps_link: null,
    hours: [],
    booking_questions: [],
    services: [],
  }
}

/* -----------------------------------------------------------------------
   Small text helpers
   ----------------------------------------------------------------------- */

/**
 * One line of safe text: control characters, angle brackets, backticks and
 * square brackets removed (they could fake a prompt section), spaces
 * collapsed, capped. Empty -> null.
 */
export function cleanLine(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const s = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/[<>`\[\]]/g, '').replace(/\s+/g, ' ').trim()
  if (!s) return null
  return s.length > max ? s.slice(0, max).trim() : s
}

/* -----------------------------------------------------------------------
   Business kind
   ----------------------------------------------------------------------- */

const KIND_PATTERNS: Array<[BusinessKind, RegExp]> = [
  [
    'clinic',
    /\b(?:clinic|hospital|doctor|dr\.?|dentist|dental|dermatolog\w*|pediatric\w*|paediatric\w*|physician|physio\w*|patients?|appointments?|consultation|opd|medical|surgeon|gynec\w*|ortho\w*|mareez|bache)\b/gi,
  ],
  [
    'coaching',
    /\b(?:coaching|classes|class|tuition|tutor\w*|batch(?:es)?|institute|academy|students?|course|admission|syllabus|jee|neet|upsc|board exams?|teacher|vidyarthi)\b/gi,
  ],
  ['salon', /\b(?:salon|parlou?r|spa|beauty|haircut|hair|barber|makeup|facial|bridal|grooming|manicure)\b/gi],
]

/** Which kind of business is this? Most keyword hits wins; ties go clinic > coaching > salon. */
export function detectBusinessKind(text: string): BusinessKind {
  let best: BusinessKind = 'other'
  let bestScore = 0
  for (const [kind, re] of KIND_PATTERNS) {
    const score = (text.match(re) ?? []).length
    if (score > bestScore) {
      best = kind
      bestScore = score
    }
  }
  return best
}

/* -----------------------------------------------------------------------
   Days and times
   ----------------------------------------------------------------------- */

const DAY_INDEX: Record<string, number> = {
  sunday: 0, sun: 0, ravivar: 0, itwar: 0, ravivaar: 0,
  monday: 1, mon: 1, somvar: 1, somwar: 1, sombar: 1,
  tuesday: 2, tues: 2, tue: 2, mangalvar: 2, mangalwar: 2,
  wednesday: 3, wed: 3, budhvar: 3, budhwar: 3,
  thursday: 4, thurs: 4, thur: 4, thu: 4, guruvar: 4, veervar: 4,
  friday: 5, fri: 5, shukravar: 5,
  saturday: 6, sat: 6, shanivar: 6, shaniwar: 6,
}

/** Day name or abbreviation -> 0..6, or null. */
export function dayWordToIndex(word: string): number | null {
  const i = DAY_INDEX[String(word).trim().toLowerCase().replace(/\.$/, '')]
  return i === undefined ? null : i
}

const DAY_WORD_SRC =
  'monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun|somvar|somwar|sombar|mangalvar|mangalwar|budhvar|budhwar|guruvar|veervar|shukravar|shaniwar|shanivar|ravivar|ravivaar|itwar'

/** "Mon-Sat", "Monday se Saturday", "Mon to Fri" */
const DAY_RANGE_SRC = `\\b(${DAY_WORD_SRC})\\b\\.?\\s*(?:-|–|—|to|se|tak|through)\\s*\\b(${DAY_WORD_SRC})\\b`
const DAY_SINGLE_SRC = `\\b(${DAY_WORD_SRC})\\b`

/** Days from a to b inclusive, wrapping past Saturday (Sat-Mon = 6,0,1). */
export function expandDayRange(a: number, b: number): number[] {
  const out: number[] = []
  let d = a
  for (let i = 0; i < 7; i++) {
    out.push(d)
    if (d === b) break
    d = (d + 1) % 7
  }
  return out
}

const CLOSED_SRC = `\\b(${DAY_WORD_SRC})\\b\\s*(?:ko\\s*)?(?:closed?|off|band|bandh|chhutti|holiday)\\b`
const DAILY_RE = /\b(?:daily|everyday|every day|roz|rozana|har din|all days|7 days)\b/i

/** Days the owner says are closed ("Sunday band", "Sun off"). */
export function closedDaysIn(text: string): Set<number> {
  const out = new Set<number>()
  text.replace(new RegExp(CLOSED_SRC, 'gi'), (_m, w: string) => {
    const i = dayWordToIndex(w)
    if (i !== null) out.add(i)
    return ' '
  })
  return out
}

/** All days named in a short piece of text (ranges and single days). Closed-day phrases are ignored. */
export function daysInSegment(segmentRaw: string): number[] {
  const set = new Set<number>()
  const segment = segmentRaw.replace(new RegExp(CLOSED_SRC, 'gi'), ' ')
  if (DAILY_RE.test(segment)) [0, 1, 2, 3, 4, 5, 6].forEach((d) => set.add(d))
  // Ranges first; blank them out so "Mon" of "Mon-Sat" is not counted twice.
  const withoutRanges = segment.replace(new RegExp(DAY_RANGE_SRC, 'gi'), (_m, a: string, b: string) => {
    const ia = dayWordToIndex(a)
    const ib = dayWordToIndex(b)
    if (ia !== null && ib !== null) expandDayRange(ia, ib).forEach((d) => set.add(d))
    return ' '
  })
  withoutRanges.replace(new RegExp(DAY_SINGLE_SRC, 'gi'), (_m, w: string) => {
    const i = dayWordToIndex(w)
    if (i !== null) set.add(i)
    return ' '
  })
  return [...set].sort((x, y) => x - y)
}

const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** [1,2,3,4,5,6] -> "Mon–Sat"; [1,3] -> "Mon, Wed". */
export function formatDays(days: number[]): string {
  const have = new Set(days)
  const runs: number[][] = []
  let cur: number[] = []
  for (const d of DISPLAY_ORDER) {
    if (have.has(d)) cur.push(d)
    else if (cur.length) {
      runs.push(cur)
      cur = []
    }
  }
  if (cur.length) runs.push(cur)
  return runs
    .map((r) => (r.length >= 3 ? `${DAY_SHORT[r[0]]}–${DAY_SHORT[r[r.length - 1]]}` : r.map((d) => DAY_SHORT[d]).join(', ')))
    .join(', ')
}

type Meridiem = 'am' | 'pm' | null

function meridiemOf(raw: string | undefined): Meridiem {
  if (!raw) return null
  return raw.toLowerCase().startsWith('p') ? 'pm' : 'am'
}

function to24(h: number, mer: Meridiem): number {
  if (mer === 'am') return h === 12 ? 0 : h
  if (mer === 'pm') return h === 12 ? 12 : h + 12
  return h
}

const EVENING_RE = /\b(?:shaam|sham|evening|raat|night)\b/i
const MORNING_RE = /\b(?:subah|subha|morning)\b/i

/**
 * Work out minutes-since-midnight for "5-8 PM", "10am to 1pm", "9-5",
 * "17:00-20:00". Returns null when the pair makes no sense.
 */
export function resolveTimeRange(
  h1: number, m1: number, mer1: Meridiem,
  h2: number, m2: number, mer2: Meridiem,
  context: string = '',
): { start: number; end: number } | null {
  if (![h1, m1, h2, m2].every(Number.isFinite)) return null
  if (h1 > 24 || h2 > 24 || m1 > 59 || m2 > 59) return null
  if ((mer1 && (h1 < 1 || h1 > 12)) || (mer2 && (h2 < 1 || h2 > 12))) return null

  let start: number
  let end: number

  if (mer1 || mer2) {
    const startMer = mer1 ?? mer2
    start = to24(h1, startMer) * 60 + m1
    end = to24(h2, mer2 ?? startMer) * 60 + m2
    if (!mer1 && end <= start) start = to24(h1, 'am') * 60 + m1 // "10-1 pm" is 10 AM to 1 PM
    if (!mer2 && end <= start) end = to24(h2, 'pm') * 60 + m2 // "9am-5" is 9 AM to 5 PM
  } else if (h1 >= 13 || h2 >= 13) {
    start = h1 * 60 + m1
    end = h2 * 60 + m2
  } else if (EVENING_RE.test(context) && !MORNING_RE.test(context) && to24(h2, 'pm') > to24(h1, 'pm')) {
    start = to24(h1, 'pm') * 60 + m1
    end = to24(h2, 'pm') * 60 + m2
  } else if (MORNING_RE.test(context) && !EVENING_RE.test(context) && h2 > h1 && h2 <= 12) {
    start = to24(h1, 'am') * 60 + m1
    end = to24(h2, 'am') * 60 + m2
  } else {
    // No hint: 7-12 is morning, 1-6 is afternoon/evening (a clinic that
    // opens at 5 means 5 PM). The end is the first reading after the start.
    start = (h1 >= 7 && h1 <= 12 ? h1 : to24(h1, 'pm')) * 60 + m1
    const endAm = h2 * 60 + m2
    const endPm = to24(h2, 'pm') * 60 + m2
    end = endAm > start ? endAm : endPm
  }

  if (end - start < 30) return null
  if (start < 0 || end > 24 * 60) return null
  if (end === 24 * 60) end = 24 * 60 - 1
  return { start, end }
}

const TIME_RANGE_SRC =
  '(^|[^\\d:.,])(\\d{1,2})(?:[:.](\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)?\\s*(?:-|–|—|to|se|tak)\\s*(\\d{1,2})(?:[:.](\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)?(?![\\d])'

const SEGMENT_BREAK = /[.!?\n;]/

/** Text before `idx` back to the previous sentence break / previous time range. */
function segmentBefore(text: string, idx: number, floor: number): string {
  let seg = text.slice(Math.max(floor, idx - 60), idx)
  const cut = Math.max(seg.lastIndexOf('.'), seg.lastIndexOf('\n'), seg.lastIndexOf(';'), seg.lastIndexOf('!'), seg.lastIndexOf('?'))
  if (cut >= 0) seg = seg.slice(cut + 1)
  return seg
}

function segmentAfter(text: string, idx: number, ceil: number): string {
  let seg = text.slice(idx, Math.min(ceil, idx + 40))
  const m = seg.match(SEGMENT_BREAK)
  if (m && m.index !== undefined) seg = seg.slice(0, m.index)
  return seg
}

/**
 * Pull opening windows out of free text. Understands "Mon-Sat 5-8 PM",
 * "Monday se Saturday shaam 5 se 8 baje", "10am to 1pm, Sat 10-12".
 * When times are given without days, Mon-Sat is assumed and the window is
 * marked `assumed` so the owner is told.
 */
export function extractHoursHeuristic(text: string): HoursWindow[] {
  const found: Array<{ idx: number; end: number; start: number; endMin: number }> = []
  const re = new RegExp(TIME_RANGE_SRC, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const idx = m.index + m[1].length
    const end = m.index + m[0].length
    const ctx = text.slice(Math.max(0, idx - 25), Math.min(text.length, end + 25))
    const r = resolveTimeRange(
      Number(m[2]), m[3] ? Number(m[3]) : 0, meridiemOf(m[4]),
      Number(m[5]), m[6] ? Number(m[6]) : 0, meridiemOf(m[7]),
      ctx,
    )
    if (r) found.push({ idx, end, start: r.start, endMin: r.end })
    if (re.lastIndex === m.index) re.lastIndex++
  }

  const windows: HoursWindow[] = []
  const closed = closedDaysIn(text)
  let floor = 0
  let prev: { days: number[]; assumed: boolean } | null = null
  found.forEach((f, i) => {
    const nextIdx = i + 1 < found.length ? found[i + 1].idx : text.length
    let days = daysInSegment(segmentBefore(text, f.idx, floor))
    if (days.length === 0) days = daysInSegment(segmentAfter(text, f.end, nextIdx))
    let assumed = false
    if (days.length === 0) {
      // "Mon-Sat 7-9 am and 5-7 pm": the second window shares the first one's days.
      if (prev) {
        days = prev.days
        assumed = prev.assumed
      } else {
        days = [1, 2, 3, 4, 5, 6]
        assumed = true
      }
    }
    prev = { days, assumed }
    days = days.filter((d) => !closed.has(d))
    floor = f.end
    if (days.length === 0) return

    const open = minutesToHhMm(f.start)
    const close = minutesToHhMm(f.endMin)
    const same = windows.find((w) => w.open === open && w.close === close)
    if (same) {
      same.days = [...new Set([...same.days, ...days])].sort((a, b) => a - b)
      if (!assumed) delete same.assumed
    } else if (windows.length < 7) {
      windows.push({ days, open, close, ...(assumed ? { assumed: true } : {}) })
    }
  })
  return windows
}

/* -----------------------------------------------------------------------
   Other fields from rules
   ----------------------------------------------------------------------- */

const MONEY_BEFORE_SRC = '(?:₹|\\brs\\b\\.?|\\binr\\b|\\brupees?\\b)\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)'
const MONEY_AFTER_SRC = '(^|[^\\d.,])([0-9][0-9,]*)\\s*(?:₹|\\brs\\b|\\brupees?\\b|\\brupaye\\b|\\brupay\\w*|/-)'

/** Parse "1,200" -> 1200. Only 1..1,000,000 counts as a fee. */
export function parseAmount(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ''))
  if (!Number.isFinite(n) || n < 1 || n > 1_000_000) return null
  return Math.round(n * 100) / 100
}

export function extractFeeHeuristic(text: string): number | null {
  const hits: Array<{ amount: number; idx: number }> = []
  let m: RegExpExecArray | null
  const a = new RegExp(MONEY_BEFORE_SRC, 'gi')
  while ((m = a.exec(text)) !== null) {
    const amount = parseAmount(m[1])
    if (amount !== null) hits.push({ amount, idx: m.index })
  }
  const b = new RegExp(MONEY_AFTER_SRC, 'gi')
  while ((m = b.exec(text)) !== null) {
    const amount = parseAmount(m[2])
    if (amount !== null) hits.push({ amount, idx: m.index })
  }
  if (hits.length === 0) return null
  hits.sort((x, y) => x.idx - y.idx)
  // Several different prices (a salon menu): do not pick one and call it "the fee".
  // The prices stay in the owner's text, which the assistant reads in full.
  if (new Set(hits.map((h) => h.amount)).size > 1) return null
  return hits[0].amount
}

const PHONE_RE = /(^|[^\d])((?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5})(?!\d)/

export function extractPhoneHeuristic(text: string): string | null {
  const m = text.match(PHONE_RE)
  if (!m) return null
  const digits = m[2].replace(/\D/g, '')
  const ten = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
  if (ten.length !== 10) return null
  return `${ten.slice(0, 5)} ${ten.slice(5)}`
}

export function extractLinkHeuristic(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"')\]]+/i)
  if (!m) return null
  const link = m[0].replace(/[.,;!?]+$/, '')
  return link.length <= 300 ? link : null
}

const NAME_BUSINESS_RE =
  /\b((?:[A-Z][\w&'.-]*\s+){1,3}(?:Clinic|Classes|Coaching|Institute|Academy|Salon|Hospital|Centre|Center|Studio|Parlour|Parlor|Dental|Care))\b/
const NAME_PERSON_RE = /\b(?:main|mai|mein|i am|i'm|this is|we are|hum|yeh|ye)\s+((?:dr\.?|doctor|mr\.?|ms\.?|mrs\.?)\s*[A-Za-z]+(?:\s+[A-Za-z]+)?)/i
const NAME_STOP = /\s+(?:hoon|hun|hu|hai|here|and|from|in|ka|ki|ke|se|ek|at)\b.*$/i

export function extractNameHeuristic(text: string): string | null {
  const b = text.match(NAME_BUSINESS_RE)
  if (b) return cleanLine(b[1], 60)
  const p = text.match(NAME_PERSON_RE)
  if (p) return cleanLine(p[1].replace(NAME_STOP, ''), 60)
  return null
}

const ASK_WORDS = /\b(?:ask|collect|poochh?\w*|puch\w*|pooch\w*|maang\w*|le lo|lena)\b/i
const QUESTION_TOKENS: Array<[RegExp, string]> = [
  [/\b(?:name|naam)\b/i, 'Name'],
  [/\b(?:child|bache|bachche|beta|baby)\w*\s*(?:ki|ka|ke|'s)?\s*(?:age|umar|umr)\b/i, "Child's age"],
  [/\b(?:age|umar|umr)\b/i, 'Age'],
  [/\b(?:class|standard|grade)\b/i, 'Class'],
  [/\b(?:subject|vishay)\b/i, 'Subject'],
  [/\b(?:service|treatment|style)\b/i, 'Service wanted'],
]

export function extractQuestionsHeuristic(text: string): string[] {
  if (!ASK_WORDS.test(text)) return []
  const out: string[] = []
  for (const [re, label] of QUESTION_TOKENS) {
    if (re.test(text) && !out.includes(label)) out.push(label)
  }
  // "Child's age" already covers plain "Age".
  const filtered = out.includes("Child's age") ? out.filter((q) => q !== 'Age') : out
  return filtered.slice(0, 5)
}

export function formatFee(amount: number): string {
  return `Rs ${Number.isInteger(amount) ? amount : amount.toFixed(2)}`
}

/** Everything the simple rules can find. Never throws. */
export function extractFactsHeuristic(text: string): ExtractedFacts {
  const src = typeof text === 'string' ? text : ''
  const fee = extractFeeHeuristic(src)
  return {
    business_name: extractNameHeuristic(src),
    business_kind: detectBusinessKind(src),
    fee_amount: fee,
    fee_text: fee === null ? null : formatFee(fee),
    phone: extractPhoneHeuristic(src),
    address: null,
    maps_link: extractLinkHeuristic(src),
    hours: extractHoursHeuristic(src),
    booking_questions: extractQuestionsHeuristic(src),
    services: [],
  }
}

/* -----------------------------------------------------------------------
   Schema: accept what the model (or the browser) sends, trust nothing
   ----------------------------------------------------------------------- */

function normHhMm(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const m = v.trim().match(/^(\d{1,2})[:.](\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function parseWindow(v: unknown): HoursWindow | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const open = normHhMm(o.open)
  const close = normHhMm(o.close)
  if (!open || !close || hhmmToMinutes(close) <= hhmmToMinutes(open)) return null
  const rawDays = Array.isArray(o.days) ? o.days : []
  const days = new Set<number>()
  for (const d of rawDays) {
    if (typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6) days.add(d)
    else if (typeof d === 'string') {
      const i = /^\d$/.test(d.trim()) ? Number(d.trim()) : dayWordToIndex(d)
      if (i !== null && i >= 0 && i <= 6) days.add(i)
    }
  }
  if (days.size === 0) return null
  return { days: [...days].sort((a, b) => a - b), open, close, ...(o.assumed === true ? { assumed: true } : {}) }
}

function stringList(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const item of v) {
    const s = cleanLine(item, maxLen)
    if (s && !out.includes(s)) out.push(s)
    if (out.length >= maxItems) break
  }
  return out
}

/** Pull the first JSON object out of a model reply (handles ``` fences and chatter). */
export function extractJsonObject(raw: string): unknown | null {
  const s = raw.trim()
  if (!s) return null
  const unfenced = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(unfenced)
  } catch {
    const a = unfenced.indexOf('{')
    const b = unfenced.lastIndexOf('}')
    if (a < 0 || b <= a) return null
    try {
      return JSON.parse(unfenced.slice(a, b + 1))
    } catch {
      return null
    }
  }
}

/**
 * Validate anything claiming to be facts. `ok` is false when the input is
 * not an object at all (garbage / not JSON); a valid object with odd
 * fields still gives ok = true with those fields dropped.
 */
export function parseExtractedFacts(raw: unknown): { ok: boolean; facts: ExtractedFacts } {
  const value = typeof raw === 'string' ? extractJsonObject(raw) : raw
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, facts: emptyFacts() }
  const o = value as Record<string, unknown>

  const feeRaw = typeof o.fee_amount === 'number' ? o.fee_amount : typeof o.fee_amount === 'string' ? parseAmount(o.fee_amount) : null
  const fee = feeRaw !== null && Number.isFinite(feeRaw) && feeRaw >= 1 && feeRaw <= 1_000_000 ? Math.round(feeRaw * 100) / 100 : null

  const phoneStr = cleanLine(o.phone, 24)
  const phoneDigits = phoneStr ? phoneStr.replace(/\D/g, '') : ''
  const phone = phoneStr && phoneDigits.length >= 8 && phoneDigits.length <= 15 ? phoneStr : null

  const linkRaw = cleanLine(o.maps_link, 300)
  const maps_link = linkRaw && /^https?:\/\/\S+$/i.test(linkRaw) ? linkRaw : null

  const hours: HoursWindow[] = []
  if (Array.isArray(o.hours)) {
    for (const w of o.hours) {
      const parsed = parseWindow(w)
      if (parsed) hours.push(parsed)
      if (hours.length >= 7) break
    }
  }

  const kindRaw = typeof o.business_kind === 'string' ? (o.business_kind.toLowerCase() as BusinessKind) : 'other'

  return {
    ok: true,
    facts: {
      business_name: cleanLine(o.business_name, 60),
      business_kind: KINDS.includes(kindRaw) ? kindRaw : 'other',
      fee_amount: fee,
      fee_text: fee === null ? null : formatFee(fee),
      phone,
      address: cleanLine(o.address, 160),
      maps_link,
      hours,
      booking_questions: stringList(o.booking_questions, 5, 80),
      services: stringList(o.services, 8, 60),
    },
  }
}

/* -----------------------------------------------------------------------
   Grounding: drop anything the owner did not actually write
   ----------------------------------------------------------------------- */

/** Is this exact number written in the text as a stand-alone number? */
function numberAppears(text: string, n: number): boolean {
  return new RegExp(`(^|[^\\d])0?${n}(?![\\d])`).test(text)
}

/**
 * Does the text contain this time? It must contain the hour as written in
 * 12-hour or 24-hour form ("5" or "17" for 17:00) and, for times with
 * minutes, the minutes too. A window the owner never wrote fails this.
 */
export function timeAppears(text: string, hhmm: string): boolean {
  const [h, m] = hhmm.split(':').map(Number)
  const h12 = h % 12 === 0 ? 12 : h % 12
  const hourOk = numberAppears(text, h) || numberAppears(text, h12) || (h === 0 && numberAppears(text, 24))
  const minuteOk = m === 0 || new RegExp(`(^|[^\\d])${String(m).padStart(2, '0')}(?![\\d])`).test(text)
  return hourOk && minuteOk
}

/**
 * The model may "helpfully" invent a fee or a phone number. Keep a value
 * only if it can be found in the owner's own text.
 */
export function groundFacts(facts: ExtractedFacts, ownerText: string): ExtractedFacts {
  const text = typeof ownerText === 'string' ? ownerText : ''
  const compact = text.replace(/,/g, '')
  const digitsOnly = text.replace(/\D/g, '')
  const out: ExtractedFacts = {
    ...facts,
    hours: [...facts.hours],
    booking_questions: [...facts.booking_questions],
    services: [...facts.services],
  }

  if (out.fee_amount !== null) {
    const asText = String(out.fee_amount).replace('.', '\\.')
    const found = new RegExp(`(^|[^\\d.])${asText}(?![\\d])`).test(compact)
    if (!found) {
      out.fee_amount = null
      out.fee_text = null
    }
  }
  if (out.phone !== null) {
    const d = out.phone.replace(/\D/g, '')
    const ten = d.length > 10 ? d.slice(-10) : d
    if (!digitsOnly.includes(ten)) out.phone = null
  }
  if (out.maps_link !== null && !text.includes(out.maps_link)) out.maps_link = null
  out.hours = out.hours.filter((w) => timeAppears(text, w.open) && timeAppears(text, w.close))
  if (out.address !== null) {
    // An address the owner never wrote is an invented address. Compare on
    // the first 12 characters, ignoring case and spacing.
    const probe = out.address.toLowerCase().replace(/\s+/g, ' ').slice(0, 12)
    if (probe.length >= 4 && !text.toLowerCase().replace(/\s+/g, ' ').includes(probe)) out.address = null
  }
  return out
}

/** Prefer `primary` per field; fall back to `fallback` where it has nothing. */
export function mergeFacts(primary: ExtractedFacts, fallback: ExtractedFacts): ExtractedFacts {
  return {
    business_name: primary.business_name ?? fallback.business_name,
    business_kind: primary.business_kind !== 'other' ? primary.business_kind : fallback.business_kind,
    fee_amount: primary.fee_amount ?? fallback.fee_amount,
    fee_text: primary.fee_amount !== null ? primary.fee_text : fallback.fee_text,
    phone: primary.phone ?? fallback.phone,
    address: primary.address ?? fallback.address,
    maps_link: primary.maps_link ?? fallback.maps_link,
    hours: primary.hours.length > 0 ? primary.hours : fallback.hours,
    booking_questions: primary.booking_questions.length > 0 ? primary.booking_questions : fallback.booking_questions,
    services: primary.services.length > 0 ? primary.services : fallback.services,
  }
}

/* -----------------------------------------------------------------------
   Facts -> what the engine reads
   ----------------------------------------------------------------------- */

export interface BusinessHoursJson {
  timezone: string
  days: Array<{ open: string; close: string } | null>
  slotMinutes: number
  minLeadMinutes: number
}

/**
 * The value for agents.business_hours, or null when no hours were found
 * (then the caller must NOT overwrite hours the owner set elsewhere).
 * Days that are not listed are closed.
 */
export function factsToBusinessHours(facts: ExtractedFacts): BusinessHoursJson | null {
  if (facts.hours.length === 0) return null
  return { timezone: 'Asia/Kolkata', days: perDayWindows(facts.hours), slotMinutes: 30, minLeadMinutes: 60 }
}

/**
 * The engine supports ONE opening window per day. If the owner wrote two
 * (a morning and an evening shift), keep the longer one (the later one on a
 * tie). That can only lose bookable time, never offer a time the owner did
 * not state, which is the safe direction.
 */
export function perDayWindows(windows: HoursWindow[]): BusinessHoursJson['days'] {
  const days: BusinessHoursJson['days'] = [null, null, null, null, null, null, null]
  for (const w of windows) {
    const len = hhmmToMinutes(w.close) - hhmmToMinutes(w.open)
    for (const d of w.days) {
      const cur = days[d]
      const curLen = cur ? hhmmToMinutes(cur.close) - hhmmToMinutes(cur.open) : -1
      if (len >= curLen) days[d] = { open: w.open, close: w.close }
    }
  }
  return days
}

/** Days that have more than one window written (so only one can be used). */
export function splitShiftDays(windows: HoursWindow[]): number[] {
  const count = new Array<number>(7).fill(0)
  for (const w of windows) for (const d of w.days) count[d]++
  return count.map((c, d) => (c > 1 ? d : -1)).filter((d) => d >= 0)
}

/** The windows the engine will really use (one per day, days with the same window grouped). */
export function effectiveWindows(windows: HoursWindow[]): HoursWindow[] {
  const perDay = perDayWindows(windows)
  const assumed = windows.some((w) => w.assumed)
  const groups = new Map<string, HoursWindow>()
  perDay.forEach((w, d) => {
    if (!w) return
    const key = `${w.open}-${w.close}`
    const g = groups.get(key)
    if (g) g.days.push(d)
    else groups.set(key, { days: [d], open: w.open, close: w.close, ...(assumed ? { assumed: true } : {}) })
  })
  return [...groups.values()]
}

export function formatHoursWindow(w: HoursWindow): string {
  return `${formatDays(w.days)} ${humanTime(hhmmToMinutes(w.open))}–${humanTime(hhmmToMinutes(w.close))}`
}

export interface SummaryLine {
  key: 'name' | 'fee' | 'hours' | 'address' | 'phone' | 'asks'
  label: string
  /** null = not found in the owner's text. */
  value: string | null
  /** Plain-English note shown under the line. */
  note?: string
}

/** What the owner is shown to confirm. */
export function summarizeFacts(facts: ExtractedFacts): SummaryLine[] {
  const effective = effectiveWindows(facts.hours)
  const hoursValue = effective.length > 0 ? effective.map(formatHoursWindow).join('; ') : null
  const assumed = facts.hours.some((w) => w.assumed)
  const split = splitShiftDays(facts.hours).length > 0
  const address = [facts.address, facts.maps_link].filter(Boolean).join(' ')
  return [
    { key: 'name', label: 'Business', value: facts.business_name },
    {
      key: 'fee',
      label: 'Fees',
      value: facts.fee_text,
      note: facts.fee_text ? undefined : 'No single fee found. If you wrote several prices, the assistant will quote them from your text.',
    },
    {
      key: 'hours',
      label: 'Timings',
      value: hoursValue,
      note: hoursValue
        ? [
            assumed
              ? 'You did not write the days, so Monday to Saturday was assumed. Add the days to your text if this is wrong.'
              : 'Appointments will only be offered inside these timings.',
            split ? 'You wrote two timing windows on the same day. AiSend uses one window per day, so only the longer one is used.' : '',
          ].filter(Boolean).join(' ')
        : 'Not found. Standard hours (Mon–Fri 10 AM–7 PM, Sat 10 AM–5 PM, Sun closed) will be used for new setups. Add your timings to the text to change this.',
    },
    {
      key: 'address',
      label: 'Address / link',
      value: address || null,
      note: address ? undefined : 'Not found. The assistant will not give an address.',
    },
    {
      key: 'phone',
      label: 'Phone for urgent cases',
      value: facts.phone,
      note: facts.phone ? undefined : 'Not found. For urgent cases the assistant will say the team will contact the customer.',
    },
    { key: 'asks', label: 'Asks before booking', value: facts.booking_questions.length ? facts.booking_questions.join(', ') : null },
  ]
}

/**
 * The facts as a block of text for the persona. Every value was passed
 * through cleanLine, so none can open a fake "[section]" in the prompt.
 */
export function factsToPromptBlock(facts: ExtractedFacts): string {
  const lines: string[] = ['[Business facts confirmed by the owner]']
  if (facts.business_name) lines.push(`- Business: ${facts.business_name}`)
  if (facts.fee_text) lines.push(`- Fee: ${facts.fee_text}`)
  if (facts.hours.length > 0) lines.push(`- Timings: ${effectiveWindows(facts.hours).map(formatHoursWindow).join('; ')} (India time)`)
  if (facts.address) lines.push(`- Address: ${facts.address}`)
  if (facts.maps_link) lines.push(`- Address link: ${facts.maps_link}`)
  if (facts.phone) lines.push(`- Phone: ${facts.phone}`)
  if (facts.services.length > 0) lines.push(`- Services: ${facts.services.join(', ')}`)
  if (facts.booking_questions.length > 0) lines.push(`- Ask the customer before booking: ${facts.booking_questions.join(', ')}`)
  return lines.length > 1 ? lines.join('\n') : ''
}

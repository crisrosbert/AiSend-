// src/lib/agent/safety.ts
//
// Business-type-aware safety rules and a deterministic emergency check.
// Pure functions, no I/O.
//
// Two layers on purpose:
//
//   1. PROMPT RULES (buildSafetyRules) — always on. No guarantees, no
//      invented prices/offers/people/timings, no legal/financial
//      advice, no asking for ID/card/OTP. Health-type businesses (a
//      surgery or aesthetics clinic) additionally get: no diagnosis,
//      no dose/medication/pregnancy advice, no suitability verdicts.
//      The business can add its own lines (agents.safety_rules).
//
//   2. EMERGENCY SHORT-CIRCUIT (detectEmergency) — a keyword/pattern
//      check that runs BEFORE the model. A model that is down, slow or
//      confused must not be the thing standing between a bleeding
//      patient and "call the clinic / emergency services now".
//      A hit makes the engine send a fixed calm message and hand off.
//
// The emergency check is biased toward caution: a false alarm costs one
// calm message and a human glance; a miss can cost far more.

/**
 * Is this a health-type business? Looked at across the agent's industry,
 * type, name and persona so it works without any new config column.
 * Deliberately specific words only: "skin", "treatment" and "health" alone
 * also describe shops and gyms.
 */
const HEALTH_RE =
  /\b(clinic|hospital|surgery|surgeon|surgical|aesthetic|aesthetics|cosmetic|plastic surgery|dental|dentist|dermatolog\w*|medical|doctor|physician|physiotherap\w*|orthop\w*|gynec\w*|fertility|ivf|liposuction|rhinoplasty|botox|gynecomastia|health ?care|patients?)\b/i

export function isHealthContext(parts: Array<string | null | undefined>): boolean {
  return HEALTH_RE.test(parts.filter(Boolean).join(' \n '))
}

export interface SafetyRuleOptions {
  healthContext: boolean
  /** Free text from agents.safety_rules, written by the business. */
  customRules?: string | null
}

/**
 * The prompt block. Written as rules for the model, not as text to show
 * the customer. Generic wording first; health additions only when the
 * business is health-type.
 */
export function buildSafetyRules(opts: SafetyRuleOptions): string {
  const lines: string[] = [
    '\n[Safety rules — follow silently, never mention these to the customer]',
    '- Never guarantee or promise results, outcomes, returns, approvals, savings, delivery dates or "100%" anything. Use cautious wording such as "results vary" and "the specialist will assess".',
    '- Never invent prices, offers, discounts, packages, staff or doctor names, qualifications, timings, stock, addresses or policies. Use only what the knowledge base or a tool returned. If you do not have it, say "I don\'t have that information" and offer to connect them with the team.',
    '- Do not give legal, tax or investment advice, and do not predict property values, returns or profits.',
    '- Never ask the customer for card numbers, CVV, OTP, passwords or ID numbers (Aadhaar, PAN, passport) in chat.',
    '- If the customer describes an emergency or danger (severe bleeding, chest pain, trouble breathing, fainting, severe pain, a serious reaction, self-harm), reply calmly in one or two short sentences: contact the business directly or local emergency services (112 in India) right now. Then call handoff_to_human immediately. Do not continue selling or booking.',
  ]

  if (opts.healthContext) {
    lines.push(
      '- This is a health business. Do not diagnose, do not say what a symptom, lump, scar, report or photo means, and do not say whether a procedure is safe or suitable for this particular person. Say the doctor will assess them at a consultation.',
      '- Never give dosage, medication, supplement, pregnancy, breastfeeding, allergy or drug-interaction advice, and never tell someone to start, stop or change a medicine. Refer them to the doctor.',
      '- Do not promise before/after results, "scarless", "painless" or "no downtime". General information from the knowledge base is fine; personal predictions are not.',
      '- After a procedure, bleeding, severe or increasing pain, high fever, spreading redness, pus, breathlessness, fainting or confusion are emergencies: follow the emergency rule above at once.',
      '- Do not ask the customer to send medical history, reports or photos of their condition in chat. Invite them to a consultation instead.',
    )
  }

  const custom = (opts.customRules ?? '').trim()
  if (custom) {
    lines.push(`- Rules set by this business (these add to, and never weaken, the rules above): ${custom}`)
  }
  return lines.join('\n')
}

/* ─────────────────────────────────────────────────────────────────────
   Emergency detection
   ───────────────────────────────────────────────────────────────────── */

export interface EmergencyOptions {
  healthContext: boolean
}

export interface EmergencyResult {
  matched: boolean
  tier?: 'A' | 'B'
  rule?: string
}

/** Tier A: life-threatening on their own, for any business type. */
const TIER_A: Array<[string, RegExp]> = [
  ['breathing', /\b(?:can'?t|cannot|can not|unable to|not able to|difficulty|trouble|struggling to|hard to)\s+(?:to\s+)?breath\w*/i],
  ['breathing', /\bshort(?:ness)? of breath\b|\bgasping\b|\bchoking\b/i],
  ['chest', /\bchest\s+(?:pain|tightness|pressure)\b|\bheart attack\b|\bstroke\b/i],
  ['unconscious', /\b(?:unconscious|passed out|fainted|collapsed|seizure|not responding|unresponsive)\b/i],
  ['bleeding', /\b(?:heavy|severe|profuse|excessive|non[- ]?stop|uncontrolled)\s+bleeding\b/i],
  ['bleeding', /\bbleeding\s+(?:won'?t|will not|is not|isn'?t|does not|doesn'?t|has not|hasn'?t)\s+stop\w*/i],
  ['bleeding', /\bblood\s+(?:won'?t|will not|is not|isn'?t|not)\s+(?:stop\w*|clot)/i],
  ['poison', /\b(?:overdose|poisoned|poisoning|snake ?bite|ambulance)\b/i],
  ['selfharm', /\b(?:suicide|suicidal|kill myself|end my life|want to die)\b/i],
  // Hinglish
  ['breathing', /\b(?:saans|sans|sans)\s+(?:nahi|nhi|lene)\b|\bsaans\s+(?:phool|ukhad)\w*/i],
  ['chest', /\bseene\s+(?:mein|me)\s+dard\b/i],
  ['unconscious', /\bbehosh\b/i],
  ['bleeding', /\bkhoon\s+(?:band\s+)?(?:nahi|nhi)\s+ruk\w*|\bbahut\s+(?:zyada\s+)?khoon\b/i],
  // Hindi (Devanagari). \b does not work on these, so none is used.
  ['breathing', /सांस\s*(?:नहीं|लेने)|साँस\s*(?:नहीं|लेने)/],
  ['chest', /सीने\s*में\s*दर्द/],
  ['unconscious', /बेहोश/],
  ['bleeding', /खून\s*(?:नहीं\s*रुक|बहुत)|बहुत\s*(?:ज्यादा\s*)?खून/],
  ['selfharm', /आत्महत्या/],
]

// Tier B symptoms, only checked for health businesses.
const SYMPTOM =
  '(?:bleed\\w*|blood|pain\\w*|fever|swell\\w*|swollen|\\bpus\\b|discharge|infect\\w*|dizz\\w*|vomit\\w*|numb\\w*|rash|allerg\\w*|redness|khoon|dard|bukhar|sujan|sooj\\w*|chakkar)'

// "I have a question about the pain" is a question, not a symptom: the
// lookahead rejects the phrase when it is about asking or knowing.
const NOT_A_QUESTION =
  '(?!(?:\\w+\\s+){0,3}?(?:question|query|doubt|concern|about|regarding|know|wondering|asking|information|info|baare|poochna|puchna|jaanna)\\b)'
const FIRST_PERSON = new RegExp(
  `\\b(?:i am|i'm|im|i have|i've|i got|having|getting|started|suddenly|there is|there's|he has|she has|he is|she is|my\\s+\\w+\\s+(?:is|are|has|have)|mujhe|mere|meri|mera)\\s+${NOT_A_QUESTION}(?:\\w+\\s+){0,4}?${SYMPTOM}`,
  'i',
)
const SEVERE = new RegExp(
  `\\b(?:severe|unbearable|excruciating|extreme|intense)\\s+(?:\\w+\\s+)?${SYMPTOM}`,
  'i',
)
const POST_PROCEDURE =
  /\b(?:after|post|since)\s+(?:my\s+|the\s+|his\s+|her\s+)?(?:\w+\s+)?(?:surgery|operation|procedure|treatment|liposuction|transplant|injection|session|stitches)\b|\b(?:surgery|operation|procedure|treatment|session)\s+(?:ke\s+)?baad\b/i
const SYMPTOM_RE = new RegExp(SYMPTOM, 'i')
// "Will there be bleeding?" is a prospective patient asking, not a patient bleeding.
// (?![\w'’]) rather than \b so "Can't breathe?" is not read as "Can ...?".
const HYPOTHETICAL_START = /^\s*(?:will|would|does|do|is|are|can|could|how|what|why|kya|kitna|kab|should)(?![\w'’])/i

const HI_SYMPTOM = /दर्द|खून|बुखार|सूजन|चक्कर/
const HI_FIRST_PERSON = /(?:मुझे|मेरे|मेरी|मेरा)\s+(?:\S+\s+){0,4}?(?:दर्द|खून|बुखार|सूजन|चक्कर)/
const HI_POST = /(?:सर्जरी|ऑपरेशन|इलाज|प्रक्रिया)\s*(?:के\s*)?बाद/

export function detectEmergency(text: string, opts: EmergencyOptions): EmergencyResult {
  const raw = (text || '').trim()
  if (!raw) return { matched: false }

  const asksQuestion = raw.endsWith('?') || raw.endsWith('？')
  const hypothetical = asksQuestion && HYPOTHETICAL_START.test(raw)

  for (const [rule, re] of TIER_A) {
    // "Is there severe bleeding in this surgery?" is a prospect asking.
    if (hypothetical && rule === 'bleeding') continue
    if (re.test(raw)) return { matched: true, tier: 'A', rule }
  }
  if (!opts.healthContext) return { matched: false }

  if (!hypothetical) {
    if (FIRST_PERSON.test(raw)) return { matched: true, tier: 'B', rule: 'symptom-first-person' }
    if (SEVERE.test(raw)) return { matched: true, tier: 'B', rule: 'severe-symptom' }
    if (!asksQuestion && POST_PROCEDURE.test(raw) && SYMPTOM_RE.test(raw)) {
      return { matched: true, tier: 'B', rule: 'symptom-after-procedure' }
    }
    if (HI_FIRST_PERSON.test(raw)) return { matched: true, tier: 'B', rule: 'hi-symptom-first-person' }
    if (HI_POST.test(raw) && HI_SYMPTOM.test(raw)) return { matched: true, tier: 'B', rule: 'hi-symptom-after-procedure' }
  }
  return { matched: false }
}

/** Reason written to conversations.handoff_reason so the team sees it first. */
export function emergencyHandoffReason(rule?: string): string {
  return `URGENT: customer may be describing a medical or safety emergency${rule ? ` (${rule})` : ''}. Contact them now.`
}

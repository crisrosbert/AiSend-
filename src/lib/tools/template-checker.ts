// src/lib/tools/template-checker.ts
//
// Checks a WhatsApp message template against the rules Meta documents for the
// Cloud API, and turns it into the JSON that creates the template.
//
// What is a hard rule and what is a judgement call:
//  - error   = Meta's own limit or format rule; the template will be refused
//              (name format, length limits, variable format, button limits…).
//  - warning = a common cause of rejection or of being treated as a different
//              category. These are judgement calls based on Meta's published
//              guidance, so a warning is a reason to look again, not a verdict.
//  - tip     = good practice that does not affect approval.
// Meta makes the final decision. This catches the mistakes people make most.

export type TemplateCategory = 'marketing' | 'utility' | 'authentication'
export type ButtonType = 'quick_reply' | 'url' | 'phone' | 'copy_code'

export interface TemplateButton {
  type: ButtonType
  text: string
  /** Link, phone number or example coupon code. Empty for quick replies. */
  value: string
  /** Example for the {{1}} at the end of a link. */
  sample?: string
}

export interface TemplateInput {
  name: string
  category: TemplateCategory
  language: string
  headerText: string
  headerSample: string
  body: string
  /** Example values for {{1}}, {{2}}… (the first item is {{1}}). */
  bodySamples: string[]
  footer: string
  buttons: TemplateButton[]
  /** Authentication templates have a fixed body, so only these are set. */
  auth: { securityNote: boolean; expiryMinutes: number | null; buttonText: string }
}

export type Severity = 'error' | 'warning' | 'tip'

export interface Finding {
  id: string
  severity: Severity
  title: string
  detail: string
}

export interface CheckResult {
  findings: Finding[]
  errors: number
  warnings: number
  tips: number
  /** No hard-rule problems. Warnings may still be worth a look. */
  ready: boolean
}

export const LIMITS = {
  name: 512,
  header: 60,
  body: 1024,
  footer: 60,
  buttonText: 25,
  urlLength: 2000,
  buttons: 10,
  urls: 2,
  phones: 1,
  copyCodes: 1,
  expiryMin: 1,
  expiryMax: 90,
} as const

const VARIABLE = /\{\{(\d+)\}\}/g
const MAX_VARIABLES_CHECKED = 100
const LIST_AT_MOST = 6

/** "a, b, c" for a short list, "a, b, c and 4 more" for a long one. */
function listSome(items: readonly string[]): string {
  if (items.length <= LIST_AT_MOST) return items.join(', ')
  return `${items.slice(0, LIST_AT_MOST).join(', ')} and ${items.length - LIST_AT_MOST} more`
}

export function findVariables(text: string): { numbers: number[]; malformed: boolean } {
  const numbers = Array.from(text.matchAll(VARIABLE), (m) => Number(m[1]))
  const leftover = text.replace(VARIABLE, '')
  return { numbers, malformed: /[{}]/.test(leftover) }
}

export function renderWithSamples(text: string, samples: readonly string[]): string {
  return text.replace(VARIABLE, (whole, n: string) => {
    const sample = samples[Number(n) - 1]?.trim()
    return sample ? sample : whole
  })
}

const SHORTENERS = /\b(?:bit\.ly|tinyurl\.com|goo\.gl|t\.co|ow\.ly|rb\.gy|cutt\.ly|is\.gd|shorturl\.at)(?:\/|$)/i
const PROMO =
  /\b(?:discount|sale|offers?|coupon|promo|cashback|deals?|exclusive|hurry|bargain|clearance)\b|\d\s?% ?off|buy now|shop now|limited time|use code|free gift/i
const ORDER_CONTEXT =
  /\b(?:order|booking|appointment|payment|invoice|receipt|account|delivery|delivered|shipment|shipped|ticket|refund|return|subscription|reservation|transaction|balance|statement|registration|request|application|visit|claim|policy)\b/i
const SENSITIVE =
  /\b(?:cvv|cvc|card number|aadhaar|aadhar|pan number|upi pin|atm pin|bank account number)\b/i
const THREAT = /\b(?:legal action|court|police|arrest|lawsuit|sue you|lawyer|jail)\b/i
const OPT_OUT = /stop|unsubscribe|opt.?out|not interested/i

function pushIf(list: Finding[], cond: boolean, f: Finding) {
  if (cond) list.push(f)
}

function placeholderFree(text: string): string {
  return text.replace(VARIABLE, '').replace(/\s+/g, ' ').trim()
}

export function checkTemplate(input: TemplateInput): CheckResult {
  const f: Finding[] = []
  const name = input.name.trim()

  // ── name ──────────────────────────────────────────────────────────────
  pushIf(f, name === '', {
    id: 'name-required', severity: 'error', title: 'Give the template a name',
    detail: 'Every template needs a name, such as order_shipped_v1. You use it when you send the template.',
  })
  pushIf(f, name !== '' && !/^[a-z0-9_]+$/.test(name), {
    id: 'name-format', severity: 'error', title: 'Use only lowercase letters, numbers and underscores in the name',
    detail: 'Spaces, capitals and dashes are not allowed. For example, "Order Shipped" becomes order_shipped.',
  })
  pushIf(f, name.length > LIMITS.name, {
    id: 'name-too-long', severity: 'error', title: 'The name is too long',
    detail: `A template name can be at most ${LIMITS.name} characters.`,
  })

  const isAuth = input.category === 'authentication'

  if (isAuth) {
    // The body, header, footer and button of an authentication template are fixed by Meta.
    const m = input.auth.expiryMinutes
    pushIf(f, m !== null && (!Number.isInteger(m) || m < LIMITS.expiryMin || m > LIMITS.expiryMax), {
      id: 'auth-expiry', severity: 'error', title: 'Choose an expiry between 1 and 90 minutes',
      detail: 'The code expiry shown under the message must be a whole number of minutes from 1 to 90.',
    })
    const label = input.auth.buttonText.trim()
    pushIf(f, label === '' || label.length > LIMITS.buttonText, {
      id: 'auth-button', severity: 'error', title: 'Check the button text',
      detail: `The copy-code button needs text of 1 to ${LIMITS.buttonText} characters.`,
    })
    return summarise(f)
  }

  const body = input.body.trim()
  const header = input.headerText.trim()
  const footer = input.footer.trim()
  const missing: string[] = []

  // ── body ──────────────────────────────────────────────────────────────
  pushIf(f, body === '', {
    id: 'body-required', severity: 'error', title: 'Write the message',
    detail: 'The body is the message itself, and every template needs one.',
  })
  pushIf(f, body.length > LIMITS.body, {
    id: 'body-too-long', severity: 'error', title: 'The message is too long',
    detail: `The body can be at most ${LIMITS.body} characters. Yours is ${body.length}.`,
  })

  const vars = findVariables(body)
  pushIf(f, vars.malformed, {
    id: 'variable-format', severity: 'error', title: 'A variable is not written as {{1}}',
    detail: 'Variables are numbers inside double curly braces, like {{1}}. Names such as {{name}}, spaces inside the braces and single braces are rejected.',
  })

  const unique = Array.from(new Set(vars.numbers)).sort((a, b) => a - b)
  const max = unique.length ? unique[unique.length - 1] : 0
  const gapless = unique.every((n, i) => n === i + 1)
  pushIf(f, unique.length > 0 && !gapless, {
    id: 'variable-sequence', severity: 'error', title: 'Number the variables 1, 2, 3 with no gaps',
    detail: 'Variables must start at {{1}} and go up one at a time. If you remove one, renumber the ones after it.',
  })

  pushIf(f, /^\{\{\d+\}\}/.test(body), {
    id: 'variable-start', severity: 'error', title: 'The message starts with a variable',
    detail: 'A variable cannot be the first thing in the body. Start with a word, for example "Hi {{1}},".',
  })
  pushIf(f, /\{\{\d+\}\}$/.test(body), {
    id: 'variable-end', severity: 'error', title: 'The message ends with a variable',
    detail: 'A variable cannot be the last thing in the body. End with a word or a full stop.',
  })

  const stuck = /\}\}\{\{/.test(body)
  pushIf(f, stuck, {
    id: 'variable-adjacent', severity: 'error', title: 'Two variables are next to each other',
    detail: 'Put real words between variables. {{1}}{{2}} is rejected.',
  })
  pushIf(f, !stuck && /\}\}\s+\{\{/.test(body), {
    id: 'variable-close', severity: 'warning', title: 'Two variables are separated only by a space',
    detail: 'Meta can reject variables that are placed too close together. Add a word between them, such as "Order {{1}} for {{2}}".',
  })

  const textLength = placeholderFree(body).length
  pushIf(f, vars.numbers.length > 0 && textLength / vars.numbers.length < 12, {
    id: 'variable-ratio', severity: 'warning', title: 'Too many variables for the amount of text',
    detail: 'Meta rejects templates with too many variables for their length. Add more fixed wording around them or use fewer variables.',
  })

  // Capped, so a typo such as {{5000}} cannot make a list of thousands of items.
  for (let n = 1; n <= Math.min(max, MAX_VARIABLES_CHECKED); n++) {
    if (!input.bodySamples[n - 1]?.trim()) missing.push(`{{${n}}} in the message`)
  }

  pushIf(f, body !== '' && !isAuth && textLength < 25, {
    id: 'body-short', severity: 'warning', title: 'The message is very short',
    detail: 'Very short or generic messages are hard to review and are often treated as marketing. Say what the message is about.',
  })

  // ── header ────────────────────────────────────────────────────────────
  if (header) {
    pushIf(f, header.length > LIMITS.header, {
      id: 'header-too-long', severity: 'error', title: 'The header is too long',
      detail: `A text header can be at most ${LIMITS.header} characters. Yours is ${header.length}.`,
    })
    const h = findVariables(header)
    pushIf(f, h.numbers.length > 1 || h.numbers.some((n) => n !== 1), {
      id: 'header-variables', severity: 'error', title: 'A header can have one variable, {{1}}',
      detail: 'Use a single {{1}} in the header, or none at all.',
    })
    pushIf(f, h.malformed, {
      id: 'variable-format', severity: 'error', title: 'A variable is not written as {{1}}',
      detail: 'Variables are numbers inside double curly braces, like {{1}}.',
    })
    pushIf(f, /[*_~`]/.test(header), {
      id: 'header-format', severity: 'warning', title: 'Formatting characters in the header',
      detail: 'Bold, italic and similar formatting is not supported in a header. Remove the *, _, ~ and ` characters.',
    })
    if (h.numbers.length > 0 && !input.headerSample.trim()) missing.push('{{1}} in the header')
  }

  // ── footer ────────────────────────────────────────────────────────────
  pushIf(f, footer.length > LIMITS.footer, {
    id: 'footer-too-long', severity: 'error', title: 'The footer is too long',
    detail: `A footer can be at most ${LIMITS.footer} characters. Yours is ${footer.length}.`,
  })
  pushIf(f, /\{\{|\}\}/.test(footer), {
    id: 'footer-variable', severity: 'error', title: 'A footer cannot contain variables',
    detail: 'Remove the {{ }} from the footer. It must be fixed text.',
  })

  // ── buttons ───────────────────────────────────────────────────────────
  const buttons = input.buttons
  const count = (t: ButtonType) => buttons.filter((b) => b.type === t).length
  pushIf(f, buttons.length > LIMITS.buttons, {
    id: 'buttons-too-many', severity: 'error', title: 'Too many buttons',
    detail: `A template can have at most ${LIMITS.buttons} buttons in total.`,
  })
  pushIf(f, count('url') > LIMITS.urls, {
    id: 'url-too-many', severity: 'error', title: 'Too many link buttons',
    detail: `A template can have at most ${LIMITS.urls} link buttons.`,
  })
  pushIf(f, count('phone') > LIMITS.phones, {
    id: 'phone-too-many', severity: 'error', title: 'Only one call button is allowed',
    detail: 'A template can have one "call phone number" button.',
  })
  pushIf(f, count('copy_code') > LIMITS.copyCodes, {
    id: 'copy-too-many', severity: 'error', title: 'Only one copy-code button is allowed',
    detail: 'A template can have one "copy code" button.',
  })
  pushIf(f, buttons.some((b) => b.text.trim() === ''), {
    id: 'button-text-empty', severity: 'error', title: 'A button has no text',
    detail: 'Every button needs a label, such as "Track order".',
  })
  pushIf(f, buttons.some((b) => b.type !== 'copy_code' && b.text.trim().length > LIMITS.buttonText), {
    id: 'button-text-long', severity: 'error', title: 'A button label is too long',
    detail: `Button text can be at most ${LIMITS.buttonText} characters.`,
  })

  for (const b of buttons.filter((x) => x.type === 'url')) {
    const url = b.value.trim()
    const okScheme = url.startsWith('https://') && url.length > 'https://'.length
    pushIf(f, !okScheme, {
      id: 'url-invalid', severity: 'error', title: 'A link button needs a full https:// address',
      detail: 'Start the address with https://, for example https://example.com/track.',
    })
    pushIf(f, url.length > LIMITS.urlLength, {
      id: 'url-too-long', severity: 'error', title: 'A link is too long',
      detail: `A button link can be at most ${LIMITS.urlLength} characters.`,
    })
    const u = findVariables(url)
    pushIf(f, u.numbers.length > 0 && (u.numbers.length > 1 || !/\{\{1\}\}$/.test(url)), {
      id: 'url-variable-position', severity: 'error', title: 'The link variable must be the very last part',
      detail: 'A link can have one variable, {{1}}, and only at the end, like https://example.com/track/{{1}}.',
    })
    if (u.numbers.length > 0 && !b.sample?.trim()) missing.push('{{1}} at the end of the link')
    pushIf(f, SHORTENERS.test(url), {
      id: 'url-shortener', severity: 'warning', title: 'A shortened link may be refused',
      detail: 'Link shorteners such as bit.ly are a common reason for rejection. Use your own full address instead.',
    })
  }

  for (const b of buttons.filter((x) => x.type === 'phone')) {
    pushIf(f, !/^\+\d{8,19}$/.test(b.value.trim()), {
      id: 'phone-format', severity: 'error', title: 'Write the call number in international format',
      detail: 'Start with + and the country code, then digits only with no spaces. For example +919876543210.',
    })
  }

  for (const b of buttons.filter((x) => x.type === 'copy_code')) {
    pushIf(f, b.value.trim() === '' || b.value.trim().length > 20, {
      id: 'copy-example', severity: 'error', title: 'Give the copy-code button an example code',
      detail: 'Add an example code of 1 to 20 characters. It is only a sample for the review.',
    })
  }

  pushIf(f, count('quick_reply') > 0 && buttons.length > count('quick_reply'), {
    id: 'buttons-mixed', severity: 'tip', title: 'Quick replies and other buttons sit in separate groups',
    detail: 'Quick replies are sent together as one group, ahead of the link and call buttons, whatever order you add them in. Preview the approved template on a phone and on a computer before you rely on it.',
  })

  // ── category ──────────────────────────────────────────────────────────
  const allText = `${header} ${body}`
  if (input.category === 'utility') {
    pushIf(f, PROMO.test(allText), {
      id: 'utility-promotional', severity: 'warning', title: 'This reads like a promotion',
      detail: 'A utility template must not sell. Offers, discounts and calls to buy make Meta treat it as marketing, and it is then charged at the marketing rate.',
    })
    pushIf(f, body !== '' && !ORDER_CONTEXT.test(allText), {
      id: 'utility-generic', severity: 'warning', title: 'It does not mention an order, booking or account',
      detail: 'Utility messages follow up on something the customer did, such as an order, a payment or an appointment. Say which one, or choose the marketing category.',
    })
  }
  if (input.category === 'marketing') {
    pushIf(f, !buttons.some((b) => b.type === 'quick_reply' && OPT_OUT.test(b.text)), {
      id: 'marketing-optout', severity: 'tip', title: 'Consider an opt-out button',
      detail: 'A quick reply such as "Stop promotions" lets people leave easily. That keeps your quality rating healthy and your messaging limit growing.',
    })
  }

  // ── content ───────────────────────────────────────────────────────────
  pushIf(f, SENSITIVE.test(allText), {
    id: 'sensitive-request', severity: 'warning', title: 'It mentions card, ID or bank details',
    detail: 'Meta refuses templates that ask for full card numbers, bank account numbers or ID numbers. If you are only telling people never to share them, say it in a way that does not name the item.',
  })
  pushIf(f, THREAT.test(allText), {
    id: 'threatening-language', severity: 'warning', title: 'It sounds like a threat',
    detail: 'Messages that threaten legal action or shame people are rejected. Keep payment reminders polite and factual.',
  })

  const words = placeholderFree(allText).split(' ').filter((w) => w.replace(/[^A-Za-z]/g, '').length >= 3)
  const shouted = words.filter((w) => w === w.toUpperCase() && /[A-Z]/.test(w)).length
  pushIf(f, words.length >= 5 && shouted / words.length > 0.4, {
    id: 'shouting', severity: 'warning', title: 'Too many capital letters',
    detail: 'Messages written in capitals look like spam to reviewers and to customers. Use normal sentence case.',
  })
  pushIf(f, /!{2,}|\?{2,}|[!?]{3,}/.test(allText), {
    id: 'repeated-punctuation', severity: 'warning', title: 'Repeated !! or ?? marks',
    detail: 'Strings of exclamation or question marks read as spam. One is enough.',
  })
  pushIf(f, SHORTENERS.test(body) && !f.some((x) => x.id === 'url-shortener'), {
    id: 'url-shortener', severity: 'warning', title: 'A shortened link may be refused',
    detail: 'Link shorteners such as bit.ly are a common reason for rejection. Use your own full address instead.',
  })

  pushIf(f, missing.length > 0, {
    id: 'sample-missing', severity: 'error', title: 'Add an example for every variable',
    detail: `Meta reviews your template using example values. Missing: ${listSome(missing)}.`,
  })

  return summarise(f)
}

const ORDER: Record<Severity, number> = { error: 0, warning: 1, tip: 2 }

function summarise(findings: Finding[]): CheckResult {
  const sorted = [...findings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity])
  const errors = sorted.filter((x) => x.severity === 'error').length
  return {
    findings: sorted,
    errors,
    warnings: sorted.filter((x) => x.severity === 'warning').length,
    tips: sorted.filter((x) => x.severity === 'tip').length,
    ready: errors === 0,
  }
}

/**
 * The JSON body for POST /{WABA-ID}/message_templates on the WhatsApp Cloud API.
 * Sent as it is, it creates the template and starts Meta's review.
 */
export function buildApiPayload(input: TemplateInput): Record<string, unknown> {
  const base = {
    name: input.name.trim(),
    category: input.category.toUpperCase(),
    language: input.language,
  }

  if (input.category === 'authentication') {
    const { securityNote, expiryMinutes, buttonText } = input.auth
    const components: Record<string, unknown>[] = [{ type: 'BODY', add_security_recommendation: securityNote }]
    if (expiryMinutes !== null) components.push({ type: 'FOOTER', code_expiration_minutes: expiryMinutes })
    components.push({ type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: buttonText.trim() }] })
    return { ...base, components }
  }

  const components: Record<string, unknown>[] = []
  const header = input.headerText.trim()
  if (header) {
    const hasVar = findVariables(header).numbers.length > 0
    components.push({
      type: 'HEADER',
      format: 'TEXT',
      text: header,
      ...(hasVar ? { example: { header_text: [input.headerSample.trim()] } } : {}),
    })
  }

  const body = input.body.trim()
  const { numbers } = findVariables(body)
  const max = numbers.length ? Math.max(...numbers) : 0
  components.push({
    type: 'BODY',
    text: body,
    ...(max > 0 ? { example: { body_text: [input.bodySamples.slice(0, max).map((s) => s.trim())] } } : {}),
  })

  const footer = input.footer.trim()
  if (footer) components.push({ type: 'FOOTER', text: footer })

  if (input.buttons.length > 0) {
    const toApi = (b: TemplateButton): Record<string, unknown> => {
      const text = b.text.trim()
      switch (b.type) {
        case 'quick_reply':
          return { type: 'QUICK_REPLY', text }
        case 'phone':
          return { type: 'PHONE_NUMBER', text, phone_number: b.value.trim() }
        case 'copy_code':
          return { type: 'COPY_CODE', example: b.value.trim() }
        case 'url': {
          const url = b.value.trim()
          const hasVar = findVariables(url).numbers.length > 0
          return {
            type: 'URL',
            text,
            url,
            ...(hasVar ? { example: [url.replace(/\{\{1\}\}$/, (b.sample ?? '').trim())] } : {}),
          }
        }
      }
    }
    const quick = input.buttons.filter((b) => b.type === 'quick_reply')
    const others = input.buttons.filter((b) => b.type !== 'quick_reply')
    components.push({ type: 'BUTTONS', buttons: [...quick, ...others].map(toApi) })
  }

  return { ...base, components }
}

/**
 * Turns a title such as "Diwali Sale 2026" into a name Meta accepts
 * (diwali_sale_2026). Anything that is not a-z or 0-9 becomes an underscore,
 * and runs of them collapse into one. Returns "" when nothing usable is left.
 */
export function suggestTemplateName(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, LIMITS.name)
}

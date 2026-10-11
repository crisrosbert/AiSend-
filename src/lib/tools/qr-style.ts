// src/lib/tools/qr-style.ts
//
// The rules that decide whether a styled QR code still scans, and what a
// WhatsApp group or channel link has to look like. Kept free of the DOM so it
// can be tested; the drawing lives in qr-svg.ts.

/** "#1B6B4A", "1b6b4a" or "#1b4" -> "#1b6b4a"; anything else -> null. */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw.split('').map((c) => c + c).join('').toLowerCase()}`
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`
  return null
}

function channel(v: number): number {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Below this the squares blur into the background on a real phone camera. */
export const MIN_QR_CONTRAST = 3

export type Readability = { status: 'ok' } | { status: 'inverted' } | { status: 'low-contrast' }

/**
 * Phone cameras read a dark code on a light background everywhere. A light
 * code on a dark background ("inverted") works on newer phones only, so it
 * gets a warning, not a block. Too little contrast is blocked: a printed
 * code that does not scan wastes the print run.
 */
export function qrReadability(fg: string, bg: string): Readability {
  const f = normalizeHex(fg)
  const b = normalizeHex(bg)
  if (!f || !b) return { status: 'low-contrast' }
  if (contrastRatio(f, b) < MIN_QR_CONTRAST) return { status: 'low-contrast' }
  if (luminance(f) > luminance(b)) return { status: 'inverted' }
  return { status: 'ok' }
}

export type ShareLinkResult =
  | { ok: true; kind: 'group' | 'channel'; url: string }
  | { ok: false; reason: 'empty' | 'not-whatsapp' | 'missing-code' }

const CODE = /^[A-Za-z0-9_-]+$/

/**
 * Accepts a WhatsApp group invite or channel link, however it was pasted:
 * with or without https://, with tracking parameters, with spaces around it.
 * Returns the clean address that goes into the QR code.
 */
export function parseWhatsAppShareLink(input: string): ShareLinkResult {
  const raw = input.trim()
  if (!raw) return { ok: false, reason: 'empty' }

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return { ok: false, reason: 'not-whatsapp' }
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'not-whatsapp' }

  const host = url.hostname.toLowerCase()
  const segments = url.pathname.split('/').filter(Boolean)

  if (host === 'chat.whatsapp.com') {
    const code = segments[0]
    if (!code) return { ok: false, reason: 'missing-code' }
    if (!CODE.test(code)) return { ok: false, reason: 'not-whatsapp' }
    return { ok: true, kind: 'group', url: `https://chat.whatsapp.com/${code}` }
  }

  if (host === 'whatsapp.com' || host === 'www.whatsapp.com') {
    if (segments[0] !== 'channel') return { ok: false, reason: 'not-whatsapp' }
    const code = segments[1]
    if (!code) return { ok: false, reason: 'missing-code' }
    if (!CODE.test(code)) return { ok: false, reason: 'not-whatsapp' }
    return { ok: true, kind: 'channel', url: `https://${host}/channel/${code}` }
  }

  return { ok: false, reason: 'not-whatsapp' }
}

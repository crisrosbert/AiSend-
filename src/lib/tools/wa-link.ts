// src/lib/tools/wa-link.ts
//
// Builds a wa.me click-to-chat link from whatever a visitor types.
//
// People do not type numbers the way the URL wants them. They add the
// country code again after picking it from a dropdown, put a 0 in front,
// paste "+91 …" or "0091 …", and use spaces, dashes and brackets. A link
// built from that raw input opens a chat with the wrong person or none at
// all — and the visitor blames the business printed on the poster, not the
// tool. So the input is normalised to the one shape WhatsApp accepts:
// country code + national number, digits only, no "+" and no leading zeros.

export interface Country {
  code: string
  label: string
  /** Shortest and longest national number (without trunk 0 or country code). */
  national: readonly [min: number, max: number]
}

export const COUNTRIES: readonly Country[] = [
  { code: '91', label: '🇮🇳 India (+91)', national: [10, 10] },
  { code: '55', label: '🇧🇷 Brazil (+55)', national: [10, 11] },
  { code: '62', label: '🇮🇩 Indonesia (+62)', national: [8, 12] },
  { code: '234', label: '🇳🇬 Nigeria (+234)', national: [10, 10] },
  { code: '60', label: '🇲🇾 Malaysia (+60)', national: [9, 10] },
  { code: '20', label: '🇪🇬 Egypt (+20)', national: [10, 10] },
  { code: '92', label: '🇵🇰 Pakistan (+92)', national: [10, 10] },
  { code: '880', label: '🇧🇩 Bangladesh (+880)', national: [10, 10] },
  { code: '971', label: '🇦🇪 UAE (+971)', national: [9, 9] },
  { code: '966', label: '🇸🇦 Saudi Arabia (+966)', national: [9, 9] },
  { code: '27', label: '🇿🇦 South Africa (+27)', national: [9, 9] },
  { code: '63', label: '🇵🇭 Philippines (+63)', national: [10, 10] },
  { code: '52', label: '🇲🇽 Mexico (+52)', national: [10, 10] },
  { code: '1', label: '🇺🇸 US / Canada (+1)', national: [10, 10] },
  { code: '44', label: '🇬🇧 UK (+44)', national: [9, 10] },
]

export type WaLinkResult =
  | { ok: true; link: string; /** Digits as they appear after wa.me/ */ number: string }
  | { ok: false; reason: 'empty' | 'too-short' | 'too-long' }

const MIN_NATIONAL_DIGITS = 6
const MIN_INTERNATIONAL_DIGITS = 8
const MAX_DIGITS = 15 // E.164: country code + number never exceeds 15 digits

export function buildWhatsAppLink(input: {
  countryCode: string
  phone: string
  message?: string
}): WaLinkResult {
  const raw = input.phone.trim()
  let digits = raw.replace(/\D/g, '')
  if (!digits) return { ok: false, reason: 'empty' }

  let full: string
  if (raw.startsWith('+') || digits.startsWith('00')) {
    // Already international — the typed number outranks the dropdown.
    full = digits.replace(/^00/, '')
    if (full.length < MIN_INTERNATIONAL_DIGITS) return { ok: false, reason: 'too-short' }
  } else {
    digits = digits.replace(/^0+/, '') // trunk prefix, e.g. 098765 43210
    const cc = input.countryCode
    const country = COUNTRIES.find((c) => c.code === cc)
    if (country && digits.startsWith(cc)) {
      const [min, max] = country.national
      const rest = digits.length - cc.length
      // Only treat the leading digits as a repeated country code when what is
      // left is a plausible national number AND the whole thing is too long to
      // be one — 9123456789 is a real Indian mobile, 919123456789 is not.
      if (rest >= min && rest <= max && digits.length > max) digits = digits.slice(cc.length)
    }
    if (digits.length < MIN_NATIONAL_DIGITS) return { ok: false, reason: 'too-short' }
    full = cc + digits
  }

  if (full.length > MAX_DIGITS) return { ok: false, reason: 'too-long' }

  const text = input.message?.trim()
  const link = `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ''}`
  return { ok: true, link, number: full }
}

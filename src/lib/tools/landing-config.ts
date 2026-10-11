// src/lib/tools/landing-config.ts
//
// Settings shared by every /tools/* landing page: who receives the leads and
// how the "talk to us on WhatsApp" buttons are built. Page-specific copy,
// videos and reviews live next to each page (see
// src/app/tools/whatsapp-link-generator/content.ts).

import { buildWhatsAppLink } from './wa-link'

export const TOOL_LEAD = {
  /** Team WhatsApp number in wa.me format: country code + number, digits only. */
  whatsappNumber: '918707879485',
  /** How the number is shown to visitors. */
  displayNumber: '+91 87078 79485',
  /**
   * Public lead-source key (pk_…) from Leads → Lead sources in the dashboard.
   * Set NEXT_PUBLIC_TOOLS_LEAD_KEY and the call-back form saves leads straight
   * into the CRM. While it is empty the form hands the lead over on WhatsApp
   * instead, so no enquiry is ever lost.
   */
  captureKey: process.env.NEXT_PUBLIC_TOOLS_LEAD_KEY ?? '',
} as const

/** A wa.me link to the team with a ready-written first message. */
export function teamWhatsAppLink(message: string): string {
  const result = buildWhatsAppLink({
    countryCode: '',
    phone: `+${TOOL_LEAD.whatsappNumber}`,
    message,
  })
  // The number above is our own constant — an invalid one is a code bug.
  if (!result.ok) throw new Error('TOOL_LEAD.whatsappNumber is not a valid WhatsApp number')
  return result.link
}

/**
 * Browser event used by the "where to use it" cards to load a ready-made
 * starting point into the tool without the two components knowing each other.
 */
export const PRESET_EVENT = 'wlg:preset'

/** What a card hands to the tool on the same page. */
export interface PresetDetail {
  /** Ready-written text: a first message, a template body, a scenario name. */
  message: string
  /** Extra settings for tools with more than one field, as plain strings. */
  data?: Readonly<Record<string, string>>
}

export function dispatchPreset(message: string, data?: Readonly<Record<string, string>>): void {
  const detail: PresetDetail = { message, data }
  window.dispatchEvent(new CustomEvent<PresetDetail>(PRESET_EVENT, { detail }))
}

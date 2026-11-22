// src/lib/whatsapp/coexistence.ts
//
// Pure helpers for WhatsApp Business app Coexistence (one number used in the
// Business app AND on the Cloud API). Kept free of I/O so they can be unit
// tested. The webhook / signup route do the network and database work.

/** Embedded Signup `featureType` that onboards an existing Business app number. */
export const COEXISTENCE_FEATURE_TYPE = 'whatsapp_business_app_onboarding'

/** Webhook fields Meta uses for coexistence traffic. */
export const COEXISTENCE_WEBHOOK_FIELDS = [
  'smb_message_echoes', // messages the owner sends from the phone
  'history', //           chat history after onboarding
  'smb_app_state_sync', // contacts after onboarding
] as const

export function isCoexistenceField(field: unknown): boolean {
  return typeof field === 'string' && (COEXISTENCE_WEBHOOK_FIELDS as readonly string[]).includes(field)
}

export interface EchoMessage {
  /** Meta message id (wamid...) — used to avoid saving the same echo twice. */
  id: string
  /** Customer's WhatsApp number, digits only. */
  to: string
  contentType: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'template'
  contentText: string
  createdAt: string
}

const MEDIA_LABEL: Record<string, string> = {
  image: '[Image sent from phone]',
  video: '[Video sent from phone]',
  audio: '[Voice/audio sent from phone]',
  document: '[Document sent from phone]',
  sticker: '[Sticker sent from phone]',
  location: '[Location sent from phone]',
}

/**
 * Turns one entry of a `smb_message_echoes` webhook into something we can
 * store, or null when it is unusable. Tolerant on purpose: Meta adds fields,
 * and a malformed echo must never break the rest of the webhook.
 */
export function parseEcho(raw: unknown): EchoMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  const id = typeof m.id === 'string' ? m.id : ''
  const to = typeof m.to === 'string' ? m.to.replace(/\D/g, '') : ''
  if (!id || !to) return null

  const type = typeof m.type === 'string' ? m.type : 'text'
  let contentText = ''
  let contentType: EchoMessage['contentType'] = 'text'

  if (type === 'text') {
    const body = (m.text as { body?: unknown } | undefined)?.body
    contentText = typeof body === 'string' ? body : ''
  } else if (type === 'template') {
    contentType = 'text'
    contentText = '[Template sent from phone]'
  } else {
    contentType = (['image', 'video', 'audio', 'document', 'location'] as const).includes(type as never)
      ? (type as EchoMessage['contentType'])
      : 'text'
    const caption = (m[type] as { caption?: unknown } | undefined)?.caption
    contentText = typeof caption === 'string' && caption ? caption : MEDIA_LABEL[type] ?? `[${type} sent from phone]`
  }
  if (!contentText) return null

  const seconds = Number(m.timestamp)
  const createdAt = Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : new Date().toISOString()
  return { id, to, contentType, contentText, createdAt }
}

/**
 * Embedded Signup for a Business app number may hand back only the WABA id.
 * Pick the phone number to use from the WABA's number list: the hinted one if
 * present, otherwise the only one, otherwise null (ambiguous — ask the user).
 */
export function pickPhoneNumberId(
  numbers: Array<{ id?: string }> | null | undefined,
  hint?: string | null,
): string | null {
  const ids = (numbers ?? []).map((n) => n?.id).filter((x): x is string => typeof x === 'string' && x.length > 0)
  if (hint && ids.includes(hint)) return hint
  if (ids.length === 1) return ids[0]
  return null
}

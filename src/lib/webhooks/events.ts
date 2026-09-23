// src/lib/webhooks/events.ts
//
// The event catalog. Adding a new event type is: add the string here,
// call emitWebhookEvent() from wherever it happens. No migration
// needed — `webhook_endpoints.events` is a plain text[], validated
// against this list in application code (see isKnownEventType).

export const WEBHOOK_EVENT_TYPES = [
  'message.received',
  'message.sent',
  'message.status_updated',
  'conversation.created',
] as const

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number]

export function isKnownEventType(value: string): value is WebhookEventType {
  return (WEBHOOK_EVENT_TYPES as readonly string[]).includes(value)
}

/** The envelope every delivery's body is. `id` is the idempotency key. */
export interface WebhookEventEnvelope<T = unknown> {
  id: string
  type: WebhookEventType
  created: number
  data: T
}

/**
 * `message.received` payload.
 *
 * `referral` carries Click-to-WhatsApp ad attribution when the
 * conversation started from an ad — mirrors the fields Meta itself
 * sends on the inbound webhook (src/app/api/whatsapp/webhook/route.ts,
 * WhatsAppMessage.referral), camelCased for the public event shape so
 * a receiver isn't reverse-engineering Meta's own wire format.
 */
export interface MessageReceivedPayload {
  conversationId: string
  contact: {
    id: string
    phone: string
    name: string | null
  }
  message: {
    id: string
    type: string
    text: string | null
    timestamp: string
  }
  referral: {
    sourceUrl: string | null
    sourceId: string | null
    sourceType: string | null
    headline: string | null
    ctwaClid: string | null
  } | null
}

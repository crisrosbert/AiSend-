// src/lib/webhooks/dispatch.ts
//
// The entry point every event source calls: "this happened, tell
// whoever's listening." Fans an event out to every active endpoint
// subscribed to it, writes one outbox row per endpoint, then makes one
// immediate delivery attempt per row so a healthy receiver sees the
// event in under a second — the retry sweep (src/app/api/cron/
// webhook-sweep/route.ts) exists for the rows that don't succeed on
// that first try, not for the common case.
//
// Deliberately fire-and-forget from the caller's point of view: a
// webhook subscriber going down must never slow down or fail the
// WhatsApp message pipeline that triggered the event. Call this
// without awaiting it inside `after()`, same pattern already used for
// processWebhook() in the inbound Meta handler.

import crypto from 'node:crypto'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { attemptDelivery } from './deliver'
import type { WebhookEventEnvelope, WebhookEventType } from './events'

interface EmitArgs<T> {
  userId: string
  type: WebhookEventType
  data: T
  /** Pass a stable id (e.g. the inbound message's Meta id) so a
   *  duplicate emit for the same underlying event — a retried Meta
   *  webhook, for instance — doesn't create a second delivery per
   *  endpoint. Omit to get a fresh random id (fine for events that
   *  can't naturally repeat). */
  eventId?: string
}

interface EndpointRow {
  id: string
  events: string[]
}

export async function emitWebhookEvent<T>(args: EmitArgs<T>): Promise<void> {
  const admin = supabaseAdmin()

  const { data: endpoints, error } = await admin
    .from('webhook_endpoints')
    .select('id, events')
    .eq('user_id', args.userId)
    .eq('is_active', true)
    .returns<EndpointRow[]>()

  if (error || !endpoints || endpoints.length === 0) return

  const subscribed = endpoints.filter(
    (e) => e.events.length === 0 || e.events.includes(args.type),
  )
  if (subscribed.length === 0) return

  const eventId = args.eventId ?? crypto.randomUUID()
  const envelope: WebhookEventEnvelope<T> = {
    id: eventId,
    type: args.type,
    created: Math.floor(Date.now() / 1000),
    data: args.data,
  }

  const deliveryIds: string[] = []
  for (const endpoint of subscribed) {
    // onConflict on (endpoint_id, event_id): a duplicate emit for the
    // same logical event is a no-op here, not a second row.
    const { data, error: insertError } = await admin
      .from('webhook_deliveries')
      .upsert(
        {
          endpoint_id: endpoint.id,
          user_id: args.userId,
          event_type: args.type,
          event_id: eventId,
          payload: envelope,
          status: 'pending',
        },
        { onConflict: 'endpoint_id,event_id', ignoreDuplicates: true },
      )
      .select('id')
    if (insertError) {
      console.error('[webhooks] enqueue failed:', insertError.message)
      continue
    }
    if (data && data[0]) deliveryIds.push(data[0].id)
  }

  await Promise.allSettled(
    deliveryIds.map((id) =>
      attemptDelivery(id).catch((err) =>
        console.error('[webhooks] immediate delivery attempt failed:', err),
      ),
    ),
  )
}

// src/lib/webhooks/dispatch.ts
//
// The entry points every event source calls: "this happened, tell
// whoever's listening." Two variants:
//
//   emitWebhookEvent          — fan out to every active endpoint
//                                subscribed to this event type. Used
//                                for the normal, "notify everyone"
//                                events (message.received, etc).
//   emitWebhookEventToEndpoint — deliver to exactly one endpoint,
//                                ignoring its `events` filter. Used
//                                for BYOA routing (subscription.*),
//                                where the endpoint was chosen
//                                explicitly per conversation, and for
//                                the "Send test event" button.
//
// Both write one outbox row per delivery, then make one immediate
// attempt so a healthy receiver sees the event in under a second — the
// retry sweep (src/app/api/cron/webhook-sweep/route.ts) exists for
// rows that don't succeed on that first try, not for the common case.
//
// Deliberately fire-and-forget from the caller's point of view: a
// webhook subscriber going down must never slow down or fail the
// WhatsApp message pipeline that triggered the event. Call these
// without awaiting inside `after()`, same pattern already used for
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

interface EmitToEndpointArgs<T> extends EmitArgs<T> {
  endpointId: string
}

interface EndpointRow {
  id: string
  events: string[]
}

async function enqueueAndDeliver<T>(
  userId: string,
  endpointIds: string[],
  type: WebhookEventType,
  data: T,
  eventId: string,
): Promise<void> {
  if (endpointIds.length === 0) return
  const admin = supabaseAdmin()

  const envelope: WebhookEventEnvelope<T> = {
    id: eventId,
    type,
    created: Math.floor(Date.now() / 1000),
    data,
  }

  const deliveryIds: string[] = []
  for (const endpointId of endpointIds) {
    // onConflict on (endpoint_id, event_id): a duplicate emit for the
    // same logical event is a no-op here, not a second row.
    const { data: rows, error: insertError } = await admin
      .from('webhook_deliveries')
      .upsert(
        {
          endpoint_id: endpointId,
          user_id: userId,
          event_type: type,
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
    if (rows && rows[0]) deliveryIds.push(rows[0].id)
  }

  await Promise.allSettled(
    deliveryIds.map((id) =>
      attemptDelivery(id).catch((err) =>
        console.error('[webhooks] immediate delivery attempt failed:', err),
      ),
    ),
  )
}

/** Fan out to every active endpoint subscribed to this event type
 *  (empty `events` on an endpoint means "subscribed to everything"). */
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
  await enqueueAndDeliver(
    args.userId,
    subscribed.map((e) => e.id),
    args.type,
    args.data,
    eventId,
  )
}

/** Deliver to exactly one endpoint — its `events` filter is ignored,
 *  since the caller already decided this endpoint should get this
 *  event (BYOA routing, or a manual "Send test event"). */
export async function emitWebhookEventToEndpoint<T>(args: EmitToEndpointArgs<T>): Promise<void> {
  const eventId = args.eventId ?? crypto.randomUUID()
  await enqueueAndDeliver(args.userId, [args.endpointId], args.type, args.data, eventId)
}

// src/lib/webhooks/routing.ts
//
// BYOA conversation routing — hand one conversation over to a
// developer's own backend entirely, bypassing AiSend's own reply
// pipeline (ads agent, journeys, WhatsApp AI agent, automations'
// message-sending). Mirrors Wassist's conversations.subscribe /
// unsubscribe.
//
// The actual bypass happens in src/app/api/whatsapp/webhook/route.ts,
// which checks conversation.routing_mode on every inbound message.
// This file only owns the subscribe/unsubscribe transition and the
// subscription.activated / subscription.revoked notifications.

import { createClient } from '@/lib/supabase/server'
import { emitWebhookEventToEndpoint } from './dispatch'
import type { SubscriptionChangedPayload } from './events'

export type RoutingResult =
  | { ok: true }
  | { ok: false; error: string; status: 404 | 400 }

/** Session-authenticated: relies on the caller having already
 *  confirmed `user.id`, and on RLS to reject a conversation or
 *  endpoint that isn't theirs. */
export async function subscribeConversation(
  userId: string,
  conversationId: string,
  endpointId: string,
): Promise<RoutingResult> {
  const supabase = await createClient()

  const { data: endpoint, error: endpointError } = await supabase
    .from('webhook_endpoints')
    .select('id, is_active')
    .eq('id', endpointId)
    .maybeSingle()
  if (endpointError) return { ok: false, error: endpointError.message, status: 400 }
  if (!endpoint) return { ok: false, error: 'Endpoint not found', status: 404 }
  if (!endpoint.is_active) return { ok: false, error: 'Endpoint is disabled', status: 400 }

  const { data: conversation, error: updateError } = await supabase
    .from('conversations')
    .update({
      routing_mode: 'webhook',
      routing_endpoint_id: endpointId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .select('id')
    .maybeSingle()
  if (updateError) return { ok: false, error: updateError.message, status: 400 }
  if (!conversation) return { ok: false, error: 'Conversation not found', status: 404 }

  const payload: SubscriptionChangedPayload = { conversationId, webhookId: endpointId }
  await emitWebhookEventToEndpoint({
    userId,
    endpointId,
    type: 'subscription.activated',
    data: payload,
  })

  return { ok: true }
}

export async function unsubscribeConversation(
  userId: string,
  conversationId: string,
): Promise<RoutingResult> {
  const supabase = await createClient()

  const { data: before, error: readError } = await supabase
    .from('conversations')
    .select('id, routing_endpoint_id')
    .eq('id', conversationId)
    .maybeSingle()
  if (readError) return { ok: false, error: readError.message, status: 400 }
  if (!before) return { ok: false, error: 'Conversation not found', status: 404 }

  const previousEndpointId = before.routing_endpoint_id as string | null

  const { error: updateError } = await supabase
    .from('conversations')
    .update({
      routing_mode: 'agent',
      routing_endpoint_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
  if (updateError) return { ok: false, error: updateError.message, status: 400 }

  if (previousEndpointId) {
    const payload: SubscriptionChangedPayload = { conversationId, webhookId: previousEndpointId }
    await emitWebhookEventToEndpoint({
      userId,
      endpointId: previousEndpointId,
      type: 'subscription.revoked',
      data: payload,
    })
  }

  return { ok: true }
}

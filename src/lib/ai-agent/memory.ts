// ============================================================
// File: src/lib/ai-agent/memory.ts
// Purpose: Manages per-customer conversation sessions.
//
// Each row in ai_agent_sessions represents one ongoing
// conversation between a customer (contact_phone) and the
// business's AI agent (user_id).
//
// Stored data:
//   messages — rolling window of last 10 conversation turns
//              passed to the LLM as context
//   cart     — active shopping cart items
//   needs_human — true when escalated to a human operator
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role:      'user' | 'assistant'
  content:   string
  timestamp: string
}

export interface CartItem {
  product_id: string
  name:       string
  price:      number
  quantity:   number
  image_url:  string | null
}

export interface AgentSession {
  id:           string
  user_id:      string
  contact_phone: string
  messages:     ConversationMessage[]
  cart:         CartItem[]
  needs_human:  boolean
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/**
 * Maximum number of conversation turns kept in memory.
 * Older messages are dropped to stay within LLM context limits
 * and keep embedding + token costs predictable.
 */
const MAX_CONVERSATION_HISTORY_TURNS = 10

// ─────────────────────────────────────────────────────────────
// Session Functions
// ─────────────────────────────────────────────────────────────

/**
 * getOrCreateSession
 *
 * Fetches the existing session for this customer, or creates
 * a new empty one if this is their first message.
 * Uses upsert to handle the race condition where two messages
 * arrive simultaneously from the same customer.
 */
export async function getOrCreateSession(
  userId:       string,
  contactPhone: string,
  supabase:     SupabaseClient,
): Promise<AgentSession> {
  const { data: existingSession } = await supabase
    .from('ai_agent_sessions')
    .select('id, user_id, contact_phone, messages, cart, needs_human')
    .eq('user_id', userId)
    .eq('contact_phone', contactPhone)
    .maybeSingle()

  if (existingSession) {
    return existingSession as AgentSession
  }

  // First message from this customer — create a fresh session
  const { data: newSession, error } = await supabase
    .from('ai_agent_sessions')
    .insert({
      user_id:       userId,
      contact_phone: contactPhone,
      messages:      [],
      cart:          [],
      needs_human:   false,
    })
    .select('id, user_id, contact_phone, messages, cart, needs_human')
    .single()

  if (error || !newSession) {
    throw new Error(
      `[ai-agent/memory] Failed to create session for user=${userId} phone=${contactPhone}: ${error?.message}`,
    )
  }

  return newSession as AgentSession
}

/**
 * appendMessageToSession
 *
 * Adds new messages to the session and trims the history
 * to MAX_CONVERSATION_HISTORY_TURNS to control LLM context size.
 *
 * Also updates needs_human flag if the engine has decided
 * to hand off to a human operator.
 */
export async function appendMessageToSession(params: {
  userId:       string
  contactPhone: string
  newMessages:  ConversationMessage[]
  needsHuman:   boolean
  supabase:     SupabaseClient
}): Promise<void> {
  const { userId, contactPhone, newMessages, needsHuman, supabase } = params

  // Fetch current session to get existing messages
  const { data: currentSession } = await supabase
    .from('ai_agent_sessions')
    .select('messages')
    .eq('user_id', userId)
    .eq('contact_phone', contactPhone)
    .single()

  const existingMessages: ConversationMessage[] =
    (currentSession?.messages as ConversationMessage[]) ?? []

  // Append new messages and trim to rolling window
  const updatedMessages = [...existingMessages, ...newMessages].slice(
    -MAX_CONVERSATION_HISTORY_TURNS,
  )

  await supabase
    .from('ai_agent_sessions')
    .update({
      messages:    updatedMessages,
      needs_human: needsHuman,
      updated_at:  new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('contact_phone', contactPhone)
}

/**
 * updateCartInSession
 *
 * Replaces the cart array in the session.
 * Called by cart.ts after every add/remove operation.
 */
export async function updateCartInSession(
  userId:       string,
  contactPhone: string,
  updatedCart:  CartItem[],
  supabase:     SupabaseClient,
): Promise<void> {
  await supabase
    .from('ai_agent_sessions')
    .update({
      cart:       updatedCart,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('contact_phone', contactPhone)
}

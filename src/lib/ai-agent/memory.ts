/**
 * File: src/lib/ai-agent/memory.ts
 * Purpose: Customer session management for AI Ecommerce Agent
 *
 * Stores conversation history + cart state in ai_agent_sessions table.
 * One row per (user_id, contact_phone) pair — created on first message, reused after.
 *
 * Key design decisions:
 *   - Rolling window of MAX_CONVERSATION_HISTORY_TURNS (keeps DB row size bounded)
 *   - Cart stored as JSONB in same row (no separate cart table)
 *   - needsHuman flag lets human agents take over without deleting session
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types (exported so engine.ts and other files can import them) ────────────

/** A single message in the conversation history */
export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string  // ISO string — used for analytics and ordering
}

/** Full session row shape from ai_agent_sessions table */
export interface AgentSession {
  id: string
  user_id: string
  contact_phone: string
  messages: ConversationMessage[]   // Rolling conversation history (JSONB)
  cart: unknown                     // Raw JSONB — typed by cart.ts → getCartFromSession()
  needs_human: boolean              // True = human agent took over, AI stops responding
  created_at: string
  updated_at: string
}

/** Input for appendMessageToSession */
export interface AppendMessageInput {
  userId: string
  contactPhone: string
  newMessages: ConversationMessage[]
  needsHuman: boolean               // Always pass explicitly — true or false
  supabase: SupabaseClient
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Max conversation turns kept per session — older turns are dropped (rolling window) */
const MAX_CONVERSATION_HISTORY_TURNS = 10

// ─── Public Functions ─────────────────────────────────────────────────────────

/**
 * getOrCreateSession
 * Loads the existing session for a customer, or creates a new one if first contact.
 * Called by engine.ts at the start of every inbound message.
 *
 * @param userId        - Merchant's Supabase user ID
 * @param contactPhone  - Customer's WhatsApp phone number
 * @param supabase      - Supabase client (service role)
 * @returns AgentSession row
 */
export async function getOrCreateSession(
  userId: string,
  contactPhone: string,
  supabase: SupabaseClient
): Promise<AgentSession> {
  // Try to load existing session first
  const { data: existingSession, error: fetchError } = await supabase
    .from('ai_agent_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('contact_phone', contactPhone)
    .single()

  if (existingSession && !fetchError) {
    return existingSession as AgentSession
  }

  // No session found — create a new one for this customer
  const { data: newSession, error: insertError } = await supabase
    .from('ai_agent_sessions')
    .insert({
      user_id: userId,
      contact_phone: contactPhone,
      messages: [],      // Empty conversation history
      cart: null,        // No cart yet
      needs_human: false,
    })
    .select('*')
    .single()

  if (insertError || !newSession) {
    throw new Error(
      `[AI Agent Memory] Failed to create session for userId=${userId} phone=${contactPhone}: ${insertError?.message}`
    )
  }

  console.log(
    `[AI Agent Memory] New session created for userId=${userId} phone=${contactPhone}`
  )

  return newSession as AgentSession
}

/**
 * appendMessageToSession
 * Adds new messages to the session's conversation history.
 * Applies rolling window — keeps only the last MAX_CONVERSATION_HISTORY_TURNS turns.
 * Also updates the needsHuman flag (pass false normally, true when human takeover needed).
 *
 * @param input - AppendMessageInput (userId, contactPhone, newMessages, needsHuman, supabase)
 */
export async function appendMessageToSession(input: AppendMessageInput): Promise<void> {
  const { userId, contactPhone, newMessages, needsHuman, supabase } = input

  // Load current messages from session
  const { data: currentSession, error: fetchError } = await supabase
    .from('ai_agent_sessions')
    .select('messages')
    .eq('user_id', userId)
    .eq('contact_phone', contactPhone)
    .single()

  if (fetchError || !currentSession) {
    throw new Error(
      `[AI Agent Memory] Cannot append — session not found for userId=${userId} phone=${contactPhone}`
    )
  }

  const existingMessages: ConversationMessage[] = currentSession.messages ?? []

  // Merge existing + new, then apply rolling window
  const mergedMessages = [...existingMessages, ...newMessages].slice(
    -MAX_CONVERSATION_HISTORY_TURNS
  )

  const { error: updateError } = await supabase
    .from('ai_agent_sessions')
    .update({
      messages: mergedMessages,
      needs_human: needsHuman,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('contact_phone', contactPhone)

  if (updateError) {
    throw new Error(
      `[AI Agent Memory] Failed to append messages: ${updateError.message}`
    )
  }
}

/**
 * updateCartInSession
 * Writes updated cart JSONB to the session row.
 * Called by cart.ts → persistCartToSession() after every cart mutation.
 *
 * @param userId        - Merchant's user ID
 * @param contactPhone  - Customer's phone number
 * @param updatedCart   - New cart state (typed CartState from cart.ts)
 * @param supabase      - Supabase client
 */
export async function updateCartInSession(
  userId: string,
  contactPhone: string,
  updatedCart: unknown,
  supabase: SupabaseClient
): Promise<void> {
  const { error: updateError } = await supabase
    .from('ai_agent_sessions')
    .update({
      cart: updatedCart,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('contact_phone', contactPhone)

  if (updateError) {
    throw new Error(
      `[AI Agent Memory] Failed to update cart: ${updateError.message}`
    )
  }

  console.log(
    `[AI Agent Memory] Cart updated for userId=${userId} phone=${contactPhone}`
  )
}

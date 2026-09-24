/**
 * ============================================================================
 * File: src/lib/ai-agent/memory.ts
 * Purpose: Customer session management for AI Ecommerce Agent
 * ============================================================================
 *
 * Manages conversation history + cart state in the ai_agent_sessions table.
 * One row per (user_id, contact_phone) pair — created on first message, reused after.
 *
 * Table: ai_agent_sessions
 *   - id              UUID (primary key)
 *   - user_id         UUID (merchant's Supabase user ID)
 *   - contact_phone   TEXT (customer's WhatsApp number)
 *   - messages         JSONB (array of ConversationMessage — rolling window)
 *   - cart            JSONB (CartState — items, checkout step, address, etc.)
 *   - needs_human     BOOLEAN (true = human agent took over, AI stops)
 *   - created_at      TIMESTAMPTZ
 *   - updated_at      TIMESTAMPTZ
 *
 * Key design decisions:
 *   - Rolling window: only keep last 10 messages (keeps DB row small, saves LLM tokens)
 *   - Cart in same row: no separate cart table (simple, atomic updates)
 *   - needs_human flag: lets human agents take over without deleting session
 *   - Session per customer: one customer = one session = one conversation thread
 * ============================================================================
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single message in the conversation history */
export interface ConversationMessage {
  role: 'user' | 'assistant'  // Who sent this message
  content: string              // Message text
  timestamp: string            // ISO string — used for analytics and message ordering
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

/**
 * Max conversation turns kept per session.
 * Older turns are dropped (rolling window) to:
 *   1. Keep DB row size bounded (~10KB per session max)
 *   2. Limit LLM token usage (only recent context matters for shopping)
 *   3. Prevent memory from growing indefinitely
 *
 * 10 turns = 5 user messages + 5 assistant replies = ~2-3 product queries of context
 */
const MAX_CONVERSATION_HISTORY_TURNS = 10

// ─── Public Functions ────────────────────────────────────────────────────────

/**
 * getOrCreateSession
 * Loads the existing session for a customer, or creates a new one if first contact.
 *
 * Called by engine.ts at the start of every inbound message.
 * This is the FIRST database operation for each message.
 *
 * @param userId        - Merchant's Supabase user ID
 * @param contactPhone  - Customer's WhatsApp phone number
 * @param supabase      - Supabase client (service role — bypasses RLS)
 * @returns AgentSession row (existing or newly created)
 * @throws Error if new session can't be created (DB issue)
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
      cart: null,        // No cart yet (cart column must allow NULL)
      needs_human: false,
    })
    .select('*')
    .single()

  if (insertError || !newSession) {
    throw new Error(
      `[AI Agent Memory] Failed to create session for userId=${userId} phone=${contactPhone}: ${insertError?.message}`
    )
  }

  console.log(`[AI Agent Memory] New session created for userId=${userId} phone=${contactPhone}`)
  return newSession as AgentSession
}

/**
 * appendMessageToSession
 * Adds new messages to the session's conversation history.
 *
 * How rolling window works:
 *   1. Load current messages from DB
 *   2. Append new messages
 *   3. If total > MAX_CONVERSATION_HISTORY_TURNS, drop oldest messages
 *   4. Save back to DB
 *
 * Also updates the needsHuman flag:
 *   - Pass false normally (AI keeps responding)
 *   - Pass true when customer wants human help (AI stops responding)
 *
 * @param input - { userId, contactPhone, newMessages, needsHuman, supabase }
 * @throws Error if session not found or update fails
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

  // Merge existing + new, then apply rolling window (keep last N messages)
  const mergedMessages = [...existingMessages, ...newMessages].slice(
    -MAX_CONVERSATION_HISTORY_TURNS
  )

  // Save back to DB
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
 * Note: Cart state includes items, checkout step, delivery address, etc.
 * See cart.ts CartState type for full shape.
 *
 * @param userId        - Merchant's user ID
 * @param contactPhone  - Customer's phone number
 * @param updatedCart   - New cart state (typed CartState from cart.ts)
 * @param supabase      - Supabase client
 * @throws Error if update fails
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
}

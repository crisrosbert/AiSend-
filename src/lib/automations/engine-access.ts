// src/lib/automations/engine-access.ts
//
// Pure decision logic for POST /api/automations/engine (no database,
// no network, easy to test).
//
// WHY: the route lets a signed-in user fire automations for a
// contact_id (and optionally a conversation_id) taken from the request
// body. The automation engine then runs with the service-role client,
// which ignores row-level security. Steps such as add_tag,
// update_contact_field, create_deal and close_conversation use that
// contact id without checking who owns it. So a user could point their
// own automation at another company's contact id.
//
// The route therefore looks the contact (and conversation) up with a
// query limited to the people in the caller's organisation, and this
// file decides what to answer. "Not found" and "belongs to someone
// else" give the SAME answer, so an id from another organisation cannot
// be probed.

export interface EngineBody {
  triggerType: string
  contactId: string | null
  conversationId: string | null
  context: Record<string, unknown>
}

export type ParseResult =
  | { ok: true; body: EngineBody }
  | { ok: false; status: 400; error: string }

/** Same rules as before (trigger_type required) plus type checks on ids. */
export function parseEngineBody(raw: unknown): ParseResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, status: 400, error: 'trigger_type required' }
  }
  const b = raw as Record<string, unknown>
  if (typeof b.trigger_type !== 'string' || !b.trigger_type) {
    return { ok: false, status: 400, error: 'trigger_type required' }
  }
  if (b.contact_id != null && typeof b.contact_id !== 'string') {
    return { ok: false, status: 400, error: 'contact_id must be a string' }
  }
  const ctx =
    b.context && typeof b.context === 'object' && !Array.isArray(b.context)
      ? (b.context as Record<string, unknown>)
      : {}
  if (ctx.conversation_id != null && typeof ctx.conversation_id !== 'string') {
    return { ok: false, status: 400, error: 'context.conversation_id must be a string' }
  }
  return {
    ok: true,
    body: {
      triggerType: b.trigger_type,
      contactId: (b.contact_id as string | null | undefined) || null,
      conversationId: (ctx.conversation_id as string | null | undefined) || null,
      context: ctx,
    },
  }
}

/**
 * Who counts as "inside the caller's organisation".
 * - caller has an org: every user_id that has that org_id on their profile;
 * - caller has no org (older account): only the caller.
 * The caller is always included.
 */
export function allowedOwnerIds(
  callerUserId: string,
  orgId: string | null,
  orgMemberUserIds: string[],
): string[] {
  if (!orgId) return [callerUserId]
  return Array.from(new Set([callerUserId, ...orgMemberUserIds]))
}

export interface ScopedContactRow {
  id: string
  user_id: string
}
export interface ScopedConversationRow {
  id: string
  user_id: string
  contact_id: string | null
}

export type AccessDecision =
  | { ok: true }
  | { ok: false; status: 404; error: 'Not found' }

const NOT_FOUND: AccessDecision = { ok: false, status: 404, error: 'Not found' }

/**
 * Decide whether the request may go on.
 * `contact` / `conversation` are what the org-scoped queries returned
 * (null = no row). They are checked again here against `allowedOwners`
 * so the rule still holds if a query is ever loosened by mistake.
 */
export function decideEngineAccess(input: {
  contactId: string | null
  conversationId: string | null
  contact: ScopedContactRow | null
  conversation: ScopedConversationRow | null
  allowedOwners: string[]
}): AccessDecision {
  const { contactId, conversationId, contact, conversation, allowedOwners } = input

  if (contactId) {
    if (!contact || contact.id !== contactId) return NOT_FOUND
    if (!allowedOwners.includes(contact.user_id)) return NOT_FOUND
  }

  if (conversationId) {
    if (!conversation || conversation.id !== conversationId) return NOT_FOUND
    if (!allowedOwners.includes(conversation.user_id)) return NOT_FOUND
    // If both ids are sent they must belong together, otherwise a caller
    // could mix their own conversation with someone else's contact.
    if (contactId && conversation.contact_id !== contactId) return NOT_FOUND
  }

  return { ok: true }
}

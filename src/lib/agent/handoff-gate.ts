// src/lib/agent/handoff-gate.ts
//
// One answer to "may the bot speak in this conversation right now?"
//
// Why this exists: after a handoff the conversation is flagged
// (status 'pending', needs_attention true) but only the WhatsApp agent
// handler looked at the flag. The website widget and the ads agent kept
// replying over the human, and a single transient AI error parked a chat
// in 'pending' with nothing ever clearing it.
//
// The gate is called ONCE, at the top of runAgent(), because every AI
// reply path (widget, ads agent, WhatsApp agent) goes through it. Callers
// only have to honour `result.skipped`.
//
// "Return to bot" in the inbox sets status 'open', needs_attention false
// and clears handoff_reason. That is exactly what this gate reads, so the
// existing button keeps working with no change.
//
// ── Auto-recovery from AI errors ─────────────────────────────────────
// A chat parked only because the AI broke (handoff_reason is
// AI_ERROR_REASON) is NOT a human conversation. It resumes by itself
// when BOTH hold:
//   • the last AI error was more than AUTO_RESUME_MS ago, and
//   • no human has written in the chat since that error.
// A chat parked for any other reason (customer asked for a person,
// emergency, complaint) stays parked until a human returns it to the bot.
//
// Deliberately NOT gated on "assigned to a human": auto-assignment can
// set that on every conversation and the Return-to-bot button does not
// clear it, so gating on it would mute the bot everywhere.

/** Exact text used everywhere an AI failure parks a conversation. */
export const AI_ERROR_REASON = 'AI could not respond — needs human follow-up'

/** How long after the last AI error a pure-error park may resume. */
export const AUTO_RESUME_MS = 30 * 60 * 1000

/** Errors inside this window count toward escalating to a human. */
export const ERROR_WINDOW_MS = 15 * 60 * 1000
/** This many AI errors inside the window escalate. 1 error = apologise only. */
export const ERROR_ESCALATION_THRESHOLD = 2

export type GateDecision = 'allow' | 'resume' | 'block'

export interface GateFacts {
  status: string | null | undefined
  needsAttention: boolean | null | undefined
  handoffReason: string | null | undefined
  /** Time of the latest agent_usage_logs row with an error for this chat. */
  lastErrorAt: Date | null
  /** Time of the latest message from a human teammate. */
  lastHumanAt: Date | null
  now: Date
}

export function isAiErrorReason(reason: string | null | undefined): boolean {
  return (reason ?? '').trim() === AI_ERROR_REASON
}

/** Pure decision. All the policy is here so it can be tested without a DB. */
export function decideGate(f: GateFacts): GateDecision {
  const parked = f.status === 'pending' || f.needsAttention === true
  if (!parked) return 'allow'

  if (!isAiErrorReason(f.handoffReason)) return 'block'

  // Parked only because the AI failed.
  const quietFor = f.lastErrorAt ? f.now.getTime() - f.lastErrorAt.getTime() : Infinity
  if (quietFor < AUTO_RESUME_MS) return 'block'

  // A human has joined since the error: leave them to it.
  if (f.lastHumanAt && (!f.lastErrorAt || f.lastHumanAt.getTime() > f.lastErrorAt.getTime())) {
    return 'block'
  }
  return 'resume'
}

/** Should this error count escalate to a human handoff? */
export function shouldEscalateErrors(recentErrorCount: number): boolean {
  return recentErrorCount >= ERROR_ESCALATION_THRESHOLD
}

// ── Database side ────────────────────────────────────────────────────
// `db` is a Supabase client (typed loosely, like the rest of the agent code).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export interface GateResult {
  allowed: boolean
  resumed: boolean
}

function toDate(v: unknown): Date | null {
  if (typeof v !== 'string' && !(v instanceof Date)) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Read the conversation and decide. Fails OPEN on a database error: a
 * flaky read should not silence every chat. (A stuck 'pending' chat is
 * the lesser evil compared with the bot going mute platform-wide.)
 */
export async function checkBotGate(db: Db, conversationId: string, now: Date = new Date()): Promise<GateResult> {
  try {
    const { data: conv, error } = await db
      .from('conversations')
      .select('status, needs_attention, handoff_reason')
      .eq('id', conversationId)
      .maybeSingle()
    if (error || !conv) return { allowed: true, resumed: false }

    const parked = conv.status === 'pending' || conv.needs_attention === true
    if (!parked) return { allowed: true, resumed: false }

    let lastErrorAt: Date | null = null
    let lastHumanAt: Date | null = null

    if (isAiErrorReason(conv.handoff_reason)) {
      const { data: errRow } = await db
        .from('agent_usage_logs')
        .select('created_at')
        .eq('conversation_id', conversationId)
        .not('error', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      lastErrorAt = toDate(errRow?.created_at)

      const { data: humanRow } = await db
        .from('messages')
        .select('created_at')
        .eq('conversation_id', conversationId)
        .not('sender_type', 'in', '(customer,bot)')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      lastHumanAt = toDate(humanRow?.created_at)
    }

    const decision = decideGate({
      status: conv.status,
      needsAttention: conv.needs_attention,
      handoffReason: conv.handoff_reason,
      lastErrorAt,
      lastHumanAt,
      now,
    })

    if (decision === 'resume') {
      await db
        .from('conversations')
        .update({
          status: 'open',
          needs_attention: false,
          handoff_reason: null,
          updated_at: now.toISOString(),
        })
        .eq('id', conversationId)
      return { allowed: true, resumed: true }
    }
    return { allowed: decision === 'allow', resumed: false }
  } catch (err) {
    console.error('[handoff-gate] check failed, allowing bot:', err)
    return { allowed: true, resumed: false }
  }
}

/** How many AI errors this conversation had in the escalation window. */
export async function countRecentErrors(db: Db, conversationId: string, now: Date = new Date()): Promise<number> {
  try {
    const since = new Date(now.getTime() - ERROR_WINDOW_MS).toISOString()
    const { count, error } = await db
      .from('agent_usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .not('error', 'is', null)
      .gte('created_at', since)
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

/** Park the conversation for a human. Never throws. */
export async function markHandoff(db: Db, conversationId: string, reason: string): Promise<void> {
  try {
    await db
      .from('conversations')
      .update({
        status: 'pending',
        needs_attention: true,
        handoff_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
  } catch (err) {
    console.error('[handoff-gate] markHandoff failed:', err)
  }
}

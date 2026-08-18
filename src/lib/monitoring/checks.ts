// src/lib/monitoring/checks.ts
//
// The judgement half of health monitoring: given rows from the
// database, decide what counts as a problem.
//
// ── WHY NOT JUST USE SENTRY ──────────────────────────────────────────
// Sentry catches crashes. Almost nothing that has gone wrong in this
// product crashed. A run through the bugs found in one week:
//
//   • an agent booking a consultation at midnight
//   • "let me check availability" and then permanent silence
//   • media never sending on WhatsApp
//   • a widget quietly ignoring the agent it was told to use
//   • delivery tracking never recording a single send
//   • Meta's retries producing two replies and two model charges
//
// Every one returned 200 OK. Every one was found by a human noticing
// something odd. None would have raised an exception anywhere.
//
// So these checks ask business questions instead: did the customer get
// an answer, did they get two, is the appointment inside opening hours,
// is the campaign actually moving. The failure mode here is silence,
// and silence is what this looks for.
//
// The pure functions live here so the thresholds can be tested without
// a database; the queries that feed them live in the cron route.

import { isOpenAt, type BusinessHours } from '@/lib/agent/business-hours'

export type Severity = 'critical' | 'warning' | 'info'

export interface Finding {
  /** Stable identifier, so findings can be grouped across runs. */
  code: string
  severity: Severity
  /** One line, readable by someone who did not write the code. */
  title: string
  /** What to look at, and where. */
  detail: string
  /** The conversation, broadcast or agent involved, when there is one. */
  subjectId?: string | null
  /** How many instances this finding represents. */
  count: number
}

/* ─────────────────────────────────────────────────────────────────────
   Unanswered conversations
   ───────────────────────────────────────────────────────────────────── */

export interface MessageStub {
  conversationId: string
  senderType: 'customer' | 'bot' | 'agent'
  createdAt: string
}

/**
 * A customer wrote, and nobody — bot or human — has answered.
 *
 * This is the check that would have caught the two worst bugs of the
 * week: the WhatsApp agent that was never wired up, and the replies
 * that promised to come back and never did.
 *
 * `graceMinutes` exists so a message that arrived seconds ago is not
 * reported as ignored. Conversations already handed to a human are
 * excluded by the caller — a person taking over is the system working,
 * not failing.
 */
export function findUnanswered(
  messages: MessageStub[],
  now: Date,
  graceMinutes: number,
): Finding[] {
  const byConversation = new Map<string, MessageStub[]>()
  for (const m of messages) {
    const list = byConversation.get(m.conversationId) ?? []
    list.push(m)
    byConversation.set(m.conversationId, list)
  }

  const stranded: string[] = []

  for (const [conversationId, list] of byConversation) {
    const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const last = sorted[sorted.length - 1]
    if (!last || last.senderType !== 'customer') continue

    const waitedMs = now.getTime() - new Date(last.createdAt).getTime()
    if (waitedMs >= graceMinutes * 60_000) stranded.push(conversationId)
  }

  if (stranded.length === 0) return []

  return [
    {
      code: 'unanswered_conversation',
      severity: 'critical',
      title: `${stranded.length} customer${stranded.length === 1 ? '' : 's'} waiting with no reply`,
      detail:
        `The last message in ${stranded.length === 1 ? 'this conversation' : 'these conversations'} came from the customer over ` +
        `${graceMinutes} minutes ago and nothing has answered. Check the agent is switched on, that WhatsApp has an agent assigned, ` +
        `and that the conversation is not stuck awaiting a human.`,
      subjectId: stranded[0],
      count: stranded.length,
    },
  ]
}

/* ─────────────────────────────────────────────────────────────────────
   Duplicate replies
   ───────────────────────────────────────────────────────────────────── */

/**
 * Two bot messages sent to the same conversation within a few seconds.
 *
 * Almost always one inbound message processed twice — which is exactly
 * what Meta's webhook retries used to cause. It costs money as well as
 * credibility: every duplicate is a second model call.
 *
 * Deliberately narrow. An agent legitimately sends a text and then an
 * image together, so only replies that are *both* very close together
 * and textually identical are reported.
 */
export function findDuplicateReplies(
  messages: Array<MessageStub & { text: string | null }>,
  withinSeconds: number,
): Finding[] {
  const byConversation = new Map<string, Array<MessageStub & { text: string | null }>>()
  for (const m of messages) {
    if (m.senderType !== 'bot') continue
    const list = byConversation.get(m.conversationId) ?? []
    list.push(m)
    byConversation.set(m.conversationId, list)
  }

  const offenders = new Set<string>()

  for (const [conversationId, list] of byConversation) {
    const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    for (let i = 1; i < sorted.length; i++) {
      const gapMs =
        new Date(sorted[i].createdAt).getTime() - new Date(sorted[i - 1].createdAt).getTime()
      const sameText =
        (sorted[i].text ?? '').trim() !== '' &&
        sorted[i].text?.trim() === sorted[i - 1].text?.trim()
      if (gapMs <= withinSeconds * 1000 && sameText) {
        offenders.add(conversationId)
        break
      }
    }
  }

  if (offenders.size === 0) return []

  return [
    {
      code: 'duplicate_reply',
      severity: 'critical',
      title: `${offenders.size} conversation${offenders.size === 1 ? '' : 's'} received the same reply twice`,
      detail:
        'Identical replies were sent within seconds of each other, which normally means one inbound message was processed twice. ' +
        'Check the webhook is deduplicating on message_id and that migration 023 has been applied.',
      subjectId: [...offenders][0],
      count: offenders.size,
    },
  ]
}

/* ─────────────────────────────────────────────────────────────────────
   Appointments outside opening hours
   ───────────────────────────────────────────────────────────────────── */

export interface AppointmentStub {
  id: string
  appointmentAt: string
  customerName: string | null
}

/**
 * An appointment booked when the business is shut.
 *
 * resolveSlot() should make this impossible, so anything found here
 * means either a booking created before that existed, or a path that
 * bypasses it. Worth knowing either way — this is the check for the
 * midnight-consultation bug staying fixed.
 */
export function findOutOfHoursBookings(
  appointments: AppointmentStub[],
  hours: BusinessHours,
): Finding[] {
  const bad = appointments.filter((a) => {
    const at = new Date(a.appointmentAt)
    return !Number.isNaN(at.getTime()) && !isOpenAt(at, hours)
  })

  if (bad.length === 0) return []

  return [
    {
      code: 'out_of_hours_booking',
      severity: 'warning',
      title: `${bad.length} appointment${bad.length === 1 ? '' : 's'} booked outside opening hours`,
      detail:
        'These fall when the business is closed. Either the agent bypassed the opening-hours check, or the hours on the agent ' +
        'do not match reality. Check Agents → Configure → Opening hours.',
      subjectId: bad[0].id,
      count: bad.length,
    },
  ]
}

/* ─────────────────────────────────────────────────────────────────────
   Simple threshold checks
   ───────────────────────────────────────────────────────────────────── */

/** WhatsApp is connected but no agent is assigned, so nothing answers. */
export function checkWhatsAppAgentAssigned(
  connected: boolean,
  agentId: string | null,
): Finding[] {
  if (!connected || agentId) return []
  return [
    {
      code: 'whatsapp_agent_unset',
      severity: 'critical',
      title: 'WhatsApp is connected but no AI agent is assigned',
      detail:
        'Inbound messages that no chat flow matches will go unanswered. Pick an agent on the Agents page under ' +
        '"Which agent answers WhatsApp".',
      count: 1,
    },
  ]
}

/** A campaign that stopped part-way and was never resumed. */
export function checkStalledBroadcasts(
  stalled: Array<{ id: string; name: string | null; pending: number }>,
): Finding[] {
  const real = stalled.filter((b) => b.pending > 0)
  if (real.length === 0) return []

  const worst = real.reduce((a, b) => (b.pending > a.pending ? b : a))
  const totalPending = real.reduce((sum, b) => sum + b.pending, 0)

  return [
    {
      code: 'stalled_broadcast',
      severity: 'warning',
      title: `${real.length} campaign${real.length === 1 ? '' : 's'} stopped part-way — ${totalPending} recipients never sent`,
      detail:
        'Sending runs in the browser, so closing the tab stops a campaign. Open the campaign and press "Resume sending" ' +
        `to finish it. Largest outstanding: ${worst.name ?? worst.id} with ${worst.pending} waiting.`,
      subjectId: worst.id,
      count: totalPending,
    },
  ]
}

/** Messages Meta rejected. A few is normal; a spike is not. */
export function checkFailedMessages(failedCount: number, threshold: number): Finding[] {
  if (failedCount < threshold) return []
  return [
    {
      code: 'failed_messages',
      severity: failedCount >= threshold * 5 ? 'critical' : 'warning',
      title: `${failedCount} messages failed to send in the last 24 hours`,
      detail:
        'Common causes: the access token expired, the number hit its Meta messaging limit, or a template was rejected. ' +
        'Check Settings → WhatsApp for the connection status.',
      count: failedCount,
    },
  ]
}

/** The agent engine threw. Rare, and always worth reading. */
export function checkAgentErrors(
  errors: Array<{ error: string | null }>,
): Finding[] {
  const real = errors.filter((e) => e.error)
  if (real.length === 0) return []

  // Group by message so one broken thing reported a hundred times reads
  // as one problem, not a hundred.
  const counts = new Map<string, number>()
  for (const e of real) {
    const key = (e.error ?? '').slice(0, 120)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const [topMessage, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]

  return [
    {
      code: 'agent_errors',
      severity: 'critical',
      title: `The AI agent failed ${real.length} time${real.length === 1 ? '' : 's'} in the last 24 hours`,
      detail: `Most common: "${topMessage}" (${topCount}×). Customers hitting this were told a team member would follow up.`,
      count: real.length,
    },
  ]
}

/** Highest severity first, then most instances. */
export function rankFindings(findings: Finding[]): Finding[] {
  const weight: Record<Severity, number> = { critical: 0, warning: 1, info: 2 }
  return [...findings].sort(
    (a, b) => weight[a.severity] - weight[b.severity] || b.count - a.count,
  )
}

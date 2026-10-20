// The Campaign Agent's state machine. Runs from /api/cron/campaign-agent.
//
// Each campaign is a list of steps in groups: group 0 is the first message
// (one or more A/B versions), later groups are follow-ups. A step moves
//   waiting_template -> ready -> sending -> done   (or failed / skipped)
// Nothing here sends a WhatsApp message. When a step is due it queues the
// recipients and hands the broadcast to the existing sender (see
// prepareRecipients), so opt-out, credits and rate pacing stay in one place.
//
// Safe to run twice at once: a step is claimed with a conditional update, and
// the database allows one broadcast per step (campaign_step_id is unique).

import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrgBalance, getOrgIdForUser, getTemplateCategory, priceForCategory } from '@/lib/billing/credits'
import { firstName, followupContacts, prepareRecipients, resolveAudience, retryContacts, type AudienceContact, type CampaignAudience, type FollowupRule } from './audience'
import { rewriteMessage } from './rewrite'
import { rejectionReason, submitTemplate } from './templates'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>

export type StepStatus = 'waiting_template' | 'ready' | 'sending' | 'done' | 'skipped' | 'failed'

export interface Step {
  id: string
  campaign_id: string
  grp: number
  variant: number
  label: string
  body: string
  kind: 'main' | 'retry'
  retry_of: string | null
  retry_checked: boolean
  rewrite_count: number
  image_url: string | null
  template_name: string
  template_language: string
  wait_hours: number
  rule: FollowupRule | null
  status: StepStatus
  broadcast_id: string | null
  run_at: string | null
  completed_at: string | null
  updated_at: string
}

export interface Campaign {
  id: string
  user_id: string
  business_id: string | null
  name: string
  status: string
  audience: CampaignAudience
  rollover: boolean
  image_url: string | null
  plan: { sampleName?: string } | null
}

/** A rejected message is rewritten by AI and resubmitted at most this many times. */
export const MAX_REWRITES = 2

const TERMINAL: StepStatus[] = ['done', 'skipped', 'failed']
export const isTerminal = (s: StepStatus) => TERMINAL.includes(s)

// ── Pure rules (unit-tested) ──────────────────────────────────────────────

export function templateVerdict(status: string | null | undefined): 'ready' | 'wait' | 'rejected' {
  const s = (status ?? '').toLowerCase()
  if (s === 'approved') return 'ready'
  if (s === 'rejected') return 'rejected'
  return 'wait'
}

/** Round-robin split, so every A/B version gets an equal share. */
export function splitVariants<T>(items: T[], n: number): T[][] {
  const buckets: T[][] = Array.from({ length: Math.max(1, n) }, () => [])
  items.forEach((item, i) => buckets[i % buckets.length].push(item))
  return buckets
}

/** When a follow-up group may start: after the whole previous group finished, plus its wait. */
export function groupRunAt(prev: Step[], waitHours: number): Date | null {
  if (prev.length === 0 || prev.some((s) => !isTerminal(s.status))) return null
  const done = prev.map((s) => (s.completed_at ? new Date(s.completed_at).getTime() : 0))
  return new Date(Math.max(...done) + waitHours * 3600_000)
}

export function campaignOutcome(steps: Step[]): 'running' | 'completed' | 'failed' {
  if (steps.some((s) => !isTerminal(s.status))) return 'running'
  const first = steps.filter((s) => s.grp === 0)
  return first.length > 0 && first.every((s) => s.status === 'failed') ? 'failed' : 'completed'
}

// ── The tick ──────────────────────────────────────────────────────────────

export interface TickReport {
  campaigns: number
  started: number
  completed: number
  paused: number
}

export async function tick(db: Db, now = new Date(), budgetMs = 40_000): Promise<TickReport> {
  const t0 = Date.now()
  const report: TickReport = { campaigns: 0, started: 0, completed: 0, paused: 0 }
  const { data: campaigns } = await db
    .from('campaign_agents')
    .select('id, user_id, business_id, name, status, audience, rollover, image_url, plan')
    .eq('status', 'running')
    .order('launched_at', { ascending: true })
    .limit(25)

  for (const c of (campaigns ?? []) as Campaign[]) {
    if (Date.now() - t0 > budgetMs) break
    report.campaigns++
    try {
      await runCampaign(db, c, now, report)
    } catch (err) {
      console.error('[campaign-agent] tick failed for', c.id, err)
    }
  }
  return report
}

async function loadSteps(db: Db, campaignId: string): Promise<Step[]> {
  const { data } = await db.from('campaign_steps').select('*').eq('campaign_id', campaignId).order('grp').order('variant')
  return (data ?? []) as Step[]
}

async function patchStep(db: Db, id: string, patch: Record<string, unknown>, onlyIfStatus?: StepStatus): Promise<boolean> {
  let q = db.from('campaign_steps').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (onlyIfStatus) q = q.eq('status', onlyIfStatus)
  const { data } = await q.select('id')
  return (data ?? []).length > 0
}

async function runCampaign(db: Db, c: Campaign, now: Date, report: TickReport) {
  let steps = await loadSteps(db, c.id)

  // 1. Template approval (Meta approves them in the background).
  for (const s of steps.filter((x) => x.status === 'waiting_template')) {
    const { data: t } = await db
      .from('message_templates')
      .select('status')
      .eq('user_id', c.user_id)
      .eq('name', s.template_name)
      .eq('language', s.template_language)
      .maybeSingle()
    const v = templateVerdict(t?.status)
    if (v === 'ready') await patchStep(db, s.id, { status: 'ready' }, 'waiting_template')
    else if (v === 'rejected') await handleRejected(db, c, s, now)
  }

  // 2. Sending steps: finished? orphaned?
  steps = await loadSteps(db, c.id)
  for (const s of steps.filter((x) => x.status === 'sending')) {
    if (!s.broadcast_id) {
      const { data: existing } = await db.from('broadcasts').select('id').eq('campaign_step_id', s.id).maybeSingle()
      if (existing) await patchStep(db, s.id, { broadcast_id: existing.id })
      else if (now.getTime() - new Date(s.updated_at).getTime() > 10 * 60_000) await patchStep(db, s.id, { status: 'ready' }, 'sending')
      continue
    }
    const { data: b } = await db.from('broadcasts').select('status, sent_count').eq('id', s.broadcast_id).maybeSingle()
    if (b?.status === 'sent') await patchStep(db, s.id, { status: 'done', completed_at: now.toISOString() })
    else if (b?.status === 'failed') await patchStep(db, s.id, { status: 'failed', error: 'Sending failed for every contact.', completed_at: now.toISOString() })
  }

  // 2b. A finished message with temporary delivery failures gets ONE retry.
  steps = await loadSteps(db, c.id)
  for (const s of steps.filter((x) => x.kind === 'main' && x.status === 'done' && !x.retry_checked && x.broadcast_id)) {
    await queueRetry(db, c, s, steps, now)
  }

  // 3. Schedule follow-up groups once the previous group is finished.
  steps = await loadSteps(db, c.id)
  const groups = [...new Set(steps.map((s) => s.grp))].sort((a, b) => a - b)
  for (const g of groups) {
    const cur = steps.filter((s) => s.grp === g && s.kind !== 'retry')
    if (g === 0) {
      for (const s of cur) if (!s.run_at && s.status === 'ready') await patchStep(db, s.id, { run_at: now.toISOString() })
      continue
    }
    const prev = steps.filter((s) => s.grp === g - 1)
    const prevOk = prev.some((s) => s.status === 'done')
    for (const s of cur.filter((x) => !isTerminal(x.status) && x.status !== 'sending')) {
      if (prev.some((p) => !isTerminal(p.status))) continue
      if (!prevOk) { await patchStep(db, s.id, { status: 'skipped', error: 'The previous message was not sent.', completed_at: now.toISOString() }); continue }
      if (!s.run_at) {
        const at = groupRunAt(prev, s.wait_hours)
        if (at) await patchStep(db, s.id, { run_at: at.toISOString() })
      }
    }
  }

  // 4. Start every step that is approved and due.
  steps = await loadSteps(db, c.id)
  const due = steps.filter((s) => s.status === 'ready' && s.run_at && new Date(s.run_at) <= now)
  for (const r of due.filter((x) => x.kind === 'retry')) {
    const ok = await startRetry(db, c, steps, r, now)
    if (ok === 'paused') { report.paused++; return }
    if (ok === 'started') report.started++
  }
  const byGroup = new Map<number, Step[]>()
  for (const s of due.filter((x) => x.kind !== 'retry')) byGroup.set(s.grp, [...(byGroup.get(s.grp) ?? []), s])
  for (const [g, list] of [...byGroup.entries()].sort((a, b) => a[0] - b[0])) {
    const ok = await startGroup(db, c, steps, g, list, now)
    if (ok === 'paused') { report.paused++; break }
    if (ok === 'started') report.started += list.length
  }

  // 5. Finished?
  steps = await loadSteps(db, c.id)
  const outcome = campaignOutcome(steps)
  if (outcome !== 'running') {
    await db.from('campaign_agents').update({ status: outcome, updated_at: now.toISOString() }).eq('id', c.id).eq('status', 'running')
    report.completed++
  }
}

async function startGroup(db: Db, c: Campaign, all: Step[], grp: number, list: Step[], now: Date): Promise<'started' | 'skipped' | 'paused'> {
  // Who gets it.
  let contacts: AudienceContact[]
  if (grp === 0) {
    contacts = (await resolveAudience(db, { userId: c.user_id, businessId: c.business_id }, c.audience, now)).contacts
  } else {
    const prevIds = all.filter((s) => s.grp === grp - 1 && s.broadcast_id).map((s) => s.broadcast_id as string)
    contacts = await followupContacts(db, { userId: c.user_id }, prevIds, list[0].rule ?? 'no_reply', !!c.rollover)
  }
  if (contacts.length === 0) {
    for (const s of list) await patchStep(db, s.id, { status: 'skipped', error: 'No one to send this to.', completed_at: now.toISOString() }, 'ready')
    return 'skipped'
  }

  if (!(await walletCovers(db, c, list[0], contacts.length, now))) return 'paused'

  const parts = grp === 0 ? splitVariants(contacts, list.length) : [contacts]
  for (let i = 0; i < list.length; i++) {
    const s = list[i]
    const part = parts[i] ?? []
    await launchStep(db, c, s, part, now)
  }
  return 'started'
}

/** Spend guard: never start what the wallet cannot cover. Pauses the campaign if it cannot. */
async function walletCovers(db: Db, c: Campaign, s: Step, count: number, now: Date): Promise<boolean> {
  const orgId = await getOrgIdForUser(db, c.user_id)
  if (!orgId) return true
  const category = await getTemplateCategory(db, c.user_id, s.template_name, s.template_language)
  const cost = count * priceForCategory(category)
  const balance = await getOrgBalance(db, orgId)
  if (balance >= cost) return true
  await db.from('campaign_agents').update({
    status: 'paused',
    error: `Not enough credits: this step needs about ₹${cost.toFixed(2)} and your balance is ₹${balance.toFixed(2)}. Add credits, then resume.`,
    updated_at: now.toISOString(),
  }).eq('id', c.id).eq('status', 'running')
  return false
}

/** Claims a ready step, creates its broadcast and queues the recipients. */
async function launchStep(db: Db, c: Campaign, s: Step, part: AudienceContact[], now: Date) {
  // Claim: only one tick can move a step out of 'ready'.
  if (!(await patchStep(db, s.id, { status: 'sending' }, 'ready'))) return
  if (part.length === 0) {
    await patchStep(db, s.id, { status: 'skipped', error: 'No one to send this to.', completed_at: now.toISOString() })
    return
  }
  let broadcastId: string | null = null
  const { data: created, error } = await db
    .from('broadcasts')
    .insert({
      user_id: c.user_id,
      business_id: c.business_id,
      name: `${c.name} · ${s.label}`,
      template_name: s.template_name,
      template_language: s.template_language,
      template_variables: { '1': { type: 'field', value: 'name' } },
      audience_filter: { type: 'all', _campaign_id: c.id },
      status: 'draft',
      total_recipients: part.length,
      sent_count: 0, delivered_count: 0, read_count: 0, replied_count: 0, failed_count: 0,
      campaign_step_id: s.id,
    })
    .select('id')
    .single()
  if (created) broadcastId = created.id
  else if (error?.code === '23505') {
    const { data: ex } = await db.from('broadcasts').select('id').eq('campaign_step_id', s.id).maybeSingle()
    broadcastId = ex?.id ?? null
  }
  if (!broadcastId) {
    await patchStep(db, s.id, { status: 'failed', error: `Could not create the broadcast: ${error?.message ?? 'unknown'}`, completed_at: now.toISOString() })
    return
  }
  await patchStep(db, s.id, { broadcast_id: broadcastId })
  await prepareRecipients(db, broadcastId, part, (ct) => [firstName(ct.name)])
}

// ── Rejected message: rewrite with AI and submit again ─────────────────────

async function handleRejected(db: Db, c: Campaign, s: Step, now: Date) {
  const fail = (error: string) => patchStep(db, s.id, { status: 'failed', error, completed_at: now.toISOString() }, 'waiting_template')
  const reason = await rejectionReason(db, c.user_id, s.template_name, s.template_language)
  if (s.rewrite_count >= MAX_REWRITES) {
    await patchStep(db, s.id, { rejection_reason: reason }, 'waiting_template')
    await fail(`Meta rejected this message even after ${MAX_REWRITES} AI rewrites${reason ? ` (${reason})` : ''}. Edit the wording and start a new campaign.`)
    return
  }
  // Claim the rewrite so two ticks cannot submit the same name twice.
  const { data: claimed } = await db
    .from('campaign_steps')
    .update({ rewrite_count: s.rewrite_count + 1, rejection_reason: reason, updated_at: now.toISOString() })
    .eq('id', s.id).eq('status', 'waiting_template').eq('rewrite_count', s.rewrite_count)
    .select('id')
  if (!claimed || claimed.length === 0) return

  const nb = await rewriteMessage({ body: s.body, rejectionReason: reason })
  if (!nb) {
    await fail(`Meta rejected this message${reason ? ` (${reason})` : ''} and the AI could not rewrite it. Edit the wording and start a new campaign.`)
    return
  }
  const name = `${s.template_name.replace(/_r\d+$/, '')}_r${s.rewrite_count + 1}`
  try {
    const r = await submitTemplate(db, c.user_id, { name, body: nb, sampleName: c.plan?.sampleName || 'Priya', imageUrl: s.image_url ?? c.image_url })
    await patchStep(db, s.id, {
      body: nb,
      template_name: name,
      status: r.status === 'Approved' ? 'ready' : 'waiting_template',
      error: null,
    }, 'waiting_template')
  } catch (e) {
    await fail(`Meta rejected this message and the rewritten version was not accepted either: ${e instanceof Error ? e.message : 'unknown error'}`)
  }
}

// ── Failed deliveries: one retry, through another approved version ─────────

export function pickRetryTemplate(done: Step, siblings: Step[]): Step {
  const others = siblings.filter((x) => x.id !== done.id && x.kind === 'main' && x.grp === done.grp && x.status === 'done' && x.template_name !== done.template_name)
  return others[0] ?? done
}

async function queueRetry(db: Db, c: Campaign, s: Step, all: Step[], now: Date) {
  const failedTemporarily = await retryContacts(db, { userId: c.user_id }, s.broadcast_id as string)
  // Mark checked first-ish: a retry is created at most once per step (unique index on retry_of).
  await db.from('campaign_steps').update({ retry_checked: true, updated_at: now.toISOString() }).eq('id', s.id)
  if (failedTemporarily.length === 0) return
  const via = pickRetryTemplate(s, all)
  const { error } = await db.from('campaign_steps').insert({
    campaign_id: c.id,
    grp: s.grp,
    variant: 100 + s.variant,
    label: `${s.label} (retry)`,
    body: via.body,
    template_name: via.template_name,
    template_language: via.template_language,
    wait_hours: 0,
    rule: null,
    status: 'ready',
    run_at: now.toISOString(),
    kind: 'retry',
    retry_of: s.id,
    retry_checked: true,
    image_url: via.image_url,
  })
  if (error && error.code !== '23505') console.error('[campaign-agent] could not queue retry', error.message)
}

async function startRetry(db: Db, c: Campaign, all: Step[], r: Step, now: Date): Promise<'started' | 'skipped' | 'paused'> {
  const original = all.find((x) => x.id === r.retry_of)
  const contacts = original?.broadcast_id ? await retryContacts(db, { userId: c.user_id }, original.broadcast_id) : []
  if (contacts.length === 0) {
    await patchStep(db, r.id, { status: 'skipped', error: 'Nothing to retry.', completed_at: now.toISOString() }, 'ready')
    return 'skipped'
  }
  if (!(await walletCovers(db, c, r, contacts.length, now))) return 'paused'
  await launchStep(db, c, r, contacts, now)
  return 'started'
}

// src/app/api/agent/train-from-url/route.ts
//
// ── WHAT THIS DOES ───────────────────────────────────────────────────
// One button, "Train from your website", doing two jobs from one URL:
//
//   1. KNOWLEDGE — saves the page as a brain_source and chunks it into
//      agent_kb_chunks, so the agent can quote real facts back to a
//      customer. This reuses ingestSource(), the exact same path the
//      Brain page uses.
//
//   2. PERSONA — feeds the page text to the LLM and asks it to DRAFT a
//      persona describing this specific business.
//
// ── WHY THE PERSONA IS RETURNED, NOT SAVED ───────────────────────────
// An LLM reading a website will confidently invent things it did not
// read: delivery windows, refund terms, discounts. If we wrote that
// straight into a live agent, it would start promising customers things
// the business never agreed to.
//
// So this route RETURNS the draft. The drawer drops it into the persona
// box, the human reads it and presses Save. Knowledge (real, quoted text)
// is safe to store automatically; a generated personality is not.
//
// ── WHY IT NEEDS A JOURNEY ───────────────────────────────────────────
// brain_sources and agent_kb_chunks are keyed by journey_id — that is
// how the retriever scopes a search to one agent's knowledge. Agents
// created from a template have journey_id = null, so this route creates
// the journey on demand and links it back to the agent. That is the one
// missing wire that made the whole knowledge feature unreachable.
//
// Body:    { agent_id, url }
// Returns: { journey_id, persona, chunks, title }

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ingestSource } from '@/lib/agent/rag/ingest'
import { callLLM } from '@/lib/agent/llm-provider'

// Mutating action — never cache it.
export const dynamic = 'force-dynamic'

/** Hard ceiling on fetched HTML. A 50MB page should not take the app down. */
const MAX_HTML_BYTES = 2_000_000
/** How much page text the LLM sees. Enough for an "about us"; cheap to run. */
const MAX_TEXT_FOR_LLM = 12_000

/**
 * Accept only public http(s) URLs.
 *
 * Without this check the server would happily fetch http://localhost or
 * http://169.254.169.254 (the cloud metadata endpoint) on a user's
 * behalf — a textbook SSRF that can leak deployment credentials.
 */
function validatePublicUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return { ok: false, reason: 'That does not look like a valid URL.' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'Only http and https addresses can be read.' }
  }

  const host = url.hostname.toLowerCase()
  const isPrivate =
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)

  if (isPrivate) {
    return { ok: false, reason: 'That address is not reachable from the public internet.' }
  }
  return { ok: true, url }
}

/** Crude HTML → text. Good enough to describe a business to an LLM. */
function htmlToText(html: string): string {
  return html
    // Drop anything whose contents are code or styling, tags included.
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    // Turn block ends into newlines so sentences don't run together.
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    // Decode the handful of entities that actually show up in body copy.
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    // Collapse the whitespace the tag-stripping left behind.
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
}

/** Pull <title> for a sensible source name in the knowledge list. */
function extractTitle(html: string, fallback: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match?.[1]?.trim().slice(0, 120) || fallback
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const agentId: string | undefined = body?.agent_id
    const rawUrl: string | undefined = body?.url

    if (!agentId || !rawUrl) {
      return NextResponse.json({ error: 'agent_id and url are required' }, { status: 400 })
    }

    const checked = validatePublicUrl(rawUrl)
    if (!checked.ok) {
      return NextResponse.json({ error: checked.reason }, { status: 400 })
    }

    // ── The agent must belong to the caller ──
    // Never trust an id from the browser; without this anyone could
    // train (and read the journey of) another tenant's agent.
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id, tenant_id, name, industry, journey_id')
      .eq('id', agentId)
      .eq('tenant_id', user.id)
      .maybeSingle()

    if (agentErr || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // ── 1. Fetch the page ──
    let html: string
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)
      const res = await fetch(checked.url.toString(), {
        signal: controller.signal,
        headers: {
          // Identify honestly. Some sites block unknown agents outright,
          // and pretending to be a browser is a good way to get banned.
          'User-Agent': 'AiSendBot/1.0 (+website training)',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      })
      clearTimeout(timeout)

      if (!res.ok) {
        return NextResponse.json(
          { error: `The site returned ${res.status}. Check the address is public.` },
          { status: 422 },
        )
      }

      const buffer = await res.arrayBuffer()
      if (buffer.byteLength > MAX_HTML_BYTES) {
        return NextResponse.json(
          { error: 'That page is too large to read. Try a specific page like /about.' },
          { status: 422 },
        )
      }
      html = new TextDecoder().decode(buffer)
    } catch {
      return NextResponse.json(
        { error: "Couldn't reach that page. Check the address and try again." },
        { status: 422 },
      )
    }

    const text = htmlToText(html)
    if (text.length < 200) {
      return NextResponse.json(
        {
          error:
            'That page had almost no readable text — it may be JavaScript-rendered. Try a simpler page, or paste your content manually.',
        },
        { status: 422 },
      )
    }

    const title = extractTitle(html, checked.url.hostname)

    // ── 2. Make sure the agent has a journey ──
    // This is the wire that was missing: knowledge is scoped by
    // journey_id, so an agent without one can never own any.
    let journeyId = agent.journey_id
    if (!journeyId) {
      const { data: journey, error: journeyErr } = await supabase
        .from('journeys')
        .insert({
          user_id: user.id,
          name: `${agent.name} knowledge`,
          status: 'draft',
          trigger: { type: 'keyword', keywords: [] },
          nodes: [],
          edges: [],
        })
        .select('id')
        .single()

      if (journeyErr || !journey) {
        return NextResponse.json(
          { error: 'Could not create a knowledge space for this agent.' },
          { status: 500 },
        )
      }
      journeyId = journey.id
      await supabase.from('agents').update({ journey_id: journeyId }).eq('id', agent.id)
    }

    // ── 3. Store the page as a knowledge source, then chunk it ──
    const { data: source, error: sourceErr } = await supabase
      .from('brain_sources')
      .insert({
        user_id: user.id,
        journey_id: journeyId,
        type: 'url',
        title,
        source_url: checked.url.toString(),
        status: 'processing',
      })
      .select('id')
      .single()

    if (sourceErr || !source) {
      return NextResponse.json(
        { error: 'Could not save the source. Run the brain_sources migration.' },
        { status: 500 },
      )
    }

    const ingested = await ingestSource({
      tenantId: user.id,
      journeyId,
      sourceId: source.id,
      sourceType: 'url',
      url: checked.url.toString(),
    })

    // ── 4. Draft a persona from what we read ──
    // Failure here must not fail the request: the knowledge is already
    // stored and useful on its own, so we return an empty persona and
    // let the user keep the template's wording.
    let persona = ''
    try {
      persona = await draftPersona({
        text: text.slice(0, MAX_TEXT_FOR_LLM),
        agentName: agent.name,
        industry: agent.industry,
        siteUrl: checked.url.toString(),
      })
    } catch (err) {
      console.error('[train-from-url] persona draft failed:', err)
    }

    return NextResponse.json({
      journey_id: journeyId,
      persona,
      title,
      chunks: ingested.chunksCreated,
      status: ingested.status,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    )
  }
}

/**
 * Ask the model to write a persona for THIS business.
 *
 * The instructions matter as much as the page text. Two rules do the
 * heavy lifting: write in the second person (the persona is read by the
 * agent, not about it), and never state a fact that wasn't on the page.
 * Without the second rule the model happily invents delivery times.
 */
async function draftPersona(args: {
  text: string
  agentName: string
  industry: string | null
  siteUrl: string
}): Promise<string> {
  const system = `You write system prompts ("personas") for WhatsApp customer-facing AI agents.

You will be given the text of a business's website. Write the persona that agent should use.

Rules for what you write:
- Address the agent directly in the second person: "You are…", "Always…", "Never…".
- Open with one sentence naming what the business actually does, taken from the page.
- Include an "Always:" list of 3-5 concrete behaviours suited to this business.
- Include a "Never:" list of 2-3 rules, and ALWAYS include this one verbatim:
  "Never state a price, delivery time or policy that is not in your knowledge base — offer to check with the team instead."
- Keep it under 220 words. It is a working instruction, not marketing copy.

Rules for accuracy:
- Use ONLY facts present in the page text. If the page does not mention prices, delivery, or hours, do not invent them.
- If the page is thin or unclear, write a shorter, more general persona rather than guessing.

Output the persona text only. No preamble, no markdown headings, no explanation.`

  const user = `Business website: ${args.siteUrl}
Agent name: ${args.agentName}${args.industry ? `\nIndustry: ${args.industry}` : ''}

Page text:
"""
${args.text}
"""`

  const response = await callLLM(system, [{ role: 'user', text: user }], [])
  return (response.text || '').trim()
}

// src/app/api/agent/train-from-url/route.ts
//
// One field, one button: paste your website address and get back an
// agent that already knows the business — its name, its logo, its
// services, its pages.
//
// ── WHAT CHANGED, AND WHY IT MATTERS ─────────────────────────────────
// This route used to fetch exactly ONE page. That is enough to draft a
// persona and almost nothing else: the pricing page, the services page
// and the contact details all sat one link away and were never read.
// A customer asking "what do you charge?" got a shrug from an agent
// whose own website answered the question.
//
// It now walks the site (see rag/site-crawler.ts) and returns three
// things instead of one:
//
//   1. KNOWLEDGE  — every readable page, chunked into agent_kb_chunks,
//                   each chunk labelled with the page it came from so
//                   an answer can be traced back.
//   2. BRAND      — the business name, logo and colour, read from the
//                   site's own metadata. This is what makes pasting a
//                   URL feel like magic instead of like a form.
//   3. FACTS      — phone, address, services, hours, pulled out by the
//                   model into a small structured object.
//
// ── WHAT IS SAVED AND WHAT IS ONLY SUGGESTED ─────────────────────────
// Knowledge is quoted text — safe to store. Everything the MODEL wrote
// (persona, structured facts) is RETURNED, not saved, and the drawer
// shows it for approval. An LLM reading a website will confidently
// invent delivery windows and refund terms; written straight into a
// live agent, it starts promising customers things the business never
// agreed to.
//
// The one exception is brand: name, logo and theme colour are read
// verbatim from the page's own metadata, not generated, so they are
// safe to pre-fill. The merchant still sees them before saving.
//
// Body:    { agent_id, url, max_pages? }
// Returns: { journey_id, persona, brand, facts, pages, chunks, skipped }

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ingestSource } from '@/lib/agent/rag/ingest'
import { callLLM } from '@/lib/agent/llm-provider'
import { crawlSite, withSourceHeader, type CrawlResult } from '@/lib/agent/rag/site-crawler'

// Mutating action — never cache it.
export const dynamic = 'force-dynamic'

// The crawl budget inside site-crawler is 40s; this leaves room for the
// two LLM calls and the database writes that follow it.
export const maxDuration = 60

/** How much site text each LLM call sees. Enough to describe a business. */
const MAX_TEXT_FOR_LLM = 14_000

/** Ceiling a caller can ask for. Beyond this the route runs out of time. */
const MAX_PAGES_CEILING = 20

export interface StructuredFacts {
  business_name: string | null
  what_they_do: string | null
  services: string[]
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  hours: string | null
  // ── The agent's own opening, drafted from the site ──
  //
  // A generic "Hi, how can I help?" wastes the first message — the one
  // moment a visitor is definitely reading. Naming the business and
  // offering three real questions turns the greeting into a menu, which
  // is what makes a chat widget convert rather than sit closed.
  role: string | null
  greeting: string | null
  suggested_questions: string[]
}

const EMPTY_FACTS: StructuredFacts = {
  business_name: null,
  what_they_do: null,
  services: [],
  phone: null,
  whatsapp: null,
  email: null,
  address: null,
  hours: null,
  role: null,
  greeting: null,
  suggested_questions: [],
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

    const maxPages = Math.min(
      Math.max(Number(body?.max_pages) || 12, 1),
      MAX_PAGES_CEILING,
    )

    // ── The agent must belong to the caller ──
    // Never trust an id from the browser; without this anyone could
    // train (and read the journey of) another tenant's agent.
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id, tenant_id, name, industry, journey_id, business_id')
      .eq('id', agentId)
      .eq('tenant_id', user.id)
      .maybeSingle()

    if (agentErr || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // ── 1. Read the site ──
    // URL validation lives inside crawlSite and is applied to every link
    // it follows, not just this one. A crawler that checks only its seed
    // will happily fetch an internal address on our behalf.
    const crawl = await crawlSite(rawUrl, { maxPages, maxDepth: 1 })

    if (crawl.pages.length === 0) {
      return NextResponse.json({ error: explainEmptyCrawl(crawl) }, { status: 422 })
    }

    // ── 2. Make sure the agent has a journey ──
    // Knowledge is scoped by journey_id, so an agent without one can
    // never own any. Agents created from a template start with none.
    let journeyId = agent.journey_id
    if (!journeyId) {
      const { data: journey, error: journeyErr } = await supabase
        .from('journeys')
        .insert({
          user_id: user.id,
          // The agent's business. This journey exists only to hold that
          // agent's knowledge, so it belongs wherever the agent does —
          // not wherever the switcher happens to be pointing.
          business_id: agent.business_id ?? null,
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

    // ── 3. Store the crawl as ONE knowledge source ──
    //
    // One row per site, not per page. Re-training then replaces the
    // whole site cleanly — ingestSource deletes by source_id — instead
    // of leaving last month's pricing page behind to be quoted back at
    // a customer alongside this month's.
    const seedHost = safeHost(rawUrl)
    const title = crawl.brand.name ?? crawl.pages[0]?.title ?? seedHost

    const { data: source, error: sourceErr } = await supabase
      .from('brain_sources')
      .insert({
        user_id: user.id,
        business_id: agent.business_id ?? null,
        journey_id: journeyId,
        type: 'url',
        title,
        source_url: rawUrl,
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

    // Each page's text is prefixed with where it came from, so a chunk
    // that lands in a prompt carries its own citation and the model can
    // say "on your pricing page it says…" rather than stating a number
    // from nowhere.
    const combined = crawl.pages
      .map((page) => withSourceHeader(page.text, page.title, page.url))
      .join('\n\n')

    const ingested = await ingestSource({
      tenantId: user.id,
      journeyId,
      sourceId: source.id,
      sourceType: 'url',
      url: rawUrl,
      content: combined,
    })

    // ── 4. Draft a persona and pull out the facts ──
    //
    // Both run against the same text and neither is allowed to fail the
    // request: the knowledge is already stored and useful on its own.
    // Run them together — two sequential LLM calls would put the 60s
    // budget at risk on a slow provider.
    const promptText = buildLlmText(crawl)

    const [persona, facts] = await Promise.all([
      draftPersona({
        text: promptText,
        agentName: agent.name,
        industry: agent.industry,
        siteUrl: rawUrl,
      }).catch((err) => {
        console.error('[train-from-url] persona draft failed:', err)
        return ''
      }),
      extractFacts(promptText).catch((err) => {
        console.error('[train-from-url] fact extraction failed:', err)
        return EMPTY_FACTS
      }),
    ])

    return NextResponse.json({
      journey_id: journeyId,
      persona,
      // Read from the site's own metadata, not generated — safe to
      // pre-fill the agent's name, avatar and colour with.
      brand: crawl.brand,
      // Written by the model — show these for approval before saving.
      facts,
      title,
      pages: crawl.pages.map((page) => ({
        url: page.url,
        title: page.title,
        words: page.wordCount,
      })),
      skipped: crawl.skipped,
      truncated: crawl.truncated,
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

function safeHost(raw: string): string {
  try {
    return new URL(raw).hostname
  } catch {
    return raw
  }
}

/**
 * Say why nothing was read, in words a merchant can act on.
 *
 * "Crawl failed" tells them nothing. Whether their site is JavaScript-
 * rendered, blocking us, or simply mistyped leads to three completely
 * different next steps.
 */
function explainEmptyCrawl(crawl: CrawlResult): string {
  const reasons = crawl.skipped.map((s) => s.reason)

  if (reasons.some((r) => /builds its pages in the browser/i.test(r))) {
    return 'This site builds its pages in the browser, so we could not read its text. Paste your key content manually, or point us at a simpler page such as /about.'
  }
  if (reasons.some((r) => /public internet/i.test(r))) {
    return 'That address is not reachable from the public internet.'
  }
  if (reasons.some((r) => /^HTTP 4|^HTTP 5/.test(r))) {
    const status = reasons.find((r) => /^HTTP/.test(r))
    return `The site answered ${status}. It may be blocking automated readers, or the address may be wrong.`
  }
  if (reasons.some((r) => /timed out|could not be reached/.test(r))) {
    return "We couldn't reach that site in time. Check the address, or try again in a moment."
  }
  return 'We could not read any text from that site. Try a specific page such as /about, or paste your content manually.'
}

/**
 * Pick which pages the model reads, and in what order.
 *
 * Not simply "the first 14,000 characters": on most sites that is the
 * homepage hero and nothing else. Pages whose address suggests they
 * describe the business go first, so the model sees /about and /contact
 * even on a site with a long homepage.
 */
function buildLlmText(crawl: CrawlResult): string {
  const priority = /\/(about|about-us|contact|services|pricing|plans|team|company|faq)/i

  const ordered = [...crawl.pages].sort((a, b) => {
    const aScore = priority.test(a.url) ? 1 : 0
    const bScore = priority.test(b.url) ? 1 : 0
    return bScore - aScore
  })

  // The seed page still leads — it carries the business's own summary
  // of itself — followed by the pages most likely to hold specifics.
  const seed = crawl.pages[0]
  const rest = ordered.filter((page) => page.url !== seed.url)

  let out = ''
  for (const page of [seed, ...rest]) {
    const block = `\n\n--- ${page.title} (${page.url}) ---\n${page.text}`
    if (out.length + block.length > MAX_TEXT_FOR_LLM) break
    out += block
  }
  return out.trim().slice(0, MAX_TEXT_FOR_LLM)
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
  const system = `You write system prompts ("personas") for customer-facing AI agents on WhatsApp and website chat.

You will be given text from several pages of a business's website. Write the persona that agent should use.

Rules for what you write:
- Address the agent directly in the second person: "You are…", "Always…", "Never…".
- Open with one sentence naming what the business actually does, taken from the pages.
- Include an "Always:" list of 3-5 concrete behaviours suited to this business.
- Include a "Never:" list of 2-3 rules, and ALWAYS include this one verbatim:
  "Never state a price, delivery time or policy that is not in your knowledge base — offer to check with the team instead."
- Keep it under 220 words. It is a working instruction, not marketing copy.

Rules for accuracy:
- Use ONLY facts present in the page text. If the pages do not mention prices, delivery, or hours, do not invent them.
- If the pages are thin or unclear, write a shorter, more general persona rather than guessing.

Output the persona text only. No preamble, no markdown headings, no explanation.`

  const user = `Business website: ${args.siteUrl}
Agent name: ${args.agentName}${args.industry ? `\nIndustry: ${args.industry}` : ''}

Website text:
"""
${args.text}
"""`

  const response = await callLLM(system, [{ role: 'user', text: user }], [])
  return (response.text || '').trim()
}

/**
 * Pull the handful of facts every agent needs into a small object.
 *
 * These matter more than they look. An agent that knows the phone
 * number and the opening hours can answer the two most common questions
 * a website visitor asks without a retrieval round-trip, and can be
 * shown to the merchant for correction — which no amount of buried
 * chunk text allows.
 *
 * `null` is required for anything absent, and the parse below is
 * defensive: a model asked for JSON returns a fenced code block often
 * enough that not handling it would be a bug waiting for a Friday.
 */
async function extractFacts(text: string): Promise<StructuredFacts> {
  const system = `You extract business details from website text AND draft the opening for a chat agent that will represent that business.

Return ONLY a JSON object with exactly these keys:
{
  "business_name": string | null,
  "what_they_do": string | null,
  "services": string[],
  "phone": string | null,
  "whatsapp": string | null,
  "email": string | null,
  "address": string | null,
  "hours": string | null,
  "role": string | null,
  "greeting": string | null,
  "suggested_questions": string[]
}

Extraction rules (business_name through hours):
- Use null for anything the text does not state. Do NOT guess or infer.
- "what_they_do" is one plain sentence, at most 25 words.
- "services" is at most 8 short names taken verbatim from the text. Empty array if none are listed.
- "hours" is copied as written, e.g. "Mon-Sat 10am-7pm". null if not stated.
- Copy phone numbers exactly as printed, including the country code if shown.

Drafting rules (role, greeting, suggested_questions):
- "role" is a short label for what this agent is, at most 8 words, e.g. "Clinic assistant for skin and hair treatments".
- "greeting" is the agent's first message. One or two sentences, name the business, warm and plain. No emoji unless the site's own copy uses them.
- "suggested_questions" is EXACTLY 3 questions a real customer of THIS business would ask, written in the customer's voice ("What does a consultation cost?", not "Ask about pricing").
- Base all three on what the pages actually describe. A clinic gets questions about treatments and booking; a shop gets questions about delivery and returns.
- Every question must be one the website's own content could answer. Never invent a service the pages do not mention.

Output the JSON object and nothing else.`

  const response = await callLLM(system, [{ role: 'user', text }], [])
  return parseFacts(response.text || '')
}

/** Exported for tests — the parsing is where this breaks in practice. */
export function parseFacts(raw: string): StructuredFacts {
  let body = raw.trim()

  // Models return ```json blocks despite being told not to.
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) body = fenced[1].trim()

  // Or a sentence of preamble before the object.
  if (!body.startsWith('{')) {
    const start = body.indexOf('{')
    const end = body.lastIndexOf('}')
    if (start === -1 || end <= start) return EMPTY_FACTS
    body = body.slice(start, end + 1)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return EMPTY_FACTS
  }
  if (!parsed || typeof parsed !== 'object') return EMPTY_FACTS

  const obj = parsed as Record<string, unknown>
  const str = (value: unknown, max = 200): string | null => {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    // Models write the string "null" surprisingly often.
    if (!trimmed || /^(null|none|n\/a|not stated|unknown)$/i.test(trimmed)) return null
    return trimmed.slice(0, max)
  }

  return {
    business_name: str(obj.business_name, 120),
    what_they_do: str(obj.what_they_do, 300),
    services: Array.isArray(obj.services)
      ? obj.services
          .map((item) => str(item, 80))
          .filter((item): item is string => Boolean(item))
          .slice(0, 8)
      : [],
    phone: str(obj.phone, 32),
    whatsapp: str(obj.whatsapp, 32),
    email: str(obj.email, 160),
    address: str(obj.address, 300),
    hours: str(obj.hours, 200),
    role: str(obj.role, 80),
    greeting: str(obj.greeting, 300),
    // Three, capped. Four chips wrap to a second row on a phone, which
    // is where most of these conversations start.
    suggested_questions: Array.isArray(obj.suggested_questions)
      ? obj.suggested_questions
          .map((item) => str(item, 120))
          .filter((item): item is string => Boolean(item))
          .slice(0, 3)
      : [],
  }
}

// src/app/api/widget/message/route.ts
//
// Public endpoint the website widget POSTs visitor messages to.
// Multi-agent: resolves the widget config by agent_id when the embed
// provides data-agent; otherwise falls back to the tenant's legacy
// (agent_id IS NULL) row. This keeps old org-only embeds (Kalosa)
// working even when multiple agent configs exist for the same tenant.
//
// AI-engineer changes (see CHANGES.md):
//   • visitor text is type-checked, cleaned and capped before it is
//     stored or sent to the model
//   • the engine now owns the "human is handling this chat" gate and the
//     handoff/pending bookkeeping; this route only turns its result into
//     a reply (result.skipped, result.errorReply)
//   • canned replies follow the visitor's language

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAgent } from '@/lib/agent/engine'
import { allowlistFromConfig, originAllowed, corsHeaders } from '@/lib/widget/origin'
import {
  MAX_WIDGET_MESSAGE_CHARS,
  MAX_WIDGET_RAW_CHARS,
  sanitizeInboundText,
} from '@/lib/agent/input-guard'
import { resolveLanguage, t } from '@/lib/agent/reply-language'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null
function db() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _client
}

// Used before we know which widget is being addressed — the preflight,
// and the argument-validation errors that fire before the config loads.
// Neither reveals anything about the tenant.
const OPEN_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OPEN_CORS })
}

/**
 * Marks a widget visitor's contact row with a "Website Visitor" tag.
 *
 * This is the only signal, anywhere on the contact row itself, that
 * distinguishes it from a real WhatsApp contact (its phone is a
 * "web_..." placeholder, not the source of truth other code should
 * rely on). Tags the contact's source rather than keeping a separate
 * table for it. Best-effort: a failure here must
 * never break the chat reply itself.
 */
async function tagAsWebsiteVisitor(orgId: string | null, contactId: string): Promise<void> {
  if (!orgId) return
  try {
    const { data: existingTag } = await db()
      .from('tags')
      .select('id')
      .eq('user_id', orgId)
      .ilike('name', 'Website Visitor')
      .maybeSingle()

    let tagId: string | null = existingTag?.id ?? null
    if (!tagId) {
      const { data: newTag, error } = await db()
        .from('tags')
        .insert({ user_id: orgId, name: 'Website Visitor' })
        .select('id')
        .single()
      if (error || !newTag) return
      tagId = newTag.id
    }

    await db()
      .from('contact_tags')
      .upsert({ contact_id: contactId, tag_id: tagId }, { onConflict: 'contact_id,tag_id' })
  } catch (err) {
    console.error('[widget/message] tag website visitor failed:', err)
  }
}

export async function POST(req: Request) {
  // The embed code is public by design, so org_id and agent_id are
  // public too: anyone can read them off a customer's page. The Origin
  // check below is what stops those ids being replayed from somewhere
  // else — every replayed message is an LLM call the merchant pays for.
  const origin = req.headers.get('origin')
  let CORS: Record<string, string> = OPEN_CORS

  try {
    const body = await req.json().catch(() => ({}))
    const { org_id, agent_id, visitor_id, page_url, page_title } = body

    // ── Visitor text: type-check, clean, cap ──
    // `message` used to be assumed to be a string and passed on after
    // trim() with no length limit, so one request could send tens of
    // thousands of characters to a paid model. A bubble-sized message is
    // never near the limit; anything absurd is rejected, anything merely
    // long is cut.
    const rawMessage: unknown = body.message
    if (typeof rawMessage === 'string' && rawMessage.length > MAX_WIDGET_RAW_CHARS) {
      return NextResponse.json(
        { error: 'Message is too long. Please send a shorter message.' },
        { status: 400, headers: CORS },
      )
    }
    const message = sanitizeInboundText(rawMessage, MAX_WIDGET_MESSAGE_CHARS).text

    if (!org_id || !visitor_id || !message) {
      return NextResponse.json(
        { error: 'org_id, visitor_id, and message are required' },
        { status: 400, headers: CORS },
      )
    }

    // 1. Load widget config — by agent_id if provided, else the tenant's
    //    legacy (null-agent) row. This prevents matching multiple rows.
    let cfgQuery = db()
      .from('widget_configs')
      .select('*')
      .eq('is_active', true)
    if (agent_id) {
      cfgQuery = cfgQuery.eq('agent_id', agent_id)
    } else {
      cfgQuery = cfgQuery.eq('org_user_id', org_id).is('agent_id', null)
    }
    let { data: config } = await cfgQuery.maybeSingle()

    // True when this agent had no config row and borrowed the tenant's
    // org-wide one. That row describes whichever business was set up
    // first, so nothing on it may be treated as describing this agent.
    let usedSharedConfig = false

    // An agent-scoped embed (data-agent=...) looks for that agent's own
    // widget config. Nothing in the app creates one — /widget only ever
    // writes the tenant's org-wide row — so without this fallback every
    // embed copied from the Agents page resolves to nothing and the
    // visitor is told the chat "is not configured yet".
    if (!config && agent_id) {
      const { data: orgConfig } = await db()
        .from('widget_configs')
        .select('*')
        .eq('is_active', true)
        .eq('org_user_id', org_id)
        .is('agent_id', null)
        .maybeSingle()
      if (orgConfig) {
        config = orgConfig
        usedSharedConfig = true
      }
    }

    if (!config) {
      return NextResponse.json(
        { reply: 'This chat is not configured yet. Please contact the business directly.' },
        { status: 200, headers: CORS },
      )
    }

    // ── Is this page allowed to use this widget? ──
    //
    // Enforced here rather than left to CORS headers alone: a browser
    // only refuses to *show* a blocked response, and curl ignores CORS
    // entirely. Either way we would already have run the model and paid
    // for it. An empty allowlist means "not configured" and still
    // allows, so live widgets keep working — see lib/widget/origin.ts.
    const allowlist = allowlistFromConfig(config)
    CORS = corsHeaders(origin, allowlist)

    if (!originAllowed(origin, allowlist)) {
      console.warn(
        `[widget/message] blocked origin ${origin ?? '(none)'} for org ${org_id}`,
      )
      return NextResponse.json(
        { error: 'This chat is not enabled for this website.' },
        { status: 403, headers: CORS },
      )
    }

    // ── Which agent is actually answering ──
    //
    // The embed's data-agent is honoured, but only after checking the
    // agent belongs to this tenant. data-agent arrives from a public
    // script tag, so without that check a page could name another
    // tenant's agent and borrow its persona and media.
    let resolvedAgentId: string | undefined = config.agent_id ?? undefined
    let agentBusinessId: string | null = null

    if (resolvedAgentId) {
      const { data: own } = await db()
        .from('agents')
        .select('business_id')
        .eq('id', resolvedAgentId)
        .maybeSingle()
      agentBusinessId = own?.business_id ?? null
    } else if (agent_id) {
      const { data: owned } = await db()
        .from('agents')
        .select('id, business_id')
        .eq('id', agent_id)
        .eq('tenant_id', org_id)
        .maybeSingle()
      if (owned) {
        resolvedAgentId = owned.id
        agentBusinessId = owned.business_id ?? null
      }
    }

    // ── Which business owns this conversation ──
    //
    // The agent's, not the config's, whenever an agent is answering.
    const businessId = agentBusinessId ?? config.business_id ?? null

    // 2. Find existing session
    const { data: session } = await db()
      .from('widget_sessions')
      .select('*')
      .eq('org_user_id', org_id)
      .eq('visitor_id', visitor_id)
      .maybeSingle()

    let conversationId: string | null = null
    let contactId: string | null = null

    if (session?.conversation_id) {
      conversationId = session.conversation_id
      const { data: conv } = await db()
        .from('conversations')
        .select('contact_id')
        .eq('id', conversationId)
        .maybeSingle()
      contactId = conv?.contact_id ?? null
    }

    // 3. If no existing conversation, create contact + conversation
    if (!conversationId) {
      const visitorPhone = `web_${String(visitor_id).slice(0, 12)}`

      const { data: existingContact } = await db()
        .from('contacts')
        .select('id')
        .eq('user_id', org_id)
        .eq('phone', visitorPhone)
        .maybeSingle()

      if (existingContact?.id) {
        contactId = existingContact.id
      } else {
        const { data: contact, error: contactErr } = await db()
          .from('contacts')
          .insert({
            user_id: org_id,
            phone: visitorPhone,
            name: `Website Visitor ${String(visitor_id).slice(0, 6)}`,
            business_id: businessId,
          })
          .select('id')
          .single()
        if (contactErr || !contact) {
          console.error('[widget/message] CONTACT insert failed:', contactErr?.message, contactErr?.details)
          return NextResponse.json(
            { reply: 'Sorry, I could not start the chat. Please try again.' },
            { status: 200, headers: CORS },
          )
        }
        contactId = contact.id
        await tagAsWebsiteVisitor(org_id, contact.id)
      }

      const { data: existingConv } = await db()
        .from('conversations')
        .select('id')
        .eq('user_id', org_id)
        .eq('contact_id', contactId)
        .maybeSingle()

      if (existingConv?.id) {
        conversationId = existingConv.id
      } else {
        const { data: conv, error: convErr } = await db()
          .from('conversations')
          .insert({
            user_id: org_id,
            contact_id: contactId,
            channel: 'website',
            status: 'open',
            business_id: businessId,
          })
          .select('id')
          .single()
        if (convErr || !conv) {
          console.error('[widget/message] CONVERSATION insert failed:', convErr?.message, convErr?.details)
          return NextResponse.json(
            { reply: 'Sorry, I could not start the chat. Please try again.' },
            { status: 200, headers: CORS },
          )
        }
        conversationId = conv.id
      }

      if (session?.id) {
        await db()
          .from('widget_sessions')
          .update({
            conversation_id: conversationId,
            page_url,
            page_title,
            last_active_at: new Date().toISOString(),
          })
          .eq('id', session.id)
      } else {
        const { error: sessErr } = await db().from('widget_sessions').insert({
          org_user_id: org_id,
          visitor_id,
          conversation_id: conversationId,
          journey_id: config.journey_id ?? null,
          page_url,
          page_title,
        })
        if (sessErr) {
          console.error('[widget/message] session insert (non-fatal):', sessErr.message)
        }
      }
    }

    if (!conversationId || !contactId) {
      console.error('[widget/message] missing conversationId or contactId after setup')
      return NextResponse.json(
        { reply: 'Sorry, something went wrong. Please try again.' },
        { status: 200, headers: CORS },
      )
    }

    // 4. Save the visitor's message (the cleaned, capped text)
    const { error: msgErr } = await db().from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'customer',
      content_type: 'text',
      content_text: message,
      status: 'delivered',
      created_at: new Date().toISOString(),
    })
    if (msgErr) {
      console.error('[widget/message] message insert (non-fatal):', msgErr.message)
    }

    await db()
      .from('conversations')
      .update({
        last_message_text: message,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    // 5. Load persona for the linked journey (legacy path). When an agent
    //    is set, the engine loads the agent's own persona via agentId.
    //    A borrowed row's journey belongs to another business, so its
    //    persona does too.
    let systemPrompt: string | undefined
    if (config.journey_id && !(usedSharedConfig && resolvedAgentId)) {
      const { data: persona } = await db()
        .from('personas')
        .select('raw_prompt')
        .eq('journey_id', config.journey_id)
        .maybeSingle()
      systemPrompt = persona?.raw_prompt ?? undefined
    }

    // 6. Call the AI engine. It owns: the human-handoff gate, emergency
    //    handling, the pending/needs_attention bookkeeping, and the
    //    one-retry-then-escalate policy for AI errors.
    const result = await runAgent({
      tenantId: org_id,
      orgId: null,
      verticalConfigId: null,
      conversationId,
      contactId,
      customerPhone: `web_${String(visitor_id).slice(0, 12)}`,
      inboundText: message,
      journeyId: config.journey_id ?? undefined,
      systemPromptOverride: systemPrompt,
      agentId: resolvedAgentId,
    })

    const lang = result.language ?? resolveLanguage(message)

    // 6b. The engine chose not to answer. Show a short note; do not
    //     store it as a bot message and do not touch the conversation.
    if (result.skipped) {
      return NextResponse.json(
        {
          reply: t(result.skipped === 'human_handling' ? 'human_active' : 'unavailable', lang),
          media: [],
          handoff: result.skipped === 'human_handling',
          human_active: result.skipped === 'human_handling',
          business_phone: config.business_phone,
          lead_form: null,
        },
        { headers: CORS },
      )
    }

    const aiFailed = !result.reply
    const reply =
      result.reply ||
      result.errorReply ||
      t('thanks_team_follow_up', lang)

    // 7. Save the AI reply
    await db().from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'bot',
      content_type: 'text',
      content_text: reply,
      status: 'sent',
      created_at: new Date().toISOString(),
    })

    await db()
      .from('conversations')
      .update({
        last_message_text: reply,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    // 7b. No pending/needs_attention update here any more. The engine
    //     already parked the conversation when a handoff was requested
    //     (with the specific reason, e.g. an emergency) or when AI errors
    //     repeated. Doing it here too overwrote that reason and parked
    //     the chat after a single transient error.

    // 8. Return reply + any media the AI chose to send
    return NextResponse.json(
      {
        reply,
        media: (result.mediaToSend || []).map((m: {
          media_type: string; title: string; url: string; description: string | null
        }) => ({
          type: m.media_type,
          title: m.title,
          url: m.url,
          description: m.description,
        })),
        handoff: result.handoffRequested || (aiFailed && result.escalate === true),
        emergency: result.emergency === true,
        business_phone: config.business_phone,
        // Present when the AI decided to ask for contact details. The widget
        // renders these as a form and POSTs the result to /api/widget/lead.
        lead_form: result.showLeadForm
          ? { fields: result.showLeadForm.fields, conversation_id: conversationId }
          : null,
      },
      { headers: CORS },
    )
  } catch (err) {
    console.error('[widget/message] error:', err)
    return NextResponse.json(
      { reply: 'Sorry, I had trouble there. Please try again.' },
      { status: 200, headers: CORS },
    )
  }
}

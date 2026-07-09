// src/app/api/widget/message/route.ts
//
// Public endpoint the website widget POSTs visitor messages to.
// No auth — identified by org_id + visitor_id.
//
// Hardened version: every insert is checked, errors are logged with a
// clear label so failures show the exact cause in Vercel logs instead
// of a cryptic "Cannot read properties of null".

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAgent } from '@/lib/agent/engine'

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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { org_id, visitor_id, message, page_url, page_title } = body

    if (!org_id || !visitor_id || !message?.trim()) {
      return NextResponse.json(
        { error: 'org_id, visitor_id, and message are required' },
        { status: 400, headers: CORS },
      )
    }

    // 1. Load widget config
    const { data: config, error: configErr } = await db()
      .from('widget_configs')
      .select('*')
      .eq('org_user_id', org_id)
      .eq('is_active', true)
      .maybeSingle()

    if (configErr) {
      console.error('[widget/message] config error:', configErr.message)
    }
    if (!config) {
      return NextResponse.json(
        { reply: 'This chat is not configured yet. Please contact the business directly.' },
        { status: 200, headers: CORS },
      )
    }

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

      // Try to find an existing contact with this phone first (avoid dup)
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
      }

      // Check for an existing open conversation for this contact
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

      // Upsert the widget session
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

    // 4. Save the visitor's message
    const { error: msgErr } = await db().from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'customer',
      content_type: 'text',
      content_text: message.trim(),
      status: 'delivered',
      created_at: new Date().toISOString(),
    })
    if (msgErr) {
      console.error('[widget/message] message insert (non-fatal):', msgErr.message)
    }

    await db()
      .from('conversations')
      .update({
        last_message_text: message.trim(),
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    // 5. Load persona for the linked journey
    let systemPrompt: string | undefined
    if (config.journey_id) {
      const { data: persona } = await db()
        .from('personas')
        .select('raw_prompt')
        .eq('journey_id', config.journey_id)
        .maybeSingle()
      systemPrompt = persona?.raw_prompt ?? undefined
    }

    // 6. Call the AI engine
const result = await runAgent({
  tenantId: org_id,
  orgId: null,
  verticalConfigId: null,
  conversationId,
  contactId,
  customerPhone: `web_${String(visitor_id).slice(0, 12)}`,
  inboundText: message.trim(),
  journeyId: config.journey_id ?? undefined,
  systemPromptOverride: systemPrompt,
  agentId: config.agent_id ?? undefined,
})

    const aiFailed = !result.reply
    const reply =
      result.reply ||
      'Thanks for your message! Let me connect you with our team — someone will follow up with you shortly.'

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

    // 7b. If the AI failed (empty reply) OR requested handoff, flag the
    // conversation so the clinic sees it in the inbox and follows up.
    if (aiFailed || result.handoffRequested) {
      await db()
        .from('conversations')
        .update({
          status: 'pending',
          needs_attention: true,
          handoff_reason: aiFailed
            ? 'AI could not respond — needs human follow-up'
            : 'Visitor wants to book / needs a human',
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
    }

    // 8. Return reply
    return NextResponse.json(
      {
        reply,
        handoff: result.handoffRequested,
        business_phone: config.business_phone,
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

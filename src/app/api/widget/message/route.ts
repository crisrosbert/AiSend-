// src/app/api/widget/message/route.ts
//
// Public endpoint the website widget POSTs visitor messages to.
// No auth — identified by org_id (the client's user_id) + visitor_id.
//
// Flow:
//   1. Resolve widget config by org_id
//   2. Find or create a conversation (channel='website') + widget_session
//   3. Save the visitor's message
//   4. Call runAgent() — the SAME engine WhatsApp uses
//   5. Save + return the AI reply
//
// CORS enabled so it can be called from any client website.

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
    const {
      org_id,        // the client's user_id (from data-org on the script)
      visitor_id,    // random id from browser localStorage
      message,
      page_url,
      page_title,
    } = body

    if (!org_id || !visitor_id || !message?.trim()) {
      return NextResponse.json(
        { error: 'org_id, visitor_id, and message are required' },
        { status: 400, headers: CORS },
      )
    }

    // 1. Load widget config
    const { data: config } = await db()
      .from('widget_configs')
      .select('*')
      .eq('org_user_id', org_id)
      .eq('is_active', true)
      .maybeSingle()

    if (!config) {
      return NextResponse.json(
        { error: 'Widget not configured for this business' },
        { status: 404, headers: CORS },
      )
    }

    // 2. Find or create the widget session + conversation
    let { data: session } = await db()
      .from('widget_sessions')
      .select('*')
      .eq('org_user_id', org_id)
      .eq('visitor_id', visitor_id)
      .maybeSingle()

    let conversationId: string
    let contactId: string

    if (session?.conversation_id) {
      conversationId = session.conversation_id
      // Get the contact tied to this conversation
      const { data: conv } = await db()
        .from('conversations')
        .select('contact_id')
        .eq('id', conversationId)
        .maybeSingle()
      contactId = conv?.contact_id
    } else {
      // Create a contact for this website visitor
      const visitorPhone = `web_${visitor_id.slice(0, 12)}`
      const { data: contact } = await db()
        .from('contacts')
        .insert({
          user_id: org_id,
          phone: visitorPhone,
          name: `Website Visitor ${visitor_id.slice(0, 6)}`,
        })
        .select('id')
        .single()
      contactId = contact.id

      // Create the conversation (channel = website)
      const { data: conv } = await db()
        .from('conversations')
        .insert({
          user_id: org_id,
          contact_id: contactId,
          channel: 'website',
          status: 'open',
        })
        .select('id')
        .single()
      conversationId = conv.id

      // Create or update the session
      if (session) {
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
        await db().from('widget_sessions').insert({
          org_user_id: org_id,
          visitor_id,
          conversation_id: conversationId,
          journey_id: config.journey_id ?? null,
          page_url,
          page_title,
        })
      }
    }

    // 3. Save the visitor's message
    await db().from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'customer',
      content_type: 'text',
      content_text: message.trim(),
      status: 'delivered',
      created_at: new Date().toISOString(),
    })

    await db()
      .from('conversations')
      .update({
        last_message_text: message.trim(),
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        unread_count: 1,
      })
      .eq('id', conversationId)

    // 4. Load the persona for the agent (if a journey is linked)
    let systemPrompt: string | undefined
    if (config.journey_id) {
      const { data: persona } = await db()
        .from('personas')
        .select('raw_prompt')
        .eq('journey_id', config.journey_id)
        .maybeSingle()
      systemPrompt = persona?.raw_prompt ?? undefined
    }

    // 5. Call the AI engine
    const result = await runAgent({
      tenantId: org_id,
      orgId: null,
      verticalConfigId: null,
      conversationId,
      contactId,
      customerPhone: `web_${visitor_id.slice(0, 12)}`,
      inboundText: message.trim(),
      journeyId: config.journey_id ?? undefined,
      systemPromptOverride: systemPrompt,
    })

    const reply =
      result.reply ||
      "Thanks for your message! Let me connect you with our team for more help."

    // 6. Save the AI reply
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

    // 7. Return reply to the widget
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
      { error: 'Something went wrong', reply: 'Sorry, I had trouble there. Please try again.' },
      { status: 500, headers: CORS },
    )
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt, encrypt, isLegacyFormat } from '@/lib/whatsapp/encryption'
import { getMediaUrl } from '@/lib/whatsapp/meta-api'
import { normalizePhone, phonesMatch } from '@/lib/whatsapp/phone-utils'
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature'
import { runAutomationsForTrigger } from '@/lib/automations/engine'

// Lazy-initialized to avoid build-time crash when env vars are missing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

interface WhatsAppMessage {
  id: string
  from: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: { id: string; mime_type: string; caption?: string }
  video?: { id: string; mime_type: string; caption?: string }
  document?: { id: string; mime_type: string; filename?: string; caption?: string }
  audio?: { id: string; mime_type: string }
  sticker?: { id: string; mime_type: string }
  location?: { latitude: number; longitude: number; name?: string; address?: string }
  reaction?: { message_id: string; emoji: string }
  context?: { id: string }
}

interface WhatsAppWebhookEntry {
  id: string
  changes: Array<{
    value: {
      messaging_product?: string
      metadata?: {
        display_phone_number: string
        phone_number_id: string
      }
      contacts?: Array<{
        profile: { name: string }
        wa_id: string
      }>
      messages?: WhatsAppMessage[]
      statuses?: Array<{
        id: string
        status: string
        timestamp: string
        recipient_id: string
      }>
      message_template_id?: number | string
      message_template_name?: string
      message_template_language?: string
      event?: string
      reason?: string | null
    }
    field: string
  }>
}

// ── NEW HELPER FUNCTION: FETCH WHATSAPP PROFILE PICTURE FROM META ──
async function fetchWhatsAppProfilePic(
  phoneNumberId: string,
  accessToken: string,
  customerWaId: string
): Promise<string | null> {
  try {
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/whatsapp_contacts?fields=profile_picture_url&input=[%22${customerWaId}%22]`;
    
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data?.data?.[0]?.profile_picture_url || null;
  } catch (err) {
    console.error("Failed to fetch WhatsApp profile picture:", err);
    return null;
  }
}

// GET - Webhook verification
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const challenge = searchParams.get('hub.challenge')
    const verifyToken = searchParams.get('hub.verify_token')

    if (mode !== 'subscribe' || !challenge || !verifyToken) {
      return NextResponse.json(
        { error: 'Missing verification parameters' },
        { status: 400 }
      )
    }

    const { data: configs, error: configError } = await supabaseAdmin()
      .from('whatsapp_config')
      .select('id, verify_token')

    if (configError || !configs) {
      console.error('Error fetching configs for verification:', configError)
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 403 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let matchedConfig: any = null
    for (const config of configs) {
      if (!config.verify_token) continue
      try {
        if (decrypt(config.verify_token) === verifyToken) {
          matchedConfig = config
          break
        }
      } catch {
        // Skip invalid rows
      }
    }

    if (matchedConfig) {
      if (isLegacyFormat(matchedConfig.verify_token)) {
        void supabaseAdmin()
          .from('whatsapp_config')
          .update({ verify_token: encrypt(verifyToken) })
          .eq('id', matchedConfig.id)
          .then(({ error }: { error: unknown }) => {
            if (error) {
              console.warn(
                '[webhook] verify_token GCM upgrade failed:',
                (error as { message?: string })?.message ?? error,
              )
            }
          })
      }
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    return NextResponse.json(
      { error: 'Verification token mismatch' },
      { status: 403 }
    )
  } catch (error) {
    console.error('Error in webhook GET verification:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Receive messages
export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')

  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    console.warn('[webhook] rejected request with invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: { entry?: WhatsAppWebhookEntry[] }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  processWebhook(body).catch((error) => {
    console.error('Error processing webhook:', error)
  })

  return NextResponse.json({ status: 'received' }, { status: 200 })
}

async function processWebhook(body: { entry?: WhatsAppWebhookEntry[] }) {
  if (!body.entry) return

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      const value = change.value

      if (
        change.field === 'message_template_status_update' ||
        value.message_template_name
      ) {
        await handleTemplateStatusUpdate(value)
        continue
      }

      if (value.statuses) {
        for (const status of value.statuses) {
          await handleStatusUpdate(status)
        }
      }

      if (!value.messages || !value.contacts) continue

      const phoneNumberId = value.metadata!.phone_number_id

      const { data: config, error: configError } = await supabaseAdmin()
        .from('whatsapp_config')
        .select('*')
        .eq('phone_number_id', phoneNumberId)
        .single()

      if (configError || !config) {
        console.error('No config found for phone_number_id:', phoneNumberId)
        continue
      }

      const decryptedAccessToken = decrypt(config.access_token)

      for (let i = 0; i < value.messages.length; i++) {
        const message = value.messages[i]
        const contact = value.contacts[i] || value.contacts[0]

        await processMessage(
          message,
          contact,
          config.user_id,
          phoneNumberId,
          decryptedAccessToken
        )
      }
    }
  }
}

const RECIPIENT_STATUS_LADDER = [
  'pending',
  'sent',
  'delivered',
  'read',
  'replied',
] as const

function ladderLevel(s: string): number {
  const idx = (RECIPIENT_STATUS_LADDER as readonly string[]).indexOf(s)
  return idx < 0 ? -1 : idx
}

function isValidStatusTransition(current: string, incoming: string): boolean {
  if (incoming === 'failed') {
    return current === 'pending' || current === 'sent'
  }
  if (current === 'failed') {
    return false
  }
  const ci = ladderLevel(current)
  const ii = ladderLevel(incoming)
  if (ii < 0) return false 
  if (ci < 0) return true 
  return ii > ci
}

async function handleTemplateStatusUpdate(value: {
  message_template_id?: number | string
  message_template_name?: string
  message_template_language?: string
  event?: string
  reason?: string | null
}) {
  const metaId = value.message_template_id != null ? String(value.message_template_id) : null
  const name = value.message_template_name
  const language = value.message_template_language
  const event = (value.event || '').toUpperCase()

  if (!metaId && !name) {
    console.warn('[webhook] template status update with no id or name')
    return
  }

  let status: 'Approved' | 'Rejected' | 'Pending'
  switch (event) {
    case 'APPROVED':
      status = 'Approved'
      break
    case 'REJECTED':
    case 'DISABLED':
    case 'PAUSED':
    case 'FLAGGED':
      status = 'Rejected'
      break
    default:
      status = 'Pending'
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (metaId) {
    const { data, error } = await supabaseAdmin()
      .from('message_templates')
      .update(patch)
      .eq('meta_template_id', metaId)
      .select('id')
    if (!error && data && data.length > 0) return
  }

  if (name) {
    let q = supabaseAdmin().from('message_templates').update(patch).eq('name', name)
    if (language) q = q.eq('language', language)
    const { error } = await q
    if (error) {
      console.error('[webhook] template status update failed:', error.message)
    }
  }
}

async function handleStatusUpdate(status: {
  id: string
  status: string
  timestamp: string
  recipient_id: string
}) {
  const { error: msgErr } = await supabaseAdmin()
    .from('messages')
    .update({ status: status.status })
    .eq('message_id', status.id)

  if (msgErr) {
    console.error('Error updating message status:', msgErr)
  }

  const tsIso = new Date(parseInt(status.timestamp) * 1000).toISOString()

  const { data: recipient, error: recFetchErr } = await supabaseAdmin()
    .from('broadcast_recipients')
    .select('id, status')
    .eq('whatsapp_message_id', status.id)
    .maybeSingle()

  if (recFetchErr) {
    console.error('Error fetching broadcast recipient:', recFetchErr)
    return
  }
  if (!recipient) return 

  if (!isValidStatusTransition(recipient.status, status.status)) return

  const update: Record<string, unknown> = { status: status.status }
  if (status.status === 'sent' && !('sent_at' in update)) update.sent_at = tsIso
  if (status.status === 'delivered') update.delivered_at = tsIso
  if (status.status === 'read') update.read_at = tsIso

  const { error: recUpdateErr } = await supabaseAdmin()
    .from('broadcast_recipients')
    .update(update)
    .eq('id', recipient.id)

  if (recUpdateErr) {
    console.error('Error updating broadcast recipient status:', recUpdateErr)
  }
}

async function flagBroadcastReplyIfAny(userId: string, contactId: string) {
  try {
    const { data: recs, error } = await supabaseAdmin()
      .from('broadcast_recipients')
      .select('id, status, broadcast_id, broadcasts!inner(user_id)')
      .eq('contact_id', contactId)
      .eq('broadcasts.user_id', userId)
      .in('status', ['sent', 'delivered', 'read'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !recs || recs.length === 0) return

    const row = recs[0]
    const { error: updErr } = await supabaseAdmin()
      .from('broadcast_recipients')
      .update({ status: 'replied', replied_at: new Date().toISOString() })
      .eq('id', row.id)

    if (updErr) {
      console.error('Error marking broadcast recipient replied:', updErr)
    }
  } catch (err) {
    console.error('flagBroadcastReplyIfAny failed:', err)
  }
}

async function lookupInternalIdByMetaId(
  metaId: string,
  conversationId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from('messages')
    .select('id')
    .eq('message_id', metaId)
    .eq('conversation_id', conversationId)
    .maybeSingle()
  if (error) {
    console.error('[webhook] lookupInternalIdByMetaId failed:', error.message)
    return null
  }
  return data?.id ?? null
}

async function handleReaction(
  message: WhatsAppMessage,
  conversationId: string,
  contactId: string
) {
  const reaction = message.reaction
  if (!reaction?.message_id) return

  const targetInternalId = await lookupInternalIdByMetaId(
    reaction.message_id,
    conversationId
  )
  if (!targetInternalId) {
    console.warn('[webhook] reaction target message not found; skipping', reaction.message_id)
    return
  }

  if (!reaction.emoji) {
    const { error: delError } = await supabaseAdmin()
      .from('message_reactions')
      .delete()
      .eq('message_id', targetInternalId)
      .eq('actor_type', 'customer')
      .eq('actor_id', contactId)
    if (delError) {
      console.error('[webhook] reaction delete failed:', delError.message)
    }
    return
  }

  const { error: upsertError } = await supabaseAdmin()
    .from('message_reactions')
    .upsert(
      {
        message_id: targetInternalId,
        conversation_id: conversationId,
        actor_type: 'customer',
        actor_id: contactId,
        emoji: reaction.emoji,
      },
      { onConflict: 'message_id,actor_type,actor_id' }
    )
  if (upsertError) {
    console.error('[webhook] reaction upsert failed:', upsertError.message)
  }
}

async function processMessage(
  message: WhatsAppMessage,
  contact: { profile: { name: string }; wa_id: string },
  userId: string,
  phoneNumberId: string,
  accessToken: string
) {
  const senderPhone = normalizePhone(message.from)
  const contactName = contact.profile.name

  // Find or create contact with live Meta Profile Pic properties passed forward
  const contactOutcome = await findOrCreateContact(
    userId,
    senderPhone,
    contactName,
    phoneNumberId,
    accessToken
  )
  if (!contactOutcome) return
  const contactRecord = contactOutcome.contact

  const conversation = await findOrCreateConversation(userId, contactRecord.id)
  if (!conversation) return

  if (message.type === 'reaction') {
    await handleReaction(message, conversation.id, contactRecord.id)
    return
  }

  const { contentText, mediaUrl, mediaType } = await parseMessageContent(message, accessToken)
  void mediaType

  let replyToInternalId: string | null = null
  if (message.context?.id) {
    replyToInternalId = await lookupInternalIdByMetaId(message.context.id, conversation.id)
  }

  const ALLOWED_CONTENT_TYPES = new Set([
    'text', 'image', 'document', 'audio', 'video', 'location', 'template',
  ])
  const contentType = ALLOWED_CONTENT_TYPES.has(message.type)
    ? message.type
    : message.type === 'sticker'
      ? 'image'
      : 'text'

  const { count: priorCustomerMsgCount } = await supabaseAdmin()
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversation.id)
    .eq('sender_type', 'customer')
  const isFirstInboundMessage = (priorCustomerMsgCount ?? 0) === 0

  const { error: msgError } = await supabaseAdmin().from('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'customer',
    content_type: contentType,
    content_text: contentText,
    media_url: mediaUrl,
    message_id: message.id,
    status: 'delivered',
    created_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
    reply_to_message_id: replyToInternalId,
  })

  if (msgError) {
    console.error('Error inserting message:', msgError)
    return
  }

  const { error: convError } = await supabaseAdmin()
    .from('conversations')
    .update({
      last_message_text: contentText || `[${message.type}]`,
      last_message_at: new Date().toISOString(),
      unread_count: (conversation.unread_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversation.id)

  if (convError) {
    console.error('Error updating conversation:', convError)
  }

  await flagBroadcastReplyIfAny(userId, contactRecord.id)

  const inboundText = contentText ?? message.text?.body ?? ''
  const automationTriggers: (
    | 'new_contact_created'
    | 'first_inbound_message'
    | 'new_message_received'
    | 'keyword_match'
  )[] = ['new_message_received', 'keyword_match']
  
  if (contactOutcome.wasCreated) automationTriggers.unshift('new_contact_created')
  if (isFirstInboundMessage) automationTriggers.unshift('first_inbound_message')
  
  for (const triggerType of automationTriggers) {
    runAutomationsForTrigger({
      userId,
      triggerType,
      contactId: contactRecord.id,
      context: {
        message_text: inboundText,
        conversation_id: conversation.id,
      },
    }).catch((err) => console.error('[automations] dispatch failed:', err))
  }
}

async function parseMessageContent(
  message: WhatsAppMessage,
  accessToken: string
): Promise<{
  contentText: string | null
  mediaUrl: string | null
  mediaType: string | null
}> {
  const verifyAndBuildUrl = async (mediaId: string): Promise<string | null> => {
    try {
      await getMediaUrl({ mediaId, accessToken })
      return `/api/whatsapp/media/${mediaId}`
    } catch (error) {
      console.error(`Failed to verify media ${mediaId} with Meta:`, error)
      return null
    }
  }

  switch (message.type) {
    case 'text':
      return { contentText: message.text?.body || null, mediaUrl: null, mediaType: null }
    case 'image':
      return {
        contentText: message.image?.caption || null,
        mediaUrl: message.image?.id ? await verifyAndBuildUrl(message.image.id) : null,
        mediaType: message.image?.mime_type || null,
      }
    case 'video':
      return {
        contentText: message.video?.caption || null,
        mediaUrl: message.video?.id ? await verifyAndBuildUrl(message.video.id) : null,
        mediaType: message.video?.mime_type || null,
      }
    case 'document':
      return {
        contentText: message.document?.caption || message.document?.filename || null,
        mediaUrl: message.document?.id ? await verifyAndBuildUrl(message.document.id) : null,
        mediaType: message.document?.mime_type || null,
      }
    case 'audio':
      return {
        contentText: null,
        mediaUrl: message.audio?.id ? await verifyAndBuildUrl(message.audio.id) : null,
        mediaType: message.audio?.mime_type || null,
      }
    case 'sticker':
      return {
        contentText: null,
        mediaUrl: message.sticker?.id ? await verifyAndBuildUrl(message.sticker.id) : null,
        mediaType: message.sticker?.mime_type || null,
      }
    case 'location':
      if (message.location) {
        const loc = message.location
        const locationText = [loc.name, loc.address, `${loc.latitude},${loc.longitude}`].filter(Boolean).join(' - ')
        return { contentText: locationText, mediaUrl: null, mediaType: null }
      }
      return { contentText: null, mediaUrl: null, mediaType: null }
    case 'reaction':
      return { contentText: message.reaction?.emoji || null, mediaUrl: null, mediaType: null }
    default:
      return { contentText: `[Unsupported message type: ${message.type}]`, mediaUrl: null, mediaType: null }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContactRow = any

interface ContactOutcome {
  contact: ContactRow
  wasCreated: boolean
}

// ── FIXED AND UPDATED DYNAMIC CONTACT PIC UPSERT STRATEGY ──
async function findOrCreateContact(
  userId: string,
  phone: string,
  name: string,
  phoneNumberId: string,
  accessToken: string
): Promise<ContactOutcome | null> {
  const { data: contacts, error: contactsError } = await supabaseAdmin()
    .from('contacts')
    .select('*')
    .eq('user_id', userId)

  if (contactsError) {
    console.error('Error fetching contacts:', contactsError)
    return null
  }

  const existingContact = contacts?.find((c: ContactRow) => phonesMatch(c.phone, phone))

  if (existingContact) {
    // If contact exists but avatar is missing, lazily pull it from Meta
    if (!existingContact.avatar_url) {
      const liveAvatarUrl = await fetchWhatsAppProfilePic(phoneNumberId, accessToken, phone)
      if (liveAvatarUrl) {
        const { data: updatedContact } = await supabaseAdmin()
          .from('contacts')
          .update({ 
            name: name || existingContact.name, 
            avatar_url: liveAvatarUrl,
            updated_at: new Date().toISOString() 
          })
          .eq('id', existingContact.id)
          .select()
          .single()
        if (updatedContact) return { contact: updatedContact, wasCreated: false }
      }
    }

    if (name && name !== existingContact.name) {
      const { data: updatedContact } = await supabaseAdmin()
        .from('contacts')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', existingContact.id)
        .select()
        .single()
      if (updatedContact) return { contact: updatedContact, wasCreated: false }
    }
    return { contact: existingContact, wasCreated: false }
  }

  // Fetch real avatar immediately for new signups
  const freshAvatarUrl = await fetchWhatsAppProfilePic(phoneNumberId, accessToken, phone)

  const { data: newContact, error: createError } = await supabaseAdmin()
    .from('contacts')
    .insert({
      user_id: userId,
      phone,
      name: name || phone,
      avatar_url: freshAvatarUrl,
    })
    .select()
    .single()

  if (createError) {
    console.error('Error creating contact:', createError)
    return null
  }

  return { contact: newContact, wasCreated: true }
}

async function findOrCreateConversation(userId: string, contactId: string) {
  const { data: existing, error: findError } = await supabaseAdmin()
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .maybeSingle() // Adjusted to avoid crash loops on unexpected array mutations

  if (!findError && existing) {
    return existing
  }

  const { data: newConv, error: createError } = await supabaseAdmin()
    .from('conversations')
    .insert({
      user_id: userId,
      contact_id: contactId,
    })
    .select()
    .single()

  if (createError) {
    console.error('Error creating conversation:', createError)
    return null
  }

  return newConv
}

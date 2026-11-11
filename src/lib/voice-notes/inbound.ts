// src/lib/voice-notes/inbound.ts
//
// The ONE function the WhatsApp webhook calls for an inbound audio
// message. It wires the pure pipeline (pipeline.ts, transcribe.ts) to the
// real database, Meta media download and the Meta text sender.
//
// It never throws. On any unexpected problem it returns
// { action: 'skip' } so the webhook behaves exactly as it did before this
// feature existed.
//
// Audio is held in memory only and is never written to storage by this
// code. Transcript text is never logged.

import { createClient } from '@supabase/supabase-js'
import { getMediaUrl, sendTextMessage } from '@/lib/whatsapp/meta-api'
import {
  downloadWithCap,
  processVoiceNote,
  type VoiceNoteDeps,
  type VoiceNoteInput,
  type VoiceNoteOutcome,
  type VoiceNoteStore,
} from './pipeline'
import { loadLimits, selectTranscriber } from './transcribe'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  if (!_db) {
    _db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _db
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

function realStore(): VoiceNoteStore {
  return {
    async getConfig(phoneNumberId) {
      // select('*') on purpose: if the voice_notes_enabled column does not
      // exist yet (migration not run) the row simply has no such key and
      // the feature stays OFF. No error, no crash.
      const { data, error } = await db()
        .from('whatsapp_config')
        .select('*')
        .eq('phone_number_id', phoneNumberId)
        .maybeSingle()
      if (error || !data) throw new Error('config')
      return {
        enabled: data.voice_notes_enabled === true,
        hasAgent: !!data.whatsapp_agent_id,
      }
    },

    async getExistingTranscript(wamid) {
      const { data } = await db()
        .from('messages')
        .select('content_text')
        .eq('message_id', wamid)
        .maybeSingle()
      const t = data?.content_text
      return typeof t === 'string' && t.trim() ? t : null
    },

    async countRecentAudio({ tenantId, conversationId, sinceIso }) {
      const tenantQ = await db()
        .from('messages')
        .select('id, conversations!inner(user_id)', { count: 'exact', head: true })
        .eq('content_type', 'audio')
        .eq('sender_type', 'customer')
        .gte('created_at', sinceIso)
        .eq('conversations.user_id', tenantId)
      const convQ = await db()
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('content_type', 'audio')
        .eq('sender_type', 'customer')
        .gte('created_at', sinceIso)
        .eq('conversation_id', conversationId)
      if (tenantQ.error || convQ.error) throw new Error('count')
      return { tenant: tenantQ.count ?? 0, conversation: convQ.count ?? 0 }
    },

    async saveTranscript({ wamid, conversationId, transcript }) {
      // content_type stays 'audio'; that plus sender_type 'customer' is
      // the "this text came from a voice note" flag the inbox uses.
      const { error } = await db()
        .from('messages')
        .update({ content_text: transcript })
        .eq('message_id', wamid)
        .eq('conversation_id', conversationId)
      if (error) throw new Error('save')
      await db()
        .from('conversations')
        .update({ last_message_text: `Voice note: ${transcript.slice(0, 80)}` })
        .eq('id', conversationId)
    },

    async flagForHuman({ conversationId, note }) {
      // Same three fields the AI engine sets on a handoff, so the inbox
      // banner, the "Return to bot" button and the handoff gate all work
      // without any new code.
      const { error } = await db()
        .from('conversations')
        .update({
          status: 'pending',
          needs_attention: true,
          handoff_reason: note,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
      if (error) throw new Error('flag')
    },

    async sendPoliteReply({ input, text }) {
      const sent = await sendTextMessage({
        phoneNumberId: input.phoneNumberId,
        accessToken: input.accessToken,
        to: input.customerPhone,
        text,
      })
      await db().from('messages').insert({
        conversation_id: input.conversationId,
        sender_type: 'bot',
        content_type: 'text',
        content_text: text,
        message_id: sent?.messageId ?? null,
        status: sent?.messageId ? 'sent' : 'failed',
        created_at: new Date().toISOString(),
      })
    },
  }
}

export async function handleInboundVoiceNote(
  input: VoiceNoteInput,
): Promise<VoiceNoteOutcome> {
  try {
    const limits = loadLimits()
    const deps: VoiceNoteDeps = {
      store: realStore(),
      transcriber: selectTranscriber(process.env, limits),
      limits,
      log: (m) => console.log(m),
      async downloadAudio(mediaId, accessToken, maxBytes) {
        const meta = await withTimeout(getMediaUrl({ mediaId, accessToken }), 10_000)
        const got = await downloadWithCap(meta.url, accessToken, maxBytes, 15_000)
        return { bytes: got.bytes, mimeType: meta.mimeType || got.mimeType }
      },
    }
    return await processVoiceNote(input, deps)
  } catch {
    console.error('[voice-note] unexpected failure; continuing without transcript')
    return { action: 'skip', why: 'config_unreadable' }
  }
}

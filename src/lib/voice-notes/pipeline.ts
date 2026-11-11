// src/lib/voice-notes/pipeline.ts
//
// The decision logic for ONE inbound voice note. Pure: the database,
// Meta download, speech-to-text and the polite reply are all injected,
// so the tests use mocks and nothing here touches a real service.
//
// Outcomes:
//   skip     feature is off for this tenant (or nothing to do). The webhook
//            carries on exactly as it did before this feature existed.
//   continue we have a transcript. The webhook feeds it to journeys/agent.
//   handled  we could not use the voice note. The conversation was flagged
//            for a human (status pending + needs_attention + a clear note),
//            and a polite "please type" reply was sent when a bot is
//            configured. The webhook stops processing this message.
//
// Never logs transcript text. Logs carry only reason codes.

import {
  checkAudioLimits,
  parseOggOpusDurationSec,
  type SpeechToText,
  type VoiceLimits,
  type FetchLike,
} from './transcribe'

export interface VoiceNoteInput {
  tenantId: string
  conversationId: string
  /** Meta message id (wamid). Also the idempotency key. */
  wamid: string
  mediaId: string
  mimeType: string
  phoneNumberId: string
  customerPhone: string
  accessToken: string
}

export interface VoiceNoteConfig {
  /** whatsapp_config.voice_notes_enabled. Missing column = false. */
  enabled: boolean
  /** A bot answers on this number (whatsapp_config.whatsapp_agent_id set). */
  hasAgent: boolean
}

export interface VoiceNoteStore {
  getConfig(phoneNumberId: string): Promise<VoiceNoteConfig>
  /** Transcript already saved on this message row, if any (replay safety). */
  getExistingTranscript(wamid: string): Promise<string | null>
  countRecentAudio(args: {
    tenantId: string
    conversationId: string
    sinceIso: string
  }): Promise<{ tenant: number; conversation: number }>
  saveTranscript(args: {
    wamid: string
    conversationId: string
    transcript: string
  }): Promise<void>
  flagForHuman(args: { conversationId: string; note: string }): Promise<void>
  sendPoliteReply(args: {
    input: VoiceNoteInput
    text: string
  }): Promise<void>
}

export interface DownloadedAudio {
  bytes: Uint8Array
  mimeType: string
}

export interface VoiceNoteDeps {
  store: VoiceNoteStore
  /** null = no provider key configured. */
  transcriber: SpeechToText | null
  downloadAudio(
    mediaId: string,
    accessToken: string,
    maxBytes: number,
  ): Promise<DownloadedAudio>
  limits: VoiceLimits
  now?: () => Date
  log?: (message: string) => void
}

export type VoiceNoteFailReason =
  | 'not_configured'
  | 'cap_tenant'
  | 'cap_conversation'
  | 'download_failed'
  | 'empty_audio'
  | 'too_large'
  | 'too_long'
  | 'timeout'
  | 'provider_error'
  | 'config'
  | 'no_speech'
  | 'empty'
  | 'unexpected'

export type VoiceNoteOutcome =
  | { action: 'skip'; why: 'disabled' | 'config_unreadable' }
  | { action: 'continue'; transcript: string; cached: boolean }
  | { action: 'handled'; reason: VoiceNoteFailReason }

/** Written to conversations.handoff_reason: what a human sees in the inbox. */
export const FLAG_NOTES: Record<VoiceNoteFailReason, string> = {
  not_configured: 'Voice note received but speech-to-text is not set up. Please listen and reply.',
  cap_tenant: 'Voice note not transcribed: daily voice-note limit reached. Please listen and reply.',
  cap_conversation: 'Voice note not transcribed: this customer sent too many voice notes today. Please listen and reply.',
  download_failed: 'Voice note could not be downloaded from WhatsApp. Please listen and reply.',
  empty_audio: 'Voice note was empty. Please check and reply.',
  too_large: 'Voice note not transcribed: file too large. Please listen and reply.',
  too_long: 'Voice note not transcribed: too long. Please listen and reply.',
  timeout: 'Voice note transcription timed out. Please listen and reply.',
  provider_error: 'Voice note transcription failed. Please listen and reply.',
  config: 'Voice note transcription is misconfigured (check the API key). Please listen and reply.',
  no_speech: 'Voice note had no clear speech. Please listen and reply.',
  empty: 'Voice note transcription came back empty. Please listen and reply.',
  unexpected: 'Voice note could not be processed. Please listen and reply.',
}

/**
 * Sent to the customer on failure (only when a bot is configured, and not
 * for cap reasons, so a spammer does not get a reply per message).
 * Fixed text, English + Hinglish, because the language is unknown.
 */
export const POLITE_FAILURE_REPLY =
  'Sorry, we could not play your voice message. Please type your message, or our team will listen and reply soon.\n\n' +
  'Maaf kijiye, aapka voice message hum sun nahi paaye. Kripya apna message type karke bhejein, ya hamari team jald reply karegi.'

const NO_REPLY_REASONS: ReadonlySet<VoiceNoteFailReason> = new Set([
  'cap_tenant',
  'cap_conversation',
])

export async function processVoiceNote(
  input: VoiceNoteInput,
  deps: VoiceNoteDeps,
): Promise<VoiceNoteOutcome> {
  const log = deps.log ?? (() => {})
  const now = deps.now ?? (() => new Date())
  const { store, limits } = deps

  // 1) Opt-in. Any problem reading the setting = feature off.
  let cfg: VoiceNoteConfig
  try {
    cfg = await store.getConfig(input.phoneNumberId)
  } catch {
    log('[voice-note] config unreadable; treating as disabled')
    return { action: 'skip', why: 'config_unreadable' }
  }
  if (!cfg.enabled) return { action: 'skip', why: 'disabled' }

  const fail = async (reason: VoiceNoteFailReason): Promise<VoiceNoteOutcome> => {
    log(`[voice-note] not transcribed, reason=${reason}`)
    try {
      await store.flagForHuman({
        conversationId: input.conversationId,
        note: FLAG_NOTES[reason],
      })
    } catch {
      log('[voice-note] could not flag conversation')
    }
    if (cfg.hasAgent && !NO_REPLY_REASONS.has(reason)) {
      try {
        await store.sendPoliteReply({ input, text: POLITE_FAILURE_REPLY })
      } catch {
        log('[voice-note] polite reply failed')
      }
    }
    return { action: 'handled', reason }
  }

  try {
    // 2) Replay safety: already transcribed? Reuse, no provider call.
    const existing = await store.getExistingTranscript(input.wamid)
    if (existing && existing.trim()) {
      return { action: 'continue', transcript: existing.trim(), cached: true }
    }

    // 3) Provider configured?
    if (!deps.transcriber) return await fail('not_configured')

    // 4) Daily caps (rolling 24h). The current message is already stored,
    //    so the count includes it: over the cap means count > cap.
    const since = new Date(now().getTime() - 24 * 60 * 60 * 1000).toISOString()
    const counts = await store.countRecentAudio({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      sinceIso: since,
    })
    if (counts.tenant > limits.dailyCapPerTenant) return await fail('cap_tenant')
    if (counts.conversation > limits.dailyCapPerConversation) return await fail('cap_conversation')

    // 5) Download (bounded).
    let audio: DownloadedAudio
    try {
      audio = await deps.downloadAudio(input.mediaId, input.accessToken, limits.maxBytes)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      return await fail(msg === 'too_large' ? 'too_large' : 'download_failed')
    }

    // 6) Size / duration caps.
    const duration = parseOggOpusDurationSec(audio.bytes)
    const lim = checkAudioLimits(audio.bytes.length, duration, limits)
    if (!lim.ok) return await fail(lim.reason)

    // 7) Transcribe.
    const result = await deps.transcriber.transcribe(
      { bytes: audio.bytes, mimeType: audio.mimeType || input.mimeType },
      { languageHints: ['hi', 'en'] },
    )
    if (!result.ok) return await fail(result.reason)

    // 8) Save, then hand the transcript to the caller.
    try {
      await store.saveTranscript({
        wamid: input.wamid,
        conversationId: input.conversationId,
        transcript: result.text,
      })
    } catch {
      // The transcript is still good for this reply; only the inbox copy
      // is missing. Do not drop the customer's message over it.
      log('[voice-note] could not save transcript to the message row')
    }
    log(`[voice-note] transcribed provider=${result.provider} chars=${result.text.length}`)
    return { action: 'continue', transcript: result.text, cached: false }
  } catch {
    return await fail('unexpected')
  }
}

// ─────────────────────────────────────────────────────────────
// Bounded download helper (pure: fetch is injected)
// ─────────────────────────────────────────────────────────────

/**
 * Downloads `url` with the Meta bearer token and refuses to read more than
 * `maxBytes`. Throws Error('too_large') when the file is bigger, so a
 * 100 MB audio cannot fill the function's memory.
 */
export async function downloadWithCap(
  url: string,
  accessToken: string,
  maxBytes: number,
  timeoutMs: number,
  fetchImpl: FetchLike = (u, i) => fetch(u, i),
): Promise<DownloadedAudio> {
  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`download_http_${res.status}`)
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error('too_large')

  const mimeType = res.headers.get('content-type') || 'audio/ogg'
  const reader = res.body?.getReader()
  if (!reader) {
    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.length > maxBytes) throw new Error('too_large')
    return { bytes: buf, mimeType }
  }
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.length
      if (total > maxBytes) {
        try {
          await reader.cancel()
        } catch {
          /* ignore */
        }
        throw new Error('too_large')
      }
      chunks.push(value)
    }
  }
  const bytes = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    bytes.set(c, off)
    off += c.length
  }
  return { bytes, mimeType }
}

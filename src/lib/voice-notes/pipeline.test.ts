import { describe, it, expect } from 'vitest'
import {
  FLAG_NOTES,
  POLITE_FAILURE_REPLY,
  downloadWithCap,
  processVoiceNote,
  type VoiceNoteDeps,
  type VoiceNoteInput,
  type VoiceNoteStore,
} from './pipeline'
import { DEFAULT_LIMITS, createMockTranscriber, type TranscribeResult } from './transcribe'
import { buildOggOpus } from './test-helpers'

const input: VoiceNoteInput = {
  tenantId: 't1',
  conversationId: 'c1',
  wamid: 'wamid.1',
  mediaId: 'media1',
  mimeType: 'audio/ogg; codecs=opus',
  phoneNumberId: 'p1',
  customerPhone: '919800000000',
  accessToken: 'tok',
}

const OK: TranscribeResult = { ok: true, text: 'Doctor sahab kal se gala dard hai', provider: 'gemini', model: 'm' }

function fakeStore(over: Partial<VoiceNoteStore> = {}) {
  const calls = { saved: [] as string[], flagged: [] as string[], replies: [] as string[] }
  const store: VoiceNoteStore = {
    getConfig: async () => ({ enabled: true, hasAgent: true }),
    getExistingTranscript: async () => null,
    countRecentAudio: async () => ({ tenant: 1, conversation: 1 }),
    saveTranscript: async ({ transcript }) => {
      calls.saved.push(transcript)
    },
    flagForHuman: async ({ note }) => {
      calls.flagged.push(note)
    },
    sendPoliteReply: async ({ text }) => {
      calls.replies.push(text)
    },
    ...over,
  }
  return { store, calls }
}

function deps(store: VoiceNoteStore, over: Partial<VoiceNoteDeps> = {}) {
  const logs: string[] = []
  const transcriber = createMockTranscriber(OK)
  const d: VoiceNoteDeps = {
    store,
    transcriber,
    downloadAudio: async () => ({ bytes: buildOggOpus(10), mimeType: 'audio/ogg' }),
    limits: DEFAULT_LIMITS,
    log: (m) => logs.push(m),
    ...over,
  }
  return { d, logs, transcriber }
}

describe('processVoiceNote: switched off / unreadable', () => {
  it('skips when the tenant has not opted in, with no download or provider call', async () => {
    const { store, calls } = fakeStore({ getConfig: async () => ({ enabled: false, hasAgent: true }) })
    let downloaded = false
    const { d, transcriber } = deps(store, { downloadAudio: async () => { downloaded = true; return { bytes: new Uint8Array(1), mimeType: '' } } })
    expect(await processVoiceNote(input, d)).toEqual({ action: 'skip', why: 'disabled' })
    expect(downloaded).toBe(false)
    expect(transcriber.calls.length).toBe(0)
    expect(calls.flagged.length).toBe(0)
  })
  it('skips (feature off) when the config cannot be read, for example a missing column', async () => {
    const { store } = fakeStore({ getConfig: async () => { throw new Error('x') } })
    const { d } = deps(store)
    expect(await processVoiceNote(input, d)).toEqual({ action: 'skip', why: 'config_unreadable' })
  })
})

describe('processVoiceNote: success', () => {
  it('transcribes, saves, and continues with the transcript', async () => {
    const { store, calls } = fakeStore()
    const { d, transcriber } = deps(store)
    const out = await processVoiceNote(input, d)
    expect(out).toEqual({ action: 'continue', transcript: OK.ok ? OK.text : '', cached: false })
    expect(calls.saved).toEqual(['Doctor sahab kal se gala dard hai'])
    expect(calls.flagged.length).toBe(0)
    expect(transcriber.calls.length).toBe(1)
  })
  it('still continues when saving the transcript row fails', async () => {
    const { store } = fakeStore({ saveTranscript: async () => { throw new Error('db') } })
    const { d } = deps(store)
    const out = await processVoiceNote(input, d)
    expect(out.action).toBe('continue')
  })
  it('reuses an existing transcript without calling the provider (replay safety)', async () => {
    const { store } = fakeStore({ getExistingTranscript: async () => 'already done' })
    const { d, transcriber } = deps(store)
    expect(await processVoiceNote(input, d)).toEqual({ action: 'continue', transcript: 'already done', cached: true })
    expect(transcriber.calls.length).toBe(0)
  })
  it('never logs the transcript text', async () => {
    const { store } = fakeStore()
    const { d, logs } = deps(store)
    await processVoiceNote(input, d)
    expect(logs.join(' ')).not.toContain('gala dard')
    expect(logs.join(' ')).not.toContain('Doctor')
  })
})

describe('processVoiceNote: failures are flagged, never silent', () => {
  it('not configured: flags the chat and sends the polite reply when a bot exists', async () => {
    const { store, calls } = fakeStore()
    const { d } = deps(store, { transcriber: null })
    expect(await processVoiceNote(input, d)).toEqual({ action: 'handled', reason: 'not_configured' })
    expect(calls.flagged).toEqual([FLAG_NOTES.not_configured])
    expect(calls.replies).toEqual([POLITE_FAILURE_REPLY])
  })
  it('no bot configured: flags but sends no reply', async () => {
    const { store, calls } = fakeStore({ getConfig: async () => ({ enabled: true, hasAgent: false }) })
    const { d } = deps(store, { transcriber: null })
    await processVoiceNote(input, d)
    expect(calls.flagged.length).toBe(1)
    expect(calls.replies.length).toBe(0)
  })
  it.each([
    ['timeout'],
    ['provider_error'],
    ['config'],
    ['no_speech'],
    ['empty'],
  ] as const)('provider failure %s -> flagged + polite reply', async (reason) => {
    const { store, calls } = fakeStore()
    const { d } = deps(store, { transcriber: createMockTranscriber({ ok: false, reason, provider: 'mock' }) })
    expect(await processVoiceNote(input, d)).toEqual({ action: 'handled', reason })
    expect(calls.flagged).toEqual([FLAG_NOTES[reason]])
    expect(calls.replies.length).toBe(1)
    expect(calls.saved.length).toBe(0)
  })
  it('download failure -> flagged', async () => {
    const { store, calls } = fakeStore()
    const { d, transcriber } = deps(store, { downloadAudio: async () => { throw new Error('download_http_404') } })
    expect(await processVoiceNote(input, d)).toEqual({ action: 'handled', reason: 'download_failed' })
    expect(calls.flagged).toEqual([FLAG_NOTES.download_failed])
    expect(transcriber.calls.length).toBe(0)
  })
  it('download says too_large -> too_large', async () => {
    const { store } = fakeStore()
    const { d } = deps(store, { downloadAudio: async () => { throw new Error('too_large') } })
    expect(await processVoiceNote(input, d)).toEqual({ action: 'handled', reason: 'too_large' })
  })
  it('file bigger than the cap -> too_large, provider not called', async () => {
    const { store } = fakeStore()
    const big = new Uint8Array(DEFAULT_LIMITS.maxBytes + 1)
    const { d, transcriber } = deps(store, { downloadAudio: async () => ({ bytes: big, mimeType: 'audio/ogg' }) })
    expect(await processVoiceNote(input, d)).toEqual({ action: 'handled', reason: 'too_large' })
    expect(transcriber.calls.length).toBe(0)
  })
  it('voice note longer than the cap -> too_long, provider not called', async () => {
    const { store } = fakeStore()
    const { d, transcriber } = deps(store, { downloadAudio: async () => ({ bytes: buildOggOpus(300), mimeType: 'audio/ogg' }) })
    expect(await processVoiceNote(input, d)).toEqual({ action: 'handled', reason: 'too_long' })
    expect(transcriber.calls.length).toBe(0)
  })
  it('empty audio -> flagged', async () => {
    const { store } = fakeStore()
    const { d } = deps(store, { downloadAudio: async () => ({ bytes: new Uint8Array(0), mimeType: 'audio/ogg' }) })
    expect(await processVoiceNote(input, d)).toEqual({ action: 'handled', reason: 'empty_audio' })
  })
  it('an unexpected exception is flagged as unexpected', async () => {
    const { store, calls } = fakeStore({ countRecentAudio: async () => { throw new Error('boom') } })
    const { d } = deps(store)
    expect(await processVoiceNote(input, d)).toEqual({ action: 'handled', reason: 'unexpected' })
    expect(calls.flagged).toEqual([FLAG_NOTES.unexpected])
  })
  it('still returns handled when flagging or replying themselves fail', async () => {
    const { store } = fakeStore({
      flagForHuman: async () => { throw new Error('db') },
      sendPoliteReply: async () => { throw new Error('meta') },
    })
    const { d } = deps(store, { transcriber: null })
    expect(await processVoiceNote(input, d)).toEqual({ action: 'handled', reason: 'not_configured' })
  })
})

describe('processVoiceNote: abuse caps', () => {
  it('tenant over the daily cap -> flagged, NO polite reply, provider not called', async () => {
    const { store, calls } = fakeStore({ countRecentAudio: async () => ({ tenant: DEFAULT_LIMITS.dailyCapPerTenant + 1, conversation: 1 }) })
    const { d, transcriber } = deps(store)
    expect(await processVoiceNote(input, d)).toEqual({ action: 'handled', reason: 'cap_tenant' })
    expect(calls.flagged).toEqual([FLAG_NOTES.cap_tenant])
    expect(calls.replies.length).toBe(0)
    expect(transcriber.calls.length).toBe(0)
  })
  it('conversation over its cap -> flagged, no reply', async () => {
    const { store, calls } = fakeStore({ countRecentAudio: async () => ({ tenant: 1, conversation: DEFAULT_LIMITS.dailyCapPerConversation + 1 }) })
    const { d } = deps(store)
    expect(await processVoiceNote(input, d)).toEqual({ action: 'handled', reason: 'cap_conversation' })
    expect(calls.replies.length).toBe(0)
  })
  it('exactly at the cap is allowed (count includes the current message)', async () => {
    const { store } = fakeStore({ countRecentAudio: async () => ({ tenant: DEFAULT_LIMITS.dailyCapPerTenant, conversation: DEFAULT_LIMITS.dailyCapPerConversation }) })
    const { d } = deps(store)
    expect((await processVoiceNote(input, d)).action).toBe('continue')
  })
  it('asks for a rolling 24 hour window', async () => {
    let since = ''
    const { store } = fakeStore({ countRecentAudio: async (a) => { since = a.sinceIso; return { tenant: 0, conversation: 0 } } })
    const { d } = deps(store, { now: () => new Date('2026-11-11T12:00:00.000Z') })
    await processVoiceNote(input, d)
    expect(since).toBe('2026-11-10T12:00:00.000Z')
  })
  it('cached transcripts do not count against the caps', async () => {
    const { store } = fakeStore({
      getExistingTranscript: async () => 'cached text',
      countRecentAudio: async () => { throw new Error('should not be called') },
    })
    const { d } = deps(store)
    expect((await processVoiceNote(input, d)).action).toBe('continue')
  })
})

async function errorMessage(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn()
    return 'no error'
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

describe('downloadWithCap', () => {
  const resp = (body: Uint8Array, headers: Record<string, string> = {}, status = 200) =>
    new Response(body as unknown as BodyInit, { status, headers })

  it('downloads within the cap and returns content-type', async () => {
    const r = await downloadWithCap('https://x/y', 'tok', 100, 1000, async () => resp(new Uint8Array([1, 2, 3]), { 'content-type': 'audio/ogg' }))
    expect(Array.from(r.bytes)).toEqual([1, 2, 3])
    expect(r.mimeType).toBe('audio/ogg')
  })
  it('sends the bearer token', async () => {
    let auth = ''
    await downloadWithCap('https://x/y', 'tok', 100, 1000, async (_u, i) => {
      auth = (i?.headers as Record<string, string>).Authorization
      return resp(new Uint8Array([1]))
    })
    expect(auth).toBe('Bearer tok')
  })
  it('refuses when content-length is over the cap, before reading', async () => {
    expect(await errorMessage(() => downloadWithCap('https://x/y', 't', 10, 1000, async () => resp(new Uint8Array(5), { 'content-length': '999' })))).toBe('too_large')
  })
  it('refuses when the stream exceeds the cap with no content-length', async () => {
    expect(await errorMessage(() => downloadWithCap('https://x/y', 't', 10, 1000, async () => resp(new Uint8Array(50))))).toBe('too_large')
  })
  it('throws on HTTP errors', async () => {
    expect(await errorMessage(() => downloadWithCap('https://x/y', 't', 10, 1000, async () => resp(new Uint8Array(1), {}, 404)))).toBe('download_http_404')
  })
})

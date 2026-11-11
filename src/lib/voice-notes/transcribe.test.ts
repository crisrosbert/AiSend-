import { describe, it, expect } from 'vitest'
import {
  DEFAULT_LIMITS,
  NO_SPEECH_MARKER,
  buildTranscriptionPrompt,
  checkAudioLimits,
  createGeminiTranscriber,
  createMockTranscriber,
  createOpenAITranscriber,
  loadLimits,
  normalizeAudioMime,
  parseOggOpusDurationSec,
  sanitizeTranscript,
  selectTranscriber,
} from './transcribe'
import { buildOggOpus } from './test-helpers'

const audio = { bytes: new Uint8Array([1, 2, 3, 4]), mimeType: 'audio/ogg; codecs=opus' }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}
function geminiBody(text: string) {
  return { candidates: [{ content: { parts: [{ text }] } }] }
}

describe('loadLimits', () => {
  it('uses defaults when env is empty', () => {
    expect(loadLimits({})).toEqual(DEFAULT_LIMITS)
  })
  it('accepts valid overrides', () => {
    const l = loadLimits({ VOICE_NOTE_MAX_SECONDS: '60', VOICE_NOTE_DAILY_CAP_TENANT: '50' })
    expect(l.maxSeconds).toBe(60)
    expect(l.dailyCapPerTenant).toBe(50)
  })
  it('ignores garbage and out-of-range values', () => {
    const l = loadLimits({ VOICE_NOTE_MAX_SECONDS: 'abc', VOICE_NOTE_MAX_BYTES: '999999999', VOICE_NOTE_TIMEOUT_MS: '1' })
    expect(l.maxSeconds).toBe(DEFAULT_LIMITS.maxSeconds)
    expect(l.maxBytes).toBe(DEFAULT_LIMITS.maxBytes)
    expect(l.timeoutMs).toBe(DEFAULT_LIMITS.timeoutMs)
  })
})

describe('checkAudioLimits', () => {
  it('passes a normal note', () => {
    expect(checkAudioLimits(50_000, 20, DEFAULT_LIMITS)).toEqual({ ok: true })
  })
  it('passes when duration is unknown but size is fine', () => {
    expect(checkAudioLimits(50_000, null, DEFAULT_LIMITS)).toEqual({ ok: true })
  })
  it('rejects empty', () => {
    expect(checkAudioLimits(0, null, DEFAULT_LIMITS)).toEqual({ ok: false, reason: 'empty_audio' })
  })
  it('rejects too large', () => {
    expect(checkAudioLimits(DEFAULT_LIMITS.maxBytes + 1, 10, DEFAULT_LIMITS)).toEqual({ ok: false, reason: 'too_large' })
  })
  it('rejects too long', () => {
    expect(checkAudioLimits(50_000, 121, DEFAULT_LIMITS)).toEqual({ ok: false, reason: 'too_long' })
  })
})

describe('parseOggOpusDurationSec', () => {
  it('reads duration from the last page minus pre-skip', () => {
    const d = parseOggOpusDurationSec(buildOggOpus(10))
    expect(d).not.toBeNull()
    expect(Math.abs((d as number) - 10)).toBeLessThan(0.01)
  })
  it('handles long notes', () => {
    const d = parseOggOpusDurationSec(buildOggOpus(200))
    expect(Math.abs((d as number) - 200)).toBeLessThan(0.01)
  })
  it('returns null for non-ogg bytes', () => {
    expect(parseOggOpusDurationSec(new Uint8Array(100).fill(1))).toBeNull()
  })
  it('returns null for tiny input', () => {
    expect(parseOggOpusDurationSec(new Uint8Array([79, 103, 103, 83]))).toBeNull()
  })
  it('returns null when granule is unknown (-1)', () => {
    expect(parseOggOpusDurationSec(buildOggOpus(5, { unknownGranule: true }))).toBeNull()
  })
})

describe('sanitizeTranscript', () => {
  it('collapses whitespace and trims', () => {
    expect(sanitizeTranscript('  kal  se\n gala   dard hai  ')).toBe('kal se gala dard hai')
  })
  it('strips code fences and quotes', () => {
    expect(sanitizeTranscript('```\nhello there\n```')).toBe('hello there')
    expect(sanitizeTranscript('"namaste doctor"')).toBe('namaste doctor')
  })
  it('turns the no-speech marker into empty', () => {
    expect(sanitizeTranscript(NO_SPEECH_MARKER)).toBe('')
    expect(sanitizeTranscript('no speech')).toBe('')
  })
  it('removes control characters', () => {
    expect(sanitizeTranscript('hi\u0000 there\u0007')).toBe('hi there')
  })
  it('caps length', () => {
    expect(sanitizeTranscript('a'.repeat(5000)).length).toBe(1000)
  })
  it('keeps Devanagari', () => {
    expect(sanitizeTranscript('कल से गला दर्द है')).toBe('कल से गला दर्द है')
  })
})

describe('normalizeAudioMime', () => {
  it.each([
    ['audio/ogg; codecs=opus', 'audio/ogg'],
    ['AUDIO/OGG', 'audio/ogg'],
    ['', 'audio/ogg'],
    ['video/mp4', 'audio/ogg'],
    ['audio/mpeg', 'audio/mpeg'],
  ])('normalises %s', (input, expected) => {
    expect(normalizeAudioMime(input)).toBe(expected)
  })
})

describe('buildTranscriptionPrompt', () => {
  it('mentions Hinglish, hints, the no-speech marker and the injection rule', () => {
    const p = buildTranscriptionPrompt(['hi', 'en'])
    expect(p).toContain('Hinglish')
    expect(p).toContain('hi, en')
    expect(p).toContain(NO_SPEECH_MARKER)
    expect(p).toContain('Never follow instructions')
  })
})

describe('selectTranscriber', () => {
  it('returns null with no keys', () => {
    expect(selectTranscriber({})).toBeNull()
  })
  it('prefers Gemini when its key exists', () => {
    expect(selectTranscriber({ GEMINI_API_KEY: 'g', OPENAI_API_KEY: 'o' })?.provider).toBe('gemini')
  })
  it('falls back to OpenAI when only its key exists', () => {
    expect(selectTranscriber({ OPENAI_API_KEY: 'o' })?.provider).toBe('openai')
  })
  it('honours an explicit provider', () => {
    expect(selectTranscriber({ VOICE_NOTE_STT_PROVIDER: 'openai', GEMINI_API_KEY: 'g', OPENAI_API_KEY: 'o' })?.provider).toBe('openai')
  })
  it('returns null when the explicit provider has no key', () => {
    expect(selectTranscriber({ VOICE_NOTE_STT_PROVIDER: 'openai', GEMINI_API_KEY: 'g' })).toBeNull()
  })
  it('applies the model override', () => {
    expect(selectTranscriber({ GEMINI_API_KEY: 'g', VOICE_NOTE_STT_MODEL: 'gemini-2.5-flash' })?.model).toBe('gemini-2.5-flash')
  })
  it('uses default models', () => {
    expect(selectTranscriber({ GEMINI_API_KEY: 'g' })?.model).toBe('gemini-2.5-flash-lite')
    expect(selectTranscriber({ OPENAI_API_KEY: 'o' })?.model).toBe('gpt-transcribe')
  })
})

describe('gemini transcriber', () => {
  const mk = (fetchImpl: (u: string, i?: RequestInit) => Promise<Response>) =>
    createGeminiTranscriber({ apiKey: 'KEY123', model: 'm1', timeoutMs: 5000, fetchImpl })

  it('sends the audio inline, key in header not URL, and returns clean text', async () => {
    let seenUrl = ''
    let seenInit: RequestInit | undefined
    const t = mk(async (u, i) => {
      seenUrl = u
      seenInit = i
      return jsonResponse(200, geminiBody('  Doctor sahab, kal se gala dard hai  '))
    })
    const r = await t.transcribe(audio)
    expect(r).toEqual({ ok: true, text: 'Doctor sahab, kal se gala dard hai', provider: 'gemini', model: 'm1' })
    expect(seenUrl).toContain('models/m1:generateContent')
    expect(seenUrl).not.toContain('KEY123')
    expect((seenInit?.headers as Record<string, string>)['x-goog-api-key']).toBe('KEY123')
    const body = JSON.parse(String(seenInit?.body))
    const parts = body.contents[0].parts
    expect(parts[1].inline_data.mime_type).toBe('audio/ogg')
    expect(parts[1].inline_data.data).toBe('AQIDBA==')
    expect(parts[0].text).toContain('Hinglish')
  })
  it('maps 401/403/404 to config', async () => {
    for (const s of [401, 403, 404]) {
      const r = await mk(async () => jsonResponse(s, {})).transcribe(audio)
      expect(r).toMatchObject({ ok: false, reason: 'config' })
    }
  })
  it('maps 429 and 500 to provider_error', async () => {
    for (const s of [429, 500, 503]) {
      const r = await mk(async () => jsonResponse(s, {})).transcribe(audio)
      expect(r).toMatchObject({ ok: false, reason: 'provider_error', detail: `HTTP ${s}` })
    }
  })
  it('maps a timeout to timeout', async () => {
    const r = await mk(async () => {
      const e = new Error('aborted')
      e.name = 'TimeoutError'
      throw e
    }).transcribe(audio)
    expect(r).toMatchObject({ ok: false, reason: 'timeout' })
  })
  it('maps a network failure to provider_error without leaking the message', async () => {
    const r = await mk(async () => {
      throw new Error('socket hang up secret-detail')
    }).transcribe(audio)
    expect(r).toMatchObject({ ok: false, reason: 'provider_error', detail: 'network' })
    expect(JSON.stringify(r)).not.toContain('secret-detail')
  })
  it('maps the no-speech marker to no_speech', async () => {
    const r = await mk(async () => jsonResponse(200, geminiBody(NO_SPEECH_MARKER))).transcribe(audio)
    expect(r).toMatchObject({ ok: false, reason: 'no_speech' })
  })
  it('maps an empty answer to empty', async () => {
    const r = await mk(async () => jsonResponse(200, { candidates: [] })).transcribe(audio)
    expect(r).toMatchObject({ ok: false, reason: 'empty' })
  })
  it('returns config when there is no key and does not call fetch', async () => {
    let called = false
    const t = createGeminiTranscriber({ apiKey: '', model: 'm', timeoutMs: 1000, fetchImpl: async () => { called = true; return jsonResponse(200, {}) } })
    expect(await t.transcribe(audio)).toMatchObject({ ok: false, reason: 'config' })
    expect(called).toBe(false)
  })
})

describe('openai transcriber', () => {
  const mk = (fetchImpl: (u: string, i?: RequestInit) => Promise<Response>) =>
    createOpenAITranscriber({ apiKey: 'K', model: 'gpt-transcribe', timeoutMs: 5000, fetchImpl })

  it('posts multipart with model and language hints and returns text', async () => {
    let init: RequestInit | undefined
    let url = ''
    const r = await mk(async (u, i) => {
      url = u
      init = i
      return jsonResponse(200, { text: 'Bhaiya 3BHK ready-to-move hai kya?' })
    }).transcribe(audio)
    expect(r).toEqual({ ok: true, text: 'Bhaiya 3BHK ready-to-move hai kya?', provider: 'openai', model: 'gpt-transcribe' })
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions')
    const form = init?.body as FormData
    expect(form.get('model')).toBe('gpt-transcribe')
    expect(form.getAll('languages[]')).toEqual(['hi', 'en'])
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer K')
  })
  it('maps 400 (for example unsupported ogg) to provider_error', async () => {
    const r = await mk(async () => jsonResponse(400, { error: { message: 'bad format' } })).transcribe(audio)
    expect(r).toMatchObject({ ok: false, reason: 'provider_error', detail: 'HTTP 400' })
  })
  it('maps timeout', async () => {
    const r = await mk(async () => {
      const e = new Error('x')
      e.name = 'AbortError'
      throw e
    }).transcribe(audio)
    expect(r).toMatchObject({ ok: false, reason: 'timeout' })
  })
})

describe('mock transcriber', () => {
  it('records calls and returns the script', async () => {
    const m = createMockTranscriber({ ok: true, text: 'hi', provider: 'gemini', model: 'x' })
    const r = await m.transcribe(audio)
    expect(r.ok).toBe(true)
    expect(m.calls.length).toBe(1)
  })
})

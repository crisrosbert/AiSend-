// src/lib/agent/llm-provider-config.test.ts
//
// Companion to llm-provider.test.ts (which stays as it is). Covers the
// "fail loudly" helpers and error classification.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { activeProvider, callLLM, classifyLLMError, providerConfigIssue } from './llm-provider'

const saved = { ...process.env }

beforeEach(() => {
  delete process.env.LLM_PROVIDER
  delete process.env.OPENAI_API_KEY
  delete process.env.GEMINI_API_KEY
})
afterEach(() => {
  process.env = { ...saved }
})

describe('providerConfigIssue', () => {
  it('reports a missing key for the default provider', () => {
    expect(providerConfigIssue()).toMatch(/OPENAI_API_KEY is not set/)
  })

  it('reports a missing key for Gemini when Gemini is selected', () => {
    process.env.LLM_PROVIDER = 'gemini'
    process.env.OPENAI_API_KEY = 'sk-present-but-unused'
    expect(providerConfigIssue()).toMatch(/GEMINI_API_KEY is not set/)
  })

  it('reports an unrecognised provider name and what is used instead', () => {
    process.env.LLM_PROVIDER = 'gemni'
    process.env.OPENAI_API_KEY = 'sk-test'
    const issue = providerConfigIssue()
    expect(issue).toMatch(/not valid/)
    expect(issue).toMatch(/gemni/)
    expect(issue).toMatch(/openai/)
    // the typo still resolves to the default so nothing crashes
    expect(activeProvider()).toBe('openai')
  })

  it('is null when everything is in order', () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    expect(providerConfigIssue()).toBeNull()
    process.env.LLM_PROVIDER = 'GEMINI'
    process.env.GEMINI_API_KEY = 'g-test'
    expect(providerConfigIssue()).toBeNull()
  })

  it('never includes a key value', () => {
    process.env.LLM_PROVIDER = 'nope'
    process.env.OPENAI_API_KEY = 'sk-super-secret'
    expect(providerConfigIssue()).not.toContain('sk-super-secret')
  })
})

describe('classifyLLMError', () => {
  it('missing key, bad key and bad model are config errors', () => {
    expect(classifyLLMError(new Error('OPENAI_API_KEY not set'))).toBe('config')
    expect(classifyLLMError(new Error('GEMINI_API_KEY not set'))).toBe('config')
    expect(classifyLLMError(new Error('OpenAI API 401: invalid key'))).toBe('config')
    expect(classifyLLMError(new Error('Gemini API 403: nope'))).toBe('config')
    expect(classifyLLMError(new Error('OpenAI API 404: model not found'))).toBe('config')
  })
  it('rate limits, server errors and timeouts are transient', () => {
    expect(classifyLLMError(new Error('OpenAI API 429: slow down'))).toBe('transient')
    expect(classifyLLMError(new Error('Gemini API 503: overloaded'))).toBe('transient')
    expect(classifyLLMError(new Error('The operation was aborted due to timeout'))).toBe('transient')
    expect(classifyLLMError('weird')).toBe('transient')
  })
})

// ── callLLM keeps its optional 4th argument ──────────────────────────
// campaign-agent/plan, campaign-agent/rewrite and tools/chatbot/chat call
// callLLM(system, turns, tools, { model }). An earlier version of this
// file dropped that parameter and broke the build.
describe('callLLM options', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  function fakeFetch(captured: { url?: string; body?: string; signal?: unknown }) {
    globalThis.fetch = (async (url: unknown, init?: { body?: string; signal?: unknown }) => {
      captured.url = String(url)
      captured.body = init?.body
      captured.signal = init?.signal
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'ok' } }], usage: { total_tokens: 3 } }),
        { status: 200 },
      )
    }) as typeof fetch
  }

  it('uses options.model instead of the deployment default (OpenAI)', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.OPENAI_MODEL = 'gpt-default'
    const cap: { body?: string; signal?: unknown } = {}
    fakeFetch(cap)
    const res = await callLLM('sys', [{ role: 'user', text: 'hi' }], [], { model: 'gpt-override' })
    expect(res.text).toBe('ok')
    expect(JSON.parse(cap.body as string).model).toBe('gpt-override')
  })

  it('falls back to the default model when options.model is undefined', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.OPENAI_MODEL = 'gpt-default'
    const cap: { body?: string } = {}
    fakeFetch(cap)
    await callLLM('sys', [{ role: 'user', text: 'hi' }], [], { model: undefined })
    expect(JSON.parse(cap.body as string).model).toBe('gpt-default')
  })

  it('still works with three arguments and always sets a timeout signal', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    const cap: { signal?: unknown } = {}
    fakeFetch(cap)
    await callLLM('sys', [{ role: 'user', text: 'hi' }], [])
    expect(cap.signal).toBeDefined()
  })
})

// src/lib/agent/llm-provider-config.test.ts
//
// Companion to llm-provider.test.ts (which stays as it is). Covers the
// "fail loudly" helpers and error classification.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { activeProvider, classifyLLMError, providerConfigIssue } from './llm-provider'

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

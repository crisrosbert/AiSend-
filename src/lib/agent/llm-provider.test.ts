  // src/lib/agent/llm-provider.test.ts
//
// Which provider serves a call used to be decided in three places:
// llm-provider, the engine's key check, and a hardcoded model name in
// the usage log. Three copies of one rule, and they had already
// drifted — the log claimed every call was served by a Gemini model no
// matter what actually ran, so the usage table was wrong about what
// was being billed.
//
// These pin the single reader they were replaced with.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { activeProvider, activeModel, hasProviderKey } from './llm-provider'

const saved = { ...process.env }

beforeEach(() => {
  delete process.env.LLM_PROVIDER
  delete process.env.OPENAI_API_KEY
  delete process.env.GEMINI_API_KEY
  delete process.env.OPENAI_MODEL
  delete process.env.GEMINI_MODEL
})

afterEach(() => {
  process.env = { ...saved }
})

describe('activeProvider', () => {
  it('defaults to OpenAI when nothing is configured', () => {
    // The default used to be Gemini. A deployment that simply forgot to
    // set LLM_PROVIDER then ran on a provider nobody chose, and — since
    // the key check is per provider — could report "no API key" while a
    // perfectly good OPENAI_API_KEY sat right there in the environment.
    expect(activeProvider()).toBe('openai')
  })

  it('honours an explicit gemini setting', () => {
    process.env.LLM_PROVIDER = 'gemini'
    expect(activeProvider()).toBe('gemini')
  })

  it('ignores case', () => {
    process.env.LLM_PROVIDER = 'GEMINI'
    expect(activeProvider()).toBe('gemini')
  })

  it('falls back to OpenAI on an unrecognised value', () => {
    // A typo must not silently disable the agent. Anything that is not
    // "gemini" means the default, which is the configured one.
    process.env.LLM_PROVIDER = 'gemni'
    expect(activeProvider()).toBe('openai')
  })
})

describe('hasProviderKey', () => {
  it('checks the key belonging to the ACTIVE provider', () => {
    // The failure this prevents: holding a Gemini key, switching the
    // platform to OpenAI, and the engine happily reporting itself
    // healthy right up until the first call fails.
    process.env.GEMINI_API_KEY = 'gemini-key'
    expect(activeProvider()).toBe('openai')
    expect(hasProviderKey()).toBe(false)
  })

  it('passes when the right key is present', () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    expect(hasProviderKey()).toBe(true)
  })

  it('checks the Gemini key when Gemini is active', () => {
    process.env.LLM_PROVIDER = 'gemini'
    process.env.GEMINI_API_KEY = 'gemini-key'
    expect(hasProviderKey()).toBe(true)

    delete process.env.GEMINI_API_KEY
    expect(hasProviderKey()).toBe(false)
  })
})

describe('activeModel', () => {
  it('reports an OpenAI model by default', () => {
    // Logged against every call in agent_usage_logs. It was hardcoded
    // to 'gemini-2.5-flash-lite', so the usage table described a model
    // that may never have run.
    expect(activeModel()).toMatch(/^gpt-/)
  })

  it('follows OPENAI_MODEL when set', () => {
    process.env.OPENAI_MODEL = 'gpt-4o'
    expect(activeModel()).toBe('gpt-4o')
  })

  it('reports a Gemini model when Gemini is active', () => {
    process.env.LLM_PROVIDER = 'gemini'
    expect(activeModel()).toMatch(/^gemini-/)
  })

  it('never reports one provider’s model while the other is active', () => {
    // The invariant the hardcoded string broke.
    process.env.OPENAI_MODEL = 'gpt-4o'
    process.env.GEMINI_MODEL = 'gemini-2.5-flash-lite'

    expect(activeProvider()).toBe('openai')
    expect(activeModel()).not.toMatch(/gemini/)

    process.env.LLM_PROVIDER = 'gemini'
    expect(activeModel()).not.toMatch(/gpt/)
  })
})

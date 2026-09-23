// src/lib/agent/rag/embed.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { embedText, embedBatch, hasEmbeddingKey } from './embed'

const saved = { ...process.env }

beforeEach(() => {
  delete process.env.OPENAI_API_KEY
})

afterEach(() => {
  process.env = { ...saved }
  vi.unstubAllGlobals()
})

describe('hasEmbeddingKey', () => {
  it('is false with no key configured', () => {
    expect(hasEmbeddingKey()).toBe(false)
  })

  it('is true once OPENAI_API_KEY is set', () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    expect(hasEmbeddingKey()).toBe(true)
  })
})

describe('embedBatch', () => {
  it('returns [] for an empty input without calling the network', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    expect(await embedBatch([])).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('throws when OPENAI_API_KEY is missing', async () => {
    await expect(embedBatch(['hello'])).rejects.toThrow('OPENAI_API_KEY not set')
  })

  it('re-sorts by the index the API returns rather than trusting array order', async () => {
    // A provider-side reorder must not silently attach chunk 3's text to
    // chunk 7's vector — this is the one thing worth pinning here.
    process.env.OPENAI_API_KEY = 'sk-test'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            { index: 1, embedding: [0.2] },
            { index: 0, embedding: [0.1] },
          ],
        }),
      })),
    )

    const vectors = await embedBatch(['first', 'second'])
    expect(vectors).toEqual([[0.1], [0.2]])
  })

  it('surfaces the API error with the status code', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 429,
        text: async () => 'rate limited',
      })),
    )

    await expect(embedBatch(['hello'])).rejects.toThrow(/429/)
  })
})

describe('embedText', () => {
  it('embeds a single string and returns its vector', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: [{ index: 0, embedding: [0.5, 0.6] }] }),
      })),
    )

    expect(await embedText('what are your hours?')).toEqual([0.5, 0.6])
  })
})

// src/lib/agent/tools/knowledge-base-tools.ts
//
// Wires the RAG retrieve function into a tool the AI agent can call.
// This is the bridge between stored knowledge and Claude/Gemini.

import { retrieve } from '@/lib/agent/rag/retrieve'

export interface SearchKnowledgeBaseArgs {
  tenantId: string
  journeyId?: string
  query: string
  maxChunks?: number
}

/**
 * Search the merchant's uploaded knowledge base.
 * Returns plain text for the AI to use in its reply.
 * Never throws — returns a "not found" message on failure.
 */
export async function searchKnowledgeBase(
  args: SearchKnowledgeBaseArgs,
): Promise<string> {
  try {
    const chunks = await retrieve({
      tenantId: args.tenantId,
      journeyId: args.journeyId,
      query: args.query,
      maxChunks: args.maxChunks ?? 5,
    })

    if (chunks.length === 0) {
      return `No specific information found for: "${args.query}". Answer from general knowledge or ask a clarifying question.`
    }

    // Join chunks with separator so Claude can see where each chunk ends
    return chunks
      .map((c, i) => `[Source ${i + 1}]\n${c.content}`)
      .join('\n\n---\n\n')
  } catch (err) {
    console.error('[kb-tools] searchKnowledgeBase error:', err)
    return 'Knowledge base search failed. Answer from general knowledge.'
  }
}

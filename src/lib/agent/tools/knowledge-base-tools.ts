// src/lib/agent/tools/knowledge-base-tools.ts
//
// Wires the RAG retrieve function into a tool the AI agent can call.
// This is the bridge between stored knowledge and Claude/Gemini.

import { retrieve } from '@/lib/agent/rag/retrieve'

export interface SearchKnowledgeBaseArgs {
  tenantId: string
  /** See RetrieveArgs — null means "no Brain", undefined means "all". */
  journeyId?: string | null
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
      // ── Why this message is worded so carefully ──────────────────
      //
      // It used to end "Answer from general knowledge or ask a
      // clarifying question." A patient asked Kalosa's agent to book
      // with Dr. Shilpi Bhadani; the search found nothing, the model
      // did as it was told, reasoned from the one doctor it had seen,
      // and replied "Sorry, we only book appointments with Dr. Ashish
      // Khare." It had just told a real patient that a real doctor
      // does not work there.
      //
      // A search miss is the model's own ignorance, not a fact about
      // the business. The knowledge base holds whatever pages we
      // managed to crawl — never the whole business — so "not in the
      // index" and "does not exist" are worlds apart. Inviting general
      // knowledge here is inviting it to fill that gap by guessing
      // about a company it cannot see.
      //
      // Denials are also uniquely expensive: a customer told the thing
      // they asked for does not exist has no reason to ask again. They
      // leave, and nobody ever learns the agent was wrong.
      return (
        `NOT FOUND: the knowledge base has nothing about "${args.query}".\n` +
        `This means YOU DO NOT KNOW. It does not mean the answer is no.\n` +
        `Do NOT tell the customer that a person, service, product, branch or ` +
        `price does not exist, and do NOT say you "only" have the options you ` +
        `happen to know about — you can see a fraction of this business.\n` +
        `Instead: say plainly you cannot confirm that one, and offer to have ` +
        `the team check. If they asked for a specific person or service by ` +
        `name, call handoff_to_human so a human can answer properly.`
      )
    }

    // Join chunks with separator so Claude can see where each chunk ends
    return chunks
      .map((c, i) => `[Source ${i + 1}]\n${c.content}`)
      .join('\n\n---\n\n')
  } catch (err) {
    console.error('[kb-tools] searchKnowledgeBase error:', err)
    // Same rule as a miss, and for a stronger reason: here we did not
    // even get to look. Answering "from general knowledge" about a
    // specific business whose records just failed to load is guessing
    // with the confidence of someone who thinks they checked.
    return (
      'SEARCH FAILED: the knowledge base could not be reached, so you ' +
      'learned nothing either way. Do not answer business-specific ' +
      'questions from general knowledge and do not deny anything exists. ' +
      'Tell the customer you cannot look that up right now and offer to ' +
      'have someone follow up.'
    )
  }
}

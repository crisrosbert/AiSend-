// src/lib/agent/engine.ts
//
// The single shared "brain loop" for the AI agent. This is the ONLY
// file flow-engine.ts is allowed to call inside /lib/agent/.
//
// Flow:
//   1. Load conversation history (last 10 messages)
//   2. Build system prompt (vertical config + persona override)
//   3. Call Gemini Flash with function-calling tools
//   4. If Gemini requests a tool → execute it → feed result back → loop
//   5. Return the final reply string (NEVER sends to WhatsApp itself)
//   6. Log usage to agent_usage_logs
//
// BOUNDARY: flow-engine.ts imports ONLY runAgent() from here.
//           This file imports tools + rag, never /lib/core/.

import { createClient } from '@supabase/supabase-js'
import { searchKnowledgeBase } from '@/lib/agent/tools/knowledge-base-tools'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null
function db() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _client
}

// ── Public interface (matches scaffold) ──

export interface RunAgentArgs {
  tenantId: string
  orgId: string | null
  verticalConfigId: string | null
  conversationId: string
  contactId: string
  customerPhone: string
  inboundText: string
  journeyId?: string
  systemPromptOverride?: string
}

export interface AgentResult {
  reply: string
  toolsUsed: string[]
  handoffRequested: boolean
  tokensUsed: number
}

// ── Tool definitions exposed to Gemini ──

const TOOLS = [
  {
    name: 'search_knowledge_base',
    description:
      "Search the business's knowledge base (FAQs, pricing, timings, policies, product info) to answer the customer's question accurately. Use this whenever the customer asks something specific about the business.",
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query based on the customer question',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'tag_contact',
    description:
      'Tag the customer in the CRM to track their intent or segment (e.g. "interested_in_pricing", "ready_to_buy", "needs_followup").',
    parameters: {
      type: 'object',
      properties: {
        tag: { type: 'string', description: 'The tag to apply' },
      },
      required: ['tag'],
    },
  },
  {
    name: 'handoff_to_human',
    description:
      'Transfer the conversation to a human agent. Use when the customer is frustrated, explicitly asks for a human, has a complaint, or has a complex request you cannot resolve.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why handing off' },
      },
      required: ['reason'],
    },
  },
]

// ── Main entry point ──

export async function runAgent(args: RunAgentArgs): Promise<AgentResult> {
  const apiKey = process.env.GEMINI_API_KEY
  const empty: AgentResult = {
    reply: '',
    toolsUsed: [],
    handoffRequested: false,
    tokensUsed: 0,
  }

  if (!apiKey) {
    console.warn('[agent/engine] GEMINI_API_KEY not set — agent disabled')
    return empty
  }

  const startedAt = Date.now()
  const toolsUsed: string[] = []
  let handoffRequested = false
  let totalTokens = 0

  try {
    const history = await getConversationHistory(args.conversationId)
    const systemPrompt = buildSystemPrompt(args.systemPromptOverride)

    // Build the running contents array (conversation so far)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents: any[] = [
      ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: args.inboundText }] },
    ]

    let finalReply = ''

    // Tool-call loop — max 4 iterations to prevent runaway
    for (let iter = 0; iter < 4; iter++) {
      const resp = await callGemini(apiKey, systemPrompt, contents)
      totalTokens += resp.tokens

      // Did Gemini ask to call a tool?
      const toolCall = resp.toolCall
      if (toolCall) {
        toolsUsed.push(toolCall.name)

        // Execute the requested tool
        const toolResult = await executeTool(toolCall, args)

        if (toolCall.name === 'handoff_to_human') {
          handoffRequested = true
          finalReply =
            toolResult ||
            'Let me connect you with a team member who can help further.'
          break
        }

        // Add the model's function_call + our function_response to history
        contents.push({
          role: 'model',
          parts: [{ functionCall: { name: toolCall.name, args: toolCall.args } }],
        })
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: toolCall.name,
                response: { result: toolResult },
              },
            },
          ],
        })
        // Loop again so Gemini can use the tool result to answer
        continue
      }

      // No tool call — this is the final text reply
      finalReply = resp.text
      break
    }

    if (!finalReply.trim()) {
      finalReply = "I'm not sure about that — let me get a team member to help you."
      handoffRequested = true
    }

    // Mark conversation pending if handoff requested
    if (handoffRequested) {
      await db()
        .from('conversations')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', args.conversationId)
    }

    // Log usage
    await logUsage(args, {
      toolsUsed,
      handoff: handoffRequested,
      tokens: totalTokens,
      latencyMs: Date.now() - startedAt,
    })

    return {
      reply: finalReply.trim(),
      toolsUsed,
      handoffRequested,
      tokensUsed: totalTokens,
    }
  } catch (err) {
    console.error('[agent/engine] error:', err)
    await logUsage(args, {
      toolsUsed,
      handoff: false,
      tokens: totalTokens,
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    })
    return empty
  }
}

// ── Gemini API call ──

interface GeminiResponse {
  text: string
  toolCall: { name: string; args: Record<string, unknown> } | null
  tokens: number
}

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contents: any[],
): Promise<GeminiResponse> {
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    tools: [{ function_declarations: TOOLS }],
    generation_config: { temperature: 0.3, max_output_tokens: 600 },
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const tokens = data?.usageMetadata?.totalTokenCount ?? 0

  // Look for a function call in the parts
  for (const part of parts) {
    if (part.functionCall?.name) {
      return {
        text: '',
        toolCall: {
          name: part.functionCall.name,
          args: part.functionCall.args ?? {},
        },
        tokens,
      }
    }
  }

  // Otherwise extract text
  const text = parts.map((p: { text?: string }) => p.text ?? '').join('')
  return { text, toolCall: null, tokens }
}

// ── Tool execution ──

async function executeTool(
  toolCall: { name: string; args: Record<string, unknown> },
  args: RunAgentArgs,
): Promise<string> {
  try {
    switch (toolCall.name) {
      case 'search_knowledge_base': {
        const query = String(toolCall.args.query || args.inboundText)
        return await searchKnowledgeBase({
          tenantId: args.tenantId,
          journeyId: args.journeyId,
          query,
        })
      }

      case 'tag_contact': {
        const tag = String(toolCall.args.tag || '').trim()
        if (!tag) return 'No tag provided'
        await applyTag(args.tenantId, args.contactId, tag)
        return `Tagged customer as "${tag}"`
      }

      case 'handoff_to_human': {
        const reason = String(toolCall.args.reason || 'Customer needs human help')
        return `Connecting you with a team member now. (${reason})`
      }

      default:
        return `Unknown tool: ${toolCall.name}`
    }
  } catch (err) {
    console.error('[agent/engine] tool error:', err)
    return 'Tool execution failed.'
  }
}

async function applyTag(
  tenantId: string,
  contactId: string,
  tagName: string,
): Promise<void> {
  let { data: tag } = await db()
    .from('tags')
    .select('id')
    .eq('user_id', tenantId)
    .ilike('name', tagName)
    .maybeSingle()

  if (!tag) {
    const { data: newTag } = await db()
      .from('tags')
      .insert({ user_id: tenantId, name: tagName })
      .select('id')
      .single()
    tag = newTag
  }

  if (tag) {
    await db()
      .from('contact_tags')
      .upsert(
        { contact_id: contactId, tag_id: tag.id },
        { onConflict: 'contact_id,tag_id' },
      )
  }
}

// ── Helpers ──

function buildSystemPrompt(override?: string): string {
  const base = `You are a helpful WhatsApp business assistant.

Rules:
- Keep replies short and conversational — this is WhatsApp, not email.
- Use plain text. No markdown, asterisks, or bullet symbols.
- Be warm, friendly, and professional.
- When the customer asks something specific about the business (pricing, timings, services, products, policies), ALWAYS call search_knowledge_base first — never guess.
- If you don't know the answer after searching, offer to connect a human.
- Tag the customer when you learn their intent.
- If the customer is frustrated or asks for a human, call handoff_to_human.
- Never invent prices, dates, or facts. Use tools to get real information.`

  return override ? `${override}\n\n${base}` : base
}

async function getConversationHistory(
  conversationId: string,
): Promise<Array<{ role: 'user' | 'model'; text: string }>> {
  const { data } = await db()
    .from('messages')
    .select('sender_type, content_text')
    .eq('conversation_id', conversationId)
    .in('sender_type', ['customer', 'bot'])
    .order('created_at', { ascending: true })
    .limit(10)

  if (!data) return []

  return data
    .filter((m: { content_text: string | null }) => m.content_text)
    .map((m: { sender_type: string; content_text: string }) => ({
      role: m.sender_type === 'customer' ? ('user' as const) : ('model' as const),
      text: m.content_text,
    }))
}

interface LogArgs {
  toolsUsed: string[]
  handoff: boolean
  tokens: number
  latencyMs: number
  error?: string
}

async function logUsage(args: RunAgentArgs, log: LogArgs): Promise<void> {
  try {
    await db().from('agent_usage_logs').insert({
      tenant_id: args.tenantId,
      conversation_id: args.conversationId,
      journey_id: args.journeyId ?? null,
      vertical: args.verticalConfigId ?? null,
      model: 'gemini-2.5-flash',
      output_tokens: log.tokens,
      tools_called: log.toolsUsed,
      handoff: log.handoff,
      latency_ms: log.latencyMs,
      error: log.error ?? null,
    })
  } catch (err) {
    console.error('[agent/engine] logUsage failed:', err)
  }
}

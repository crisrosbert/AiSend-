/**
 * File: src/lib/ai-agent/responder.ts
 * Purpose: LLM reply generation for AI Ecommerce Agent
 * Uses GPT-4o-mini with merchant's brand voice + retrieved products as context
 */

import type { ConversationMessage } from './memory'
import type { RetrievedProduct } from './retriever'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentResponderConfig {
  store_name: string
  brand_voice_prompt: string
  language: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REPLY_MODEL = 'gpt-4o-mini'
const REPLY_MAX_TOKENS = 300
const REPLY_TEMPERATURE = 0.7
const HISTORY_TURNS_FOR_REPLY = 6

// ─── System Prompt Builder ────────────────────────────────────────────────────

function buildSystemPrompt(config: AgentResponderConfig, products: RetrievedProduct[]): string {
  const productContext = products.length > 0
    ? products.map((p, i) => {
        const price = `${p.currency} ${p.price.toFixed(0)}`
        const stock = p.in_stock ? 'In Stock' : 'Out of Stock'
        return `${i + 1}. ${p.name} — ${price} — ${stock}${p.description ? `\n   ${p.description.slice(0, 150)}` : ''}`
      }).join('\n')
    : 'No matching products found.'

  return `You are a shopping assistant for ${config.store_name}.
Tone: ${config.brand_voice_prompt}
Language: Always reply in ${config.language}.
Rules: Keep replies short (2-3 sentences max). No markdown. Max 1-2 emojis. Only use product info below — never make up details.

PRODUCTS:
${productContext}`
}

// ─── Main Exports ─────────────────────────────────────────────────────────────

/**
 * generateAgentReply
 * Generates a contextual shopping reply using retrieved products + conversation history
 */
export async function generateAgentReply(
  config: AgentResponderConfig,
  customerMessage: string,
  conversationHistory: ConversationMessage[],
  products: RetrievedProduct[] = []
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: REPLY_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt(config, products) },
        ...conversationHistory.slice(-HISTORY_TURNS_FOR_REPLY).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: customerMessage },
      ],
      max_tokens: REPLY_MAX_TOKENS,
      temperature: REPLY_TEMPERATURE,
    }),
  })

  if (!response.ok) throw new Error(`[Responder] OpenAI error: ${response.status}`)

  const data = await response.json()
  return data.choices[0].message.content.trim()
}

/**
 * generateGreetingReply
 * Lightweight greeting — no product context needed
 */
export async function generateGreetingReply(
  config: AgentResponderConfig,
  isFirstMessage: boolean
): Promise<string> {
  const instruction = isFirstMessage
    ? `Welcome the customer to ${config.store_name} and ask what they're looking for. 2 sentences max.`
    : `Greet the returning customer warmly and ask how you can help. 1-2 sentences max.`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: REPLY_MODEL,
      messages: [
        {
          role: 'system',
          content: `Shopping assistant for ${config.store_name}. Tone: ${config.brand_voice_prompt}. Reply in ${config.language}.`,
        },
        { role: 'user', content: instruction },
      ],
      max_tokens: 80,
      temperature: REPLY_TEMPERATURE,
    }),
  })

  if (!response.ok) throw new Error(`[Responder] Greeting error: ${response.status}`)

  const data = await response.json()
  return data.choices[0].message.content.trim()
}

/**
 * File: src/lib/ai-agent/responder.ts
 * Purpose: LLM-powered reply generation for AI Ecommerce Agent
 *
 * Responsibilities:
 *   - Build a system prompt from merchant's brand_voice_prompt + language setting
 *   - Inject retrieved product context (RAG) into the prompt
 *   - Call GPT-4o-mini to generate a natural, on-brand customer reply
 *   - Keep replies concise and WhatsApp-friendly (no markdown, use emojis sparingly)
 *
 * This file only generates text. Sending the message to WhatsApp is handled by engine.ts.
 */

import { RetrievedProduct } from './retriever'

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single turn in the conversation history (used for multi-turn context) */
export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

/** Config loaded from ai_agent_configs table — passed in from engine.ts */
export interface AgentConfig {
  brand_voice_prompt: string  // Merchant-defined personality/tone instructions
  language: string            // e.g. "Hindi", "English", "Hinglish"
  store_name: string          // Used in system prompt greeting
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** LLM model for reply generation — GPT-4o-mini balances quality vs cost */
const REPLY_GENERATION_MODEL = 'gpt-4o-mini'

/** Max tokens for the reply — WhatsApp messages should be short */
const MAX_REPLY_TOKENS = 300

/** Temperature: slightly creative but still grounded */
const REPLY_TEMPERATURE = 0.7

/** How many past conversation turns to include for multi-turn context */
const CONVERSATION_HISTORY_TURNS_FOR_REPLY = 6

// ─── System Prompt Builder ────────────────────────────────────────────────────

/**
 * buildAgentSystemPrompt
 * Creates the system prompt that defines the agent's personality, language, and rules.
 * The merchant's brand_voice_prompt is injected here so each store has its own tone.
 *
 * @param config         - Agent config from ai_agent_configs table
 * @param retrievedProducts - Products found by retriever.ts (empty = no results)
 * @returns Fully formatted system prompt string
 */
function buildAgentSystemPrompt(
  config: AgentConfig,
  retrievedProducts: RetrievedProduct[]
): string {
  // Format product catalog context for the LLM
  const productContext =
    retrievedProducts.length > 0
      ? retrievedProducts
          .map((product, index) => {
            const stockStatus = product.in_stock ? '✅ In Stock' : '❌ Out of Stock'
            const priceFormatted = `${product.currency} ${product.price.toFixed(2)}`
            return [
              `Product ${index + 1}: ${product.name}`,
              `Price: ${priceFormatted}`,
              `Status: ${stockStatus}`,
              product.description ? `Description: ${product.description.substring(0, 200)}` : '',
              product.product_url ? `Link: ${product.product_url}` : '',
            ]
              .filter(Boolean)
              .join('\n')
          })
          .join('\n\n')
      : 'No matching products found in catalog.'

  return `You are a helpful shopping assistant for ${config.store_name}.

PERSONALITY & TONE:
${config.brand_voice_prompt}

LANGUAGE:
Always respond in ${config.language}. If the customer writes in a different language, still respond in ${config.language}.

RULES:
- Keep replies short and conversational (max 3–4 sentences)
- Do NOT use markdown (no **bold**, no bullet points with -)
- You can use emojis sparingly (1–2 per message max)
- Always be helpful, warm, and focused on the customer's shopping need
- If a product is out of stock, say so politely and suggest alternatives from the list
- Never make up product details — only use information from the PRODUCTS section below
- If the customer wants to add to cart, confirm what you're adding
- If the customer asks something unrelated to shopping, politely redirect to shopping

AVAILABLE PRODUCTS FOR THIS QUERY:
${productContext}

Remember: You are a shopping assistant. Stay helpful, brief, and on-topic.`
}

// ─── Reply Generator ──────────────────────────────────────────────────────────

/**
 * generateAgentReply
 * Main entry point for LLM reply generation.
 * Called by engine.ts after retrieving relevant products.
 *
 * @param config              - Merchant's agent config (brand voice, language, store name)
 * @param customerMessage     - Current message from the customer
 * @param conversationHistory - Recent conversation turns for multi-turn context
 * @param retrievedProducts   - Products found by retriever.ts (pass [] if not a shopping query)
 * @returns Generated reply text to send to the customer via WhatsApp
 */
export async function generateAgentReply(
  config: AgentConfig,
  customerMessage: string,
  conversationHistory: ConversationTurn[],
  retrievedProducts: RetrievedProduct[] = []
): Promise<string> {
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    throw new Error('[AI Agent Responder] OPENAI_API_KEY environment variable is not set')
  }

  // Build the system prompt with brand voice + product context
  const systemPrompt = buildAgentSystemPrompt(config, retrievedProducts)

  // Use last N turns of conversation history for multi-turn context
  const recentHistory = conversationHistory.slice(-CONVERSATION_HISTORY_TURNS_FOR_REPLY)

  // Build the messages array for the Chat Completions API
  const chatMessages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...recentHistory.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: 'user', content: customerMessage },
  ]

  console.log(
    `[AI Agent Responder] Generating reply with ${retrievedProducts.length} products in context`
  )

  const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: REPLY_GENERATION_MODEL,
      messages: chatMessages,
      max_tokens: MAX_REPLY_TOKENS,
      temperature: REPLY_TEMPERATURE,
    }),
  })

  if (!completionResponse.ok) {
    const errorBody = await completionResponse.text()
    throw new Error(
      `[AI Agent Responder] OpenAI Chat API error ${completionResponse.status}: ${errorBody}`
    )
  }

  const completionData = await completionResponse.json()
  const generatedReplyText: string = completionData.choices[0].message.content.trim()

  console.log(
    `[AI Agent Responder] Generated reply (${generatedReplyText.length} chars): "${generatedReplyText.substring(0, 100)}..."`
  )

  return generatedReplyText
}

// ─── Greeting Generator ───────────────────────────────────────────────────────

/**
 * generateGreetingReply
 * Specialized reply for first-time or returning customer greetings.
 * Simpler than a full shopping query — no product retrieval needed.
 *
 * @param config         - Agent config (brand voice, language, store name)
 * @param isFirstMessage - True if this is the customer's very first message
 * @returns Greeting message text
 */
export async function generateGreetingReply(
  config: AgentConfig,
  isFirstMessage: boolean
): Promise<string> {
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    throw new Error('[AI Agent Responder] OPENAI_API_KEY environment variable is not set')
  }

  const greetingInstruction = isFirstMessage
    ? `Welcome the customer to ${config.store_name} for the first time. Introduce yourself briefly and ask what they're looking for. Keep it to 2 sentences.`
    : `Greet the returning customer warmly at ${config.store_name}. Ask how you can help them today. Keep it to 1–2 sentences.`

  const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: REPLY_GENERATION_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a shopping assistant for ${config.store_name}. Personality: ${config.brand_voice_prompt}. Always respond in ${config.language}.`,
        },
        {
          role: 'user',
          content: greetingInstruction,
        },
      ],
      max_tokens: 100,
      temperature: REPLY_TEMPERATURE,
    }),
  })

  if (!completionResponse.ok) {
    const errorBody = await completionResponse.text()
    throw new Error(
      `[AI Agent Responder] OpenAI Greeting API error ${completionResponse.status}: ${errorBody}`
    )
  }

  const completionData = await completionResponse.json()
  return completionData.choices[0].message.content.trim()
}

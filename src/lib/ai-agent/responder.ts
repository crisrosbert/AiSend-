/**
 * ============================================================================
 * File: src/lib/ai-agent/responder.ts
 * Purpose: LLM reply generation for AI Ecommerce Agent
 * ============================================================================
 *
 * Generates natural language replies for the WhatsApp shopping assistant.
 * Uses GPT-4o-mini with merchant's brand voice + retrieved products as context.
 *
 * Two types of replies:
 *   1. generateAgentReply   → Full shopping reply with product context
 *   2. generateGreetingReply → Lightweight welcome message (no products needed)
 *
 * Design decisions:
 *   - Temperature 0.7 = slightly creative but still accurate
 *   - Max 300 tokens = keeps replies short for WhatsApp (2-3 sentences)
 *   - Only last 6 turns of history for reply context (cost vs quality sweet spot)
 *   - No markdown in output (WhatsApp has its own formatting: *bold* _italic_)
 *   - Max 1-2 emojis to keep it natural, not spammy
 *   - Never makes up product details — only uses what's in the context
 * ============================================================================
 */

import type { ConversationMessage } from './memory'
import type { RetrievedProduct } from './retriever'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Merchant's agent configuration (from ai_agent_configs table) */
export interface AgentResponderConfig {
  store_name: string         // e.g. "Organic Wellness Store"
  brand_voice_prompt: string // e.g. "Friendly, helpful, use Hindi occasionally"
  language: string           // e.g. "English" or "Hindi" or "Hinglish"
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REPLY_MODEL = 'gpt-4o-mini'          // Fast + cheap for conversational replies
const REPLY_MAX_TOKENS = 300               // Short replies for WhatsApp
const REPLY_TEMPERATURE = 0.7              // Slightly creative but accurate
const HISTORY_TURNS_FOR_REPLY = 6          // More context than intent (needs conversation flow)

// ─── System Prompt Builder ───────────────────────────────────────────────────

/**
 * Build the system prompt for the shopping assistant.
 *
 * Structure:
 *   1. Role definition (store name + brand voice)
 *   2. Language instruction
 *   3. Rules (keep short, no markdown, only use provided products)
 *   4. Product context (retrieved from vector search)
 *
 * The product context is crucial — it prevents hallucination.
 * The model can ONLY recommend products listed here.
 *
 * @param config   - Merchant's agent configuration
 * @param products - Products retrieved from vector search (may be empty)
 * @returns Complete system prompt string
 */
function buildSystemPrompt(config: AgentResponderConfig, products: RetrievedProduct[]): string {
  // Format product list for the LLM
  const productContext = products.length > 0
    ? products.map((p, i) => {
        const price = `${p.currency} ${p.price.toFixed(0)}`
        const stock = p.in_stock ? 'In Stock' : 'Out of Stock'
        const desc = p.description ? p.description.slice(0, 150) : ''
        return `${i + 1}. ${p.name} — ${price} — ${stock}${desc ? `\n   ${desc}` : ''}`
      }).join('\n')
    : 'No matching products found in catalog.'

  return `You are a WhatsApp shopping assistant for "${config.store_name}".

BRAND VOICE: ${config.brand_voice_prompt}
LANGUAGE: Always reply in ${config.language}.

RULES:
- Keep replies to 2-3 sentences max (WhatsApp messages should be concise)
- No markdown formatting (use WhatsApp formatting: *bold* for emphasis)
- Use max 1-2 emojis per reply (natural, not spammy)
- ONLY recommend products from the list below — never make up product names, prices, or details
- If no products match, apologize and ask what else they're looking for
- If a product is out of stock, mention it honestly
- Guide customers to add products to cart: suggest "Reply 'add [product name]' to add to cart"

AVAILABLE PRODUCTS:
${productContext}`
}

// ─── Main Exports ────────────────────────────────────────────────────────────

/**
 * generateAgentReply
 * Generates a contextual shopping reply using retrieved products + conversation history.
 *
 * Called when:
 *   - Customer asks about products (SHOPPING_QUERY intent)
 *   - Customer says something out of scope (OUT_OF_SCOPE intent — gentle redirect)
 *   - Any intent that needs a conversational response
 *
 * @param config              - Merchant's agent config (store name, voice, language)
 * @param customerMessage     - The customer's latest message
 * @param conversationHistory - Recent conversation for context
 * @param products            - Retrieved products from vector search (can be empty)
 * @returns Generated reply text (ready to send via WhatsApp)
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
        // Include recent conversation for continuity
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

  if (!response.ok) {
    const status = response.status
    console.error(`[Responder] OpenAI error: ${status}`)
    // Graceful fallback — don't crash the agent
    if (products.length > 0) {
      return `I found some products for you! Check out the product cards above. Let me know if you'd like to add anything to your cart.`
    }
    return `I'm having trouble right now. Please try again in a moment, or type "help" to connect with our team.`
  }

  const data = await response.json()
  return data.choices[0].message.content.trim()
}

/**
 * generateGreetingReply
 * Lightweight greeting — no product context needed (saves tokens + time).
 *
 * Two variations:
 *   - First message ever: Full welcome with store intro
 *   - Returning customer: Warm but brief "welcome back"
 *
 * @param config         - Merchant's agent config
 * @param isFirstMessage - true if this is the customer's first ever message
 * @returns Greeting text (ready to send via WhatsApp)
 */
export async function generateGreetingReply(
  config: AgentResponderConfig,
  isFirstMessage: boolean
): Promise<string> {
  const instruction = isFirstMessage
    ? `Welcome the customer to ${config.store_name} and ask what they're looking for. Mention you can show products, help with orders, etc. 2 sentences max.`
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
          content: `Shopping assistant for "${config.store_name}". Tone: ${config.brand_voice_prompt}. Reply in ${config.language}. No markdown. Max 1-2 emojis.`,
        },
        { role: 'user', content: instruction },
      ],
      max_tokens: 100,  // Greetings are always short
      temperature: REPLY_TEMPERATURE,
    }),
  })

  if (!response.ok) {
    // Hardcoded fallback greeting (never fail on a simple hello)
    return isFirstMessage
      ? `Welcome to ${config.store_name}! 👋 How can I help you today? You can ask me about our products or browse our catalog.`
      : `Hey, welcome back! 👋 What can I help you with today?`
  }

  const data = await response.json()
  return data.choices[0].message.content.trim()
}

/**
 * File: src/lib/ai-agent/intent.ts
 * Purpose: Customer intent detection for AI Ecommerce Agent
 * Uses GPT-4o-mini to classify what the customer wants (shopping, cart, checkout, etc.)
 */

import type { ConversationMessage } from './memory'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CustomerIntent =
  | 'SHOPPING_QUERY'  // Customer wants to find/buy a product
  | 'CART_ADD'        // Customer wants to add something to cart
  | 'CART_VIEW'       // Customer wants to see their cart
  | 'CHECKOUT'        // Customer wants to place order
  | 'GREETING'        // Hello / hi / namaste
  | 'HUMAN_NEEDED'    // Complaint / complex issue needing human
  | 'OUT_OF_SCOPE'    // Unrelated to shopping

export interface IntentResult {
  intent: CustomerIntent
  productKeywords: string   // Extracted product search terms (for SHOPPING_QUERY / CART_ADD)
  quantity: number          // Extracted quantity (for CART_ADD), default 1
  confidence: number        // 0.0 – 1.0
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INTENT_MODEL = 'gpt-4o-mini'
const INTENT_MAX_TOKENS = 100
const HISTORY_TURNS_FOR_INTENT = 4  // Only last 4 turns for cost efficiency

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fallbackIntent(): IntentResult {
  return { intent: 'SHOPPING_QUERY', productKeywords: '', quantity: 1, confidence: 0.5 }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * detectIntent
 * Classifies the customer's message into one of the CustomerIntent types.
 * Returns fallback (SHOPPING_QUERY) on any API failure so agent never crashes.
 */
export async function detectIntent(
  customerMessage: string,
  conversationHistory: ConversationMessage[]
): Promise<IntentResult> {
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) return fallbackIntent()

  const recentHistory = conversationHistory
    .slice(-HISTORY_TURNS_FOR_INTENT)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n')

  const systemPrompt = `You are an intent classifier for a WhatsApp shopping assistant.
Classify the customer's latest message into exactly one intent.
Return JSON: { "intent": string, "productKeywords": string, "quantity": number, "confidence": number }

Intents: SHOPPING_QUERY | CART_ADD | CART_VIEW | CHECKOUT | GREETING | HUMAN_NEEDED | OUT_OF_SCOPE
- productKeywords: key product search terms (empty string if not applicable)
- quantity: number of items (default 1)
- confidence: 0.0 to 1.0`

  const userPrompt = recentHistory
    ? `Recent conversation:\n${recentHistory}\n\nLatest message: "${customerMessage}"`
    : `Message: "${customerMessage}"`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: INTENT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: INTENT_MAX_TOKENS,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) return fallbackIntent()

    const data = await response.json()
    const parsed = JSON.parse(data.choices[0].message.content)

    return {
      intent: parsed.intent ?? 'SHOPPING_QUERY',
      productKeywords: parsed.productKeywords ?? '',
      quantity: parsed.quantity ?? 1,
      confidence: parsed.confidence ?? 0.5,
    }
  } catch {
    return fallbackIntent()
  }
}

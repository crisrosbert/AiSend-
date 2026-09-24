/**
 * ============================================================================
 * File: src/lib/ai-agent/intent.ts
 * Purpose: Customer intent detection for AI Ecommerce Agent
 * ============================================================================
 *
 * Uses GPT-4o-mini to classify what the customer wants from their WhatsApp message.
 * This is the FIRST step in every message processing — determines which handler runs.
 *
 * Intent types:
 *   SHOPPING_QUERY  → Customer wants to find/browse products
 *   CART_ADD        → Customer wants to add a product to cart
 *   CART_REMOVE     → Customer wants to remove a product from cart
 *   CART_VIEW       → Customer wants to see their cart contents
 *   CHECKOUT        → Customer wants to place an order / pay
 *   GREETING        → Hello / hi / namaste / etc.
 *   HUMAN_NEEDED    → Complaint / complex issue needing human agent
 *   OUT_OF_SCOPE    → Not related to shopping at all
 *
 * Design decisions:
 *   - Uses GPT-4o-mini for speed + low cost (~$0.0001 per classification)
 *   - Only sends last 4 turns of conversation (enough for context, saves tokens)
 *   - Returns fallback SHOPPING_QUERY on any API failure (agent never crashes)
 *   - JSON mode ensures structured response (no parsing errors)
 *   - Temperature 0 = deterministic classification (same input → same output)
 * ============================================================================
 */

import type { ConversationMessage } from './memory'

// ─── Types ────────────────────────────────────────────────────────────────────

/** All possible customer intents the AI agent can detect */
export type CustomerIntent =
  | 'SHOPPING_QUERY'  // "show me green tea" / "do you have shampoo?"
  | 'CART_ADD'        // "add this to cart" / "I want 2 of these"
  | 'CART_REMOVE'     // "remove tea from cart" / "delete the last item"
  | 'CART_VIEW'       // "show my cart" / "what's in my cart?"
  | 'CHECKOUT'        // "checkout" / "I want to pay" / "place order"
  | 'GREETING'        // "hello" / "hi" / "namaste"
  | 'HUMAN_NEEDED'    // "I need help" / "speak to a person" / complaint
  | 'OUT_OF_SCOPE'    // "what's the weather?" / unrelated chatter

/** Result from intent detection */
export interface IntentResult {
  intent: CustomerIntent
  productKeywords: string   // Extracted product search terms (for SHOPPING_QUERY / CART_ADD / CART_REMOVE)
  quantity: number          // Extracted quantity (for CART_ADD), default 1
  confidence: number        // 0.0 – 1.0 (how confident the model is)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INTENT_MODEL = 'gpt-4o-mini'        // Fast + cheap for classification
const INTENT_MAX_TOKENS = 120              // Intent JSON is always small
const HISTORY_TURNS_FOR_INTENT = 4         // Only last 4 turns for cost efficiency

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fallback intent returned on any API failure.
 * We default to SHOPPING_QUERY because:
 *   1. It's the most common intent
 *   2. It's safe — worst case, we show products the customer didn't ask for
 *   3. It never crashes the agent
 */
function fallbackIntent(): IntentResult {
  return { intent: 'SHOPPING_QUERY', productKeywords: '', quantity: 1, confidence: 0.5 }
}

// ─── System Prompt ───────────────────────────────────────────────────────────

const INTENT_SYSTEM_PROMPT = `You are an intent classifier for a WhatsApp shopping assistant.
Classify the customer's latest message into exactly one intent.
Return JSON: { "intent": string, "productKeywords": string, "quantity": number, "confidence": number }

Intents:
- SHOPPING_QUERY: customer wants to find, browse, or ask about products
- CART_ADD: customer wants to add a specific product to their cart (look for "add", "want", "buy")
- CART_REMOVE: customer wants to remove a product from cart (look for "remove", "delete", "cancel")
- CART_VIEW: customer wants to see what's in their cart
- CHECKOUT: customer wants to place order, pay, or proceed to checkout (look for "checkout", "pay", "order", "buy now", "cod", "cash")
- GREETING: simple hello/hi/hey/namaste
- HUMAN_NEEDED: customer is frustrated, wants to talk to a person, or has a complaint
- OUT_OF_SCOPE: message has nothing to do with shopping

Rules:
- productKeywords: extract the product search terms (empty string if not applicable)
- quantity: number of items customer wants (default 1)
- confidence: 0.0 to 1.0
- When in doubt between SHOPPING_QUERY and CART_ADD, prefer SHOPPING_QUERY
- Interactive button replies like "Pay Online" or "Cash on Delivery" → CHECKOUT`

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * detectIntent
 * Classifies the customer's WhatsApp message into a CustomerIntent.
 *
 * How it works:
 *   1. Takes customer's message + recent conversation history
 *   2. Sends to GPT-4o-mini with classification prompt
 *   3. Parses JSON response into IntentResult
 *   4. Returns fallback on any failure (never throws)
 *
 * @param customerMessage      - The customer's latest WhatsApp message
 * @param conversationHistory  - Recent conversation messages (for context)
 * @returns IntentResult with classified intent, keywords, quantity, confidence
 */
export async function detectIntent(
  customerMessage: string,
  conversationHistory: ConversationMessage[]
): Promise<IntentResult> {
  // ── Check for API key ──
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    console.error('[Intent] OPENAI_API_KEY not set — using fallback')
    return fallbackIntent()
  }

  // ── Build context from recent conversation history ──
  // Only last 4 turns to save tokens (~80% cost reduction vs full history)
  const recentHistory = conversationHistory
    .slice(-HISTORY_TURNS_FOR_INTENT)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n')

  const userPrompt = recentHistory
    ? `Recent conversation:\n${recentHistory}\n\nLatest message: "${customerMessage}"`
    : `Message: "${customerMessage}"`

  // ── Call OpenAI API ──
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
          { role: 'system', content: INTENT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: INTENT_MAX_TOKENS,
        temperature: 0,  // Deterministic — same input always gives same output
        response_format: { type: 'json_object' },  // Guaranteed valid JSON
      }),
    })

    if (!response.ok) {
      console.error(`[Intent] OpenAI API error: ${response.status}`)
      return fallbackIntent()
    }

    // ── Parse response ──
    const data = await response.json()
    const parsed = JSON.parse(data.choices[0].message.content)

    return {
      intent: parsed.intent ?? 'SHOPPING_QUERY',
      productKeywords: parsed.productKeywords ?? '',
      quantity: parsed.quantity ?? 1,
      confidence: parsed.confidence ?? 0.5,
    }
  } catch (err) {
    console.error('[Intent] Detection failed:', err)
    return fallbackIntent()
  }
}

// ============================================================
// File: src/lib/ai-agent/intent.ts
// Purpose: Lightweight intent classification using GPT-4o-mini.
//
// Runs BEFORE the expensive RAG retrieval step so we only
// do vector search when the customer is actually shopping.
// Uses JSON response format so the output is always parseable.
//
// Intent taxonomy:
//   SHOPPING_QUERY  — customer wants to find/see products
//   CART_ADD        — customer wants to add something to cart
//   CART_VIEW       — customer wants to see their cart
//   CHECKOUT        — customer wants to pay / place order
//   GREETING        — hello, hi, hey etc.
//   HUMAN_NEEDED    — complaint, refund, complex issue
//   OUT_OF_SCOPE    — unrelated to shopping
// ============================================================

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type CustomerIntent =
  | 'SHOPPING_QUERY'
  | 'CART_ADD'
  | 'CART_VIEW'
  | 'CHECKOUT'
  | 'GREETING'
  | 'HUMAN_NEEDED'
  | 'OUT_OF_SCOPE'

export interface IntentResult {
  intent: CustomerIntent
  /** Extracted product keywords — used to seed the RAG retrieval query */
  productKeywords: string | null
  /** Extracted quantity if customer said "add 2 shoes" */
  quantity: number | null
  /** Confidence level from the LLM (low | medium | high) */
  confidence: 'low' | 'medium' | 'high'
}

/** Shape of a single message in the conversation history */
interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// ─────────────────────────────────────────────────────────────
// System prompt for intent classification
// ─────────────────────────────────────────────────────────────

const INTENT_CLASSIFICATION_SYSTEM_PROMPT = `
You are an intent classifier for a WhatsApp ecommerce shopping assistant.

Classify the customer's latest message into exactly one intent:
- SHOPPING_QUERY   : customer is searching for products, asking about price, availability, categories
- CART_ADD         : customer explicitly wants to add a specific item to their cart
- CART_VIEW        : customer wants to see what is in their cart or the cart total
- CHECKOUT         : customer wants to pay, place order, checkout, get payment link
- GREETING         : hello, hi, good morning, how are you — no shopping intent
- HUMAN_NEEDED     : complaint, refund request, order issue, wants to speak to a person
- OUT_OF_SCOPE     : completely unrelated to shopping (weather, news, jokes, etc.)

You must always respond with valid JSON in exactly this format:
{
  "intent": "<one of the 7 intents above>",
  "productKeywords": "<extracted search terms or null>",
  "quantity": <number or null>,
  "confidence": "<low|medium|high>"
}

Examples:
Message: "do you have red sneakers under 2000?"
Response: {"intent":"SHOPPING_QUERY","productKeywords":"red sneakers","quantity":null,"confidence":"high"}

Message: "add 2 of those to my cart"
Response: {"intent":"CART_ADD","productKeywords":null,"quantity":2,"confidence":"high"}

Message: "what's in my cart"
Response: {"intent":"CART_VIEW","productKeywords":null,"quantity":null,"confidence":"high"}

Message: "I want to pay now"
Response: {"intent":"CHECKOUT","productKeywords":null,"quantity":null,"confidence":"high"}

Message: "hi"
Response: {"intent":"GREETING","productKeywords":null,"quantity":null,"confidence":"high"}
`.trim()

// ─────────────────────────────────────────────────────────────
// Intent Detection Function
// ─────────────────────────────────────────────────────────────

/**
 * detectIntent
 *
 * Sends the customer's message + last 4 conversation turns to
 * GPT-4o-mini for intent classification. Returns a structured
 * IntentResult that the engine uses to decide which handler to run.
 *
 * Uses only the last 4 messages as context to keep token cost low.
 * Full history is used only in the responder for reply generation.
 */
export async function detectIntent(
  customerMessage: string,
  conversationHistory: ConversationMessage[],
): Promise<IntentResult> {
  // Include only the last 4 turns for classification context
  const recentHistory = conversationHistory
    .slice(-4)
    .map((msg) => ({
      role:    msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

  const messages = [
    ...recentHistory,
    { role: 'user' as const, content: customerMessage },
  ]

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:           'gpt-4o-mini',
        messages: [
          { role: 'system', content: INTENT_CLASSIFICATION_SYSTEM_PROMPT },
          ...messages,
        ],
        // Force JSON output — eliminates parsing failures
        response_format: { type: 'json_object' },
        temperature:     0,      // Deterministic — intent classification needs consistency
        max_tokens:      100,    // Intent JSON is always tiny
      }),
    })

    if (!response.ok) {
      console.error('[ai-agent/intent] OpenAI API error:', response.status)
      return fallbackIntent()
    }

    const data = await response.json()
    const rawContent = data.choices?.[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(rawContent) as Partial<IntentResult>

    return {
      intent:          parsed.intent          ?? 'OUT_OF_SCOPE',
      productKeywords: parsed.productKeywords ?? null,
      quantity:        parsed.quantity        ?? null,
      confidence:      parsed.confidence      ?? 'low',
    }

  } catch (error) {
    console.error('[ai-agent/intent] classification failed:', error)
    // On any failure — treat as shopping query so we at least try to help
    return fallbackIntent()
  }
}

/**
 * Returns a safe default intent when classification fails.
 * Defaults to SHOPPING_QUERY rather than failing silently,
 * so the customer gets a response even when OpenAI is down.
 */
function fallbackIntent(): IntentResult {
  return {
    intent:          'SHOPPING_QUERY',
    productKeywords: null,
    quantity:        null,
    confidence:      'low',
  }
}

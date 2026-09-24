/**
 * File: src/lib/ai-agent/product-response.ts
 * Purpose: Send product image cards to customer via WhatsApp
 * Called by engine.ts after text reply is sent for SHOPPING_QUERY intent
 */

import type { RetrievedProduct } from './retriever'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WhatsAppCredentials {
  phoneNumberId: string
  accessToken: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WA_API_URL = 'https://graph.facebook.com/v21.0'
const MAX_CARDS = 3  // Max product cards per query (avoid spamming)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCaption(product: RetrievedProduct, index: number): string {
  const sym = product.currency === 'INR' ? '₹' : product.currency
  const stock = product.in_stock ? '✅ In Stock' : '❌ Out of Stock'
  return [
    `*${index}. ${product.name}*`,
    `💰 ${sym}${product.price.toFixed(0)}`,
    stock,
    product.in_stock ? `👉 Reply "add ${product.name.split(' ')[0]}" to add to cart` : '',
  ].filter(Boolean).join('\n')
}

async function sendImageCard(
  phone: string,
  imageUrl: string,
  caption: string,
  creds: WhatsAppCredentials
): Promise<void> {
  const res = await fetch(`${WA_API_URL}/${creds.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'image',
      image: { link: imageUrl, caption },
    }),
  })
  if (!res.ok) throw new Error(`[ProductResponse] Image send failed: ${res.status}`)
}

async function sendTextMessage(
  phone: string,
  text: string,
  creds: WhatsAppCredentials
): Promise<void> {
  const res = await fetch(`${WA_API_URL}/${creds.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: text },
    }),
  })
  if (!res.ok) throw new Error(`[ProductResponse] Text send failed: ${res.status}`)
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * sendProductCardsToCustomer
 * Sends product image cards (or text list if no images) to customer via WhatsApp.
 * Individual failures are logged but don't stop other cards from sending.
 */
export async function sendProductCardsToCustomer(
  recipientPhone: string,
  products: RetrievedProduct[],
  creds: WhatsAppCredentials
): Promise<void> {
  if (products.length === 0) return

  const toShow = products.slice(0, MAX_CARDS)
  const withImages = toShow.filter((p) => p.image_url)
  const withoutImages = toShow.filter((p) => !p.image_url)

  // Send image cards
  for (let i = 0; i < withImages.length; i++) {
    const product = withImages[i]
    try {
      await sendImageCard(recipientPhone, product.image_url!, buildCaption(product, i + 1), creds)
    } catch (err) {
      console.error(`[ProductResponse] Failed card for "${product.name}":`, err)
    }
  }

  // Text fallback for products without images
  if (withoutImages.length > 0) {
    const sym = withoutImages[0].currency === 'INR' ? '₹' : withoutImages[0].currency
    const lines = withoutImages.map((p, i) =>
      `${withImages.length + i + 1}. ${p.in_stock ? '✅' : '❌'} *${p.name}* — ${sym}${p.price.toFixed(0)}`
    )
    try {
      await sendTextMessage(recipientPhone, lines.join('\n'), creds)
    } catch (err) {
      console.error('[ProductResponse] Text fallback failed:', err)
    }
  }
}

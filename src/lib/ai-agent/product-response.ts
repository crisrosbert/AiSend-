/**
 * ============================================================================
 * File: src/lib/ai-agent/product-response.ts
 * Purpose: Send product cards via WhatsApp — CTA URL buttons + multi-image carousel
 * ============================================================================
 *
 * Card styles supported:
 *
 * 1. INTERACTIVE CTA URL CARD (primary — professional style):
 *    ┌─────────────────────┐
 *    │   [Product Image]   │
 *    │                     │
 *    │ Name — description  │
 *    │ ₹Price              │
 *    │                     │
 *    │  🔗 View Product    │  ← Clickable button opens product page
 *    └─────────────────────┘
 *
 * 2. MULTI-IMAGE CAROUSEL (when product has multiple images):
 *    Sends 1st card as CTA URL (with product info)
 *    Then sends remaining images as plain image messages (gallery feel)
 *    Max 4 images per product to avoid spam
 *
 * 3. INTERACTIVE BUTTONS (for checkout payment choice):
 *    ┌─────────────────────┐
 *    │  Choose payment:    │
 *    │                     │
 *    │  [Pay Online]       │
 *    │  [Cash on Delivery] │
 *    └─────────────────────┘
 *
 * 4. PAYMENT LINK CTA (for checkout):
 *    ┌─────────────────────┐
 *    │  Order #abc ready!  │
 *    │  Total: ₹650        │
 *    │                     │
 *    │  🔗 Pay ₹650        │  ← Opens Razorpay payment page
 *    └─────────────────────┘
 *
 * Fallback: If interactive messages fail (older API version),
 *           falls back to plain image + caption messages.
 * ============================================================================
 */

import type { RetrievedProduct } from './retriever'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WhatsAppCredentials {
  phoneNumberId: string
  accessToken: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WA_API_URL = 'https://graph.facebook.com/v21.0'
const MAX_PRODUCTS = 3          // Max different products to show per query
const MAX_IMAGES_PER_PRODUCT = 4 // Max images per product (carousel cards)

// ─── WhatsApp API Helper ─────────────────────────────────────────────────────

/**
 * Generic WhatsApp message sender.
 * All message types go through this to centralize error handling and logging.
 *
 * @param phone   - Recipient WhatsApp number
 * @param payload - Full WhatsApp API message payload (without messaging_product and to)
 * @param creds   - WhatsApp Business API credentials
 * @returns true if sent successfully, false if failed
 */
async function sendWhatsAppMessage(
  phone: string,
  payload: Record<string, unknown>,
  creds: WhatsAppCredentials
): Promise<boolean> {
  try {
    const res = await fetch(`${WA_API_URL}/${creds.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        ...payload,
      }),
    })

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '')
      console.error(`[ProductResponse] WA API ${res.status}:`, errorBody)
      return false
    }
    return true
  } catch (err) {
    console.error('[ProductResponse] Send error:', err)
    return false
  }
}

// ─── Caption Builders ────────────────────────────────────────────────────────

/**
 * Build clean product caption for CTA card.
 * Style: "Product Name — short description. ₹Price."
 * Matches the professional WhatsApp commerce style (like reference screenshots).
 */
function buildProductCaption(product: RetrievedProduct): string {
  const sym = product.currency === 'INR' ? '₹' : product.currency
  const desc = product.description
    ? product.description.replace(/\s+/g, ' ').trim().slice(0, 200)
    : ''

  const parts: string[] = []
  parts.push(`*${product.name}*`)
  if (desc) parts.push(desc)
  parts.push(`${sym}${product.price.toFixed(0)}.`)

  // Only show stock status if out of stock (in-stock is implied)
  if (!product.in_stock) parts.push('Currently out of stock.')

  return parts.join(' — ')
}

/**
 * Build CTA button display text.
 * WhatsApp limits button text to 20 characters.
 * Format: "View [first 2-3 words of product name]"
 */
function ctaButtonText(productName: string): string {
  const words = productName.split(/[\s—]+/)
  let text = `View ${words.slice(0, 2).join(' ')}`
  if (text.length > 20) text = text.slice(0, 17) + '...'
  return text
}

// ─── Product Card Senders ────────────────────────────────────────────────────

/**
 * Send a single interactive CTA URL product card.
 * This is the primary card format — image + caption + "View Product" button.
 *
 * WhatsApp interactive message format:
 * {
 *   type: "interactive",
 *   interactive: {
 *     type: "cta_url",
 *     header: { type: "image", image: { link: "..." } },
 *     body: { text: "Product name — description. ₹Price." },
 *     action: { name: "cta_url", parameters: { display_text: "View Product", url: "..." } }
 *   }
 * }
 */
async function sendProductCTACard(
  phone: string,
  product: RetrievedProduct,
  imageUrl: string | null,
  creds: WhatsAppCredentials
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const interactive: Record<string, any> = {
    type: 'cta_url',
    body: { text: buildProductCaption(product) },
    action: {
      name: 'cta_url',
      parameters: {
        display_text: ctaButtonText(product.name),
        url: product.product_url || '#',
      },
    },
  }

  // Add image header if available
  if (imageUrl) {
    interactive.header = {
      type: 'image',
      image: { link: imageUrl },
    }
  }

  const success = await sendWhatsAppMessage(phone, {
    type: 'interactive',
    interactive,
  }, creds)

  // If interactive fails (API version doesn't support it), try fallback
  if (!success) {
    return sendFallbackImageCard(phone, product, imageUrl, creds)
  }
  return true
}

/**
 * Send additional product images (for carousel effect).
 * These are plain image messages without CTA button — just the image.
 * Sent after the main CTA card to create a gallery/carousel feel.
 */
async function sendAdditionalImage(
  phone: string,
  imageUrl: string,
  creds: WhatsAppCredentials
): Promise<boolean> {
  return sendWhatsAppMessage(phone, {
    type: 'image',
    image: { link: imageUrl },
  }, creds)
}

/**
 * Fallback: plain image + caption (for older WhatsApp Business API versions
 * that don't support interactive CTA URL messages).
 */
async function sendFallbackImageCard(
  phone: string,
  product: RetrievedProduct,
  imageUrl: string | null,
  creds: WhatsAppCredentials
): Promise<boolean> {
  const sym = product.currency === 'INR' ? '₹' : product.currency
  const stock = product.in_stock ? '✅ In Stock' : '❌ Out of Stock'
  const caption = [
    `*${product.name}*`,
    `💰 ${sym}${product.price.toFixed(0)}`,
    stock,
    product.product_url ? `🔗 ${product.product_url}` : '',
  ].filter(Boolean).join('\n')

  if (imageUrl) {
    return sendWhatsAppMessage(phone, {
      type: 'image',
      image: { link: imageUrl, caption },
    }, creds)
  }
  // No image at all — send as text
  return sendWhatsAppMessage(phone, {
    type: 'text',
    text: { body: caption },
  }, creds)
}

// ─── Main Product Card Export ────────────────────────────────────────────────

/**
 * sendProductCardsToCustomer
 * Main entry point — sends product cards to customer on WhatsApp.
 *
 * For each product:
 *   1. Sends main CTA URL card (first image + product info + View button)
 *   2. If product has multiple images → sends remaining images as carousel
 *
 * Image carousel strategy:
 *   - First image: Shown in the main CTA card (has product info + button)
 *   - Images 2-4: Sent as plain image messages (creates gallery scroll)
 *   - Max 4 images per product to avoid WhatsApp spam detection
 *
 * @param recipientPhone - Customer's WhatsApp number
 * @param products       - Retrieved products to show (max MAX_PRODUCTS)
 * @param creds          - WhatsApp API credentials
 * @param productImageMap - Optional map of product ID → all image URLs (from DB)
 */
export async function sendProductCardsToCustomer(
  recipientPhone: string,
  products: RetrievedProduct[],
  creds: WhatsAppCredentials,
  productImageMap?: Map<string, string[]>
): Promise<void> {
  if (products.length === 0) return

  const toShow = products.slice(0, MAX_PRODUCTS)

  for (const product of toShow) {
    // Get all images for this product
    const allImages = productImageMap?.get(product.id)
      ?? (product.image_url ? [product.image_url] : [])

    // Card 1: Main CTA card with first image + product info
    const mainImage = allImages[0] ?? product.image_url
    try {
      await sendProductCTACard(recipientPhone, product, mainImage, creds)
    } catch (err) {
      console.error(`[ProductResponse] Main card failed for "${product.name}":`, err)
      continue  // Skip carousel images if main card failed
    }

    // Cards 2-4: Additional images (carousel effect)
    const extraImages = allImages.slice(1, MAX_IMAGES_PER_PRODUCT)
    for (const imgUrl of extraImages) {
      try {
        await sendAdditionalImage(recipientPhone, imgUrl, creds)
      } catch (err) {
        console.error(`[ProductResponse] Extra image failed:`, err)
        // Don't break — try remaining images
      }
    }
  }
}

// ─── Checkout Message Exports ────────────────────────────────────────────────

/**
 * sendPaymentLinkCard
 * Sends Razorpay payment link as an interactive CTA URL button.
 * Professional style — customer taps button to open payment page.
 *
 * Card format:
 *   "🎉 Order #abc ready! Total: ₹650. Link expires in 24 hours."
 *   [ Pay ₹650 ] ← CTA button opens Razorpay payment page
 *
 * Falls back to plain text with URL if CTA fails.
 */
export async function sendPaymentLinkCard(
  phone: string,
  paymentUrl: string,
  totalText: string,
  orderId: string,
  creds: WhatsAppCredentials
): Promise<void> {
  const success = await sendWhatsAppMessage(phone, {
    type: 'interactive',
    interactive: {
      type: 'cta_url',
      body: {
        text: `🎉 *Order #${orderId.slice(0, 8)} ready!*\n\nTotal: *${totalText}*\nLink expires in 24 hours.`,
      },
      action: {
        name: 'cta_url',
        parameters: {
          display_text: `Pay ${totalText}`,
          url: paymentUrl,
        },
      },
    },
  }, creds)

  // Fallback: plain text with link
  if (!success) {
    await sendWhatsAppMessage(phone, {
      type: 'text',
      text: {
        body: `🎉 Order ready! Total: ${totalText}\n\nPay securely here:\n${paymentUrl}\n\nLink expires in 24 hours.`,
      },
    }, creds)
  }
}

/**
 * sendInteractiveButtons
 * Sends WhatsApp interactive reply buttons (max 3 buttons).
 * Used for checkout payment choice, confirmations, etc.
 *
 * WhatsApp button format:
 *   - type: "reply" (user taps, WhatsApp sends the button text as message)
 *   - max 3 buttons per message
 *   - max 20 chars per button title
 *
 * Falls back to numbered text list if buttons fail.
 *
 * @param phone    - Recipient phone number
 * @param bodyText - Message body above the buttons
 * @param buttons  - Array of { id, title } (max 3)
 * @param creds    - WhatsApp credentials
 */
export async function sendInteractiveButtons(
  phone: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
  creds: WhatsAppCredentials
): Promise<void> {
  const success = await sendWhatsAppMessage(phone, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  }, creds)

  // Fallback: plain text with options
  if (!success) {
    const fallback = `${bodyText}\n\n${buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n')}\n\n_Reply with the number or option name._`
    await sendWhatsAppMessage(phone, {
      type: 'text',
      text: { body: fallback },
    }, creds)
  }
}

/**
 * sendTextMessage
 * Simple text message sender — exported for use by other modules.
 */
export async function sendTextMessage(
  phone: string,
  text: string,
  creds: WhatsAppCredentials
): Promise<void> {
  await sendWhatsAppMessage(phone, {
    type: 'text',
    text: { body: text },
  }, creds)
}

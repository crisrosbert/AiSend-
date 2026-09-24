/**
 * ============================================================================
 * File: src/lib/ai-agent/product-response.ts
 * Purpose: Send rich product cards via WhatsApp — Amazon-style formatting
 * ============================================================================
 *
 * Card styles supported:
 *
 * 1. RICH PRODUCT CARD (primary — Amazon-style):
 *    ┌─────────────────────────────────┐
 *    │       [Product Image]           │
 *    │                                 │
 *    │ *Product Name*                  │
 *    │ ₹259  ~₹499~  (-48% OFF)       │  ← Price + MRP strikethrough + discount
 *    │ ✅ In Stock                      │
 *    │ 📦 Free delivery available       │
 *    │                                 │
 *    │  🛒 Add to Cart                 │  ← Quick reply button
 *    │  🔗 View Product                │  ← CTA URL button (opens store)
 *    └─────────────────────────────────┘
 *
 * 2. MULTI-IMAGE CAROUSEL (when product has multiple images):
 *    Sends each image as a swipeable card with product info
 *    Max 4 images per product to avoid spam
 *
 * 3. INTERACTIVE BUTTONS (for checkout payment choice):
 *    ┌─────────────────────────┐
 *    │  Choose payment:        │
 *    │  [Pay Online]           │
 *    │  [Cash on Delivery]     │
 *    └─────────────────────────┘
 *
 * 4. PAYMENT LINK CTA (for Razorpay checkout):
 *    ┌─────────────────────────┐
 *    │  Order #abc ready!      │
 *    │  Total: ₹650            │
 *    │  🔗 Pay ₹650            │
 *    └─────────────────────────┘
 *
 * Fallback: If interactive messages fail, falls back to plain image + caption.
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

// ─── Price & Discount Formatters ─────────────────────────────────────────────

/**
 * Format currency symbol based on currency code.
 */
function currencySymbol(currency: string): string {
  return currency === 'INR' ? '₹' : currency
}

/**
 * Calculate discount percentage between MRP and selling price.
 * Returns null if no discount or compare_at_price not available.
 */
function discountPercent(price: number, compareAtPrice: number | null): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
}

/**
 * Build rich price line — Amazon style:
 * "₹259  ~₹499~  *48% OFF*"   (with discount)
 * "₹259"                       (without discount)
 *
 * WhatsApp formatting: *bold*, ~strikethrough~, _italic_
 */
function buildPriceLine(product: RetrievedProduct): string {
  const sym = currencySymbol(product.currency)
  const price = `*${sym}${product.price.toFixed(0)}*`

  const discount = discountPercent(product.price, product.compare_at_price)
  if (discount && product.compare_at_price) {
    const mrp = `~${sym}${product.compare_at_price.toFixed(0)}~`
    return `${price}  ${mrp}  *-${discount}% OFF*`
  }
  return price
}

// ─── Caption Builders ────────────────────────────────────────────────────────

/**
 * Build rich product caption — Amazon/e-commerce style.
 *
 * Format:
 *   *Product Name*
 *   ₹259  ~₹499~  *-48% OFF*
 *   ✅ In Stock · 📦 Free delivery
 *   Short description here...
 */
function buildRichCaption(product: RetrievedProduct): string {
  const lines: string[] = []

  // Product name (bold)
  lines.push(`*${product.name}*`)

  // Price line with discount
  lines.push(buildPriceLine(product))

  // Stock + delivery status line
  const statusParts: string[] = []
  if (product.in_stock) {
    statusParts.push('✅ In Stock')
  } else {
    statusParts.push('❌ Out of Stock')
  }
  statusParts.push('📦 Free delivery')
  lines.push(statusParts.join(' · '))

  // Short description (max 150 chars, clean)
  if (product.description) {
    const desc = product.description
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 150)
    if (desc.length > 0) {
      lines.push(`\n_${desc}_`)
    }
  }

  return lines.join('\n')
}

/**
 * Build CTA button display text.
 * WhatsApp limits CTA button text to 20 characters.
 */
function ctaButtonText(productName: string): string {
  const words = productName.split(/[\s—]+/)
  let text = `View ${words.slice(0, 2).join(' ')}`
  if (text.length > 20) text = text.slice(0, 17) + '...'
  return text
}

// ─── Product Card Senders ────────────────────────────────────────────────────

/**
 * Send a single rich interactive CTA URL product card.
 * This is the primary card — image + rich caption + "View Product" button.
 *
 * WhatsApp interactive CTA URL format:
 * - header: product image
 * - body: rich formatted text (name, price, discount, stock)
 * - action: CTA URL button linking to product page
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
    body: { text: buildRichCaption(product) },
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

  // If interactive fails, try fallback plain message
  if (!success) {
    return sendFallbackImageCard(phone, product, imageUrl, creds)
  }
  return true
}

/**
 * Send "Add to Cart" quick reply button after the product card.
 * This is a separate interactive button message that lets customer
 * add the product without typing — one-tap experience.
 *
 * Button ID format: "add_cart_{external_id}" — parsed by intent detector
 */
async function sendAddToCartButton(
  phone: string,
  product: RetrievedProduct,
  creds: WhatsAppCredentials
): Promise<boolean> {
  const sym = currencySymbol(product.currency)

  return sendWhatsAppMessage(phone, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: `🛒 _${product.name}_ — ${sym}${product.price.toFixed(0)}`,
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: { id: `add_cart_${product.external_id}`, title: '🛒 Add to Cart' },
          },
          {
            type: 'reply',
            reply: { id: `buy_now_${product.external_id}`, title: '⚡ Buy Now' },
          },
        ],
      },
    },
  }, creds)
}

/**
 * Send additional product images (for carousel effect).
 * These are plain image messages — sent after the main CTA card to
 * create a gallery/carousel feel in WhatsApp.
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
 * Fallback: plain image + rich caption (for older WhatsApp Business API
 * versions that don't support interactive CTA URL messages).
 */
async function sendFallbackImageCard(
  phone: string,
  product: RetrievedProduct,
  imageUrl: string | null,
  creds: WhatsAppCredentials
): Promise<boolean> {
  const caption = buildRichCaption(product)
    + (product.product_url ? `\n\n🔗 ${product.product_url}` : '')

  if (imageUrl) {
    return sendWhatsAppMessage(phone, {
      type: 'image',
      image: { link: imageUrl, caption },
    }, creds)
  }
  // No image — send as text
  return sendWhatsAppMessage(phone, {
    type: 'text',
    text: { body: caption },
  }, creds)
}

// ─── Main Product Card Export ────────────────────────────────────────────────

/**
 * sendProductCardsToCustomer
 * Main entry point — sends rich product cards to customer on WhatsApp.
 *
 * For each product:
 *   1. Sends main CTA URL card (first image + rich info + View button)
 *   2. If product has multiple images → sends remaining images as carousel
 *   3. Sends "Add to Cart" / "Buy Now" quick reply buttons
 *
 * Image carousel strategy:
 *   - First image: Shown in the main CTA card header
 *   - Images 2-4: Sent as plain image messages (swipeable gallery)
 *   - Max 4 images per product to avoid WhatsApp spam detection
 *
 * @param recipientPhone  - Customer's WhatsApp number
 * @param products        - Retrieved products to show (max MAX_PRODUCTS)
 * @param creds           - WhatsApp API credentials
 * @param productImageMap - Optional map of product ID → all image URLs (deprecated, use image_urls)
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
    // Get all images — prefer image_urls from DB, fallback to map or single image
    const allImages = product.image_urls
      ?? productImageMap?.get(product.id)
      ?? (product.image_url ? [product.image_url] : [])

    // Card 1: Main CTA card with first image + rich product info
    const mainImage = allImages[0] ?? product.image_url
    try {
      await sendProductCTACard(recipientPhone, product, mainImage, creds)
    } catch (err) {
      console.error(`[ProductResponse] Main card failed for "${product.name}":`, err)
      continue  // Skip carousel + buttons if main card failed
    }

    // Cards 2-4: Additional images (carousel effect — swipeable in WhatsApp)
    const extraImages = allImages.slice(1, MAX_IMAGES_PER_PRODUCT)
    for (const imgUrl of extraImages) {
      try {
        await sendAdditionalImage(recipientPhone, imgUrl, creds)
      } catch (err) {
        console.error(`[ProductResponse] Extra image failed:`, err)
        // Don't break — try remaining images
      }
    }

    // Quick action buttons: "Add to Cart" + "Buy Now"
    try {
      await sendAddToCartButton(recipientPhone, product, creds)
    } catch (err) {
      console.error(`[ProductResponse] Add to cart button failed:`, err)
      // Non-critical — product card already sent
    }
  }
}

// ─── Checkout Message Exports ────────────────────────────────────────────────

/**
 * sendPaymentLinkCard
 * Sends Razorpay payment link as an interactive CTA URL button.
 * Professional style — customer taps button to open payment page.
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

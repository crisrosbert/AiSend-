/**
 * File: src/lib/ai-agent/product-response.ts
 * Purpose: Send product cards to customers via WhatsApp for AI Ecommerce Agent
 *
 * When the agent finds matching products, it sends:
 *   1. A text message with the LLM-generated reply (handled in engine.ts)
 *   2. Product image cards (handled HERE) — one image per product with caption
 *
 * WhatsApp image message format:
 *   - Type: "image" with link (URL) or base64 id
 *   - Caption: Product name, price, "Add to cart" CTA
 *   - Max 5 products shown at once (WhatsApp UX best practice)
 *
 * Falls back gracefully if image_url is null — sends text-only product list instead.
 */

import { RetrievedProduct } from './retriever'

// ─── Constants ───────────────────────────────────────────────────────────────

/** Max product cards to send in one burst (more = spammy) */
const MAX_PRODUCT_CARDS_TO_SEND = 3

/** WhatsApp Graph API base URL */
const WHATSAPP_API_BASE_URL = 'https://graph.facebook.com/v21.0'

// ─── Types ───────────────────────────────────────────────────────────────────

/** WhatsApp credentials needed to call the Messages API */
export interface WhatsAppSendCredentials {
  phoneNumberId: string  // WhatsApp Business phone number ID
  accessToken: string    // WhatsApp permanent access token
}

/** Result of sending product cards */
export interface ProductCardsSendResult {
  cardsSent: number        // How many image cards were sent successfully
  failedCards: number      // How many failed (logged but not thrown)
  sentProductNames: string[] // Names of products whose cards were sent
}

// ─── WhatsApp Message Senders ─────────────────────────────────────────────────

/**
 * sendWhatsAppImageMessage
 * Sends a single product image card to the customer via WhatsApp Cloud API.
 * Image is sent as a URL link (WhatsApp fetches it from the merchant's CDN).
 *
 * @param recipientPhone  - Customer's phone number (with country code, no +)
 * @param imageUrl        - Product image URL (must be publicly accessible)
 * @param captionText     - Product name + price + CTA (shown under image)
 * @param credentials     - WhatsApp phone number ID + access token
 */
async function sendWhatsAppImageMessage(
  recipientPhone: string,
  imageUrl: string,
  captionText: string,
  credentials: WhatsAppSendCredentials
): Promise<void> {
  const whatsappApiUrl = `${WHATSAPP_API_BASE_URL}/${credentials.phoneNumberId}/messages`

  const messagePayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone,
    type: 'image',
    image: {
      link: imageUrl,
      caption: captionText,
    },
  }

  const apiResponse = await fetch(whatsappApiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${credentials.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messagePayload),
  })

  if (!apiResponse.ok) {
    const errorBody = await apiResponse.text()
    throw new Error(
      `[AI Agent Product Response] WhatsApp image send failed (${apiResponse.status}): ${errorBody}`
    )
  }
}

/**
 * sendWhatsAppTextMessage
 * Sends a plain text message to the customer via WhatsApp Cloud API.
 * Used as fallback when products have no image_url.
 *
 * @param recipientPhone  - Customer's phone number
 * @param messageText     - Text content to send
 * @param credentials     - WhatsApp credentials
 */
async function sendWhatsAppTextMessage(
  recipientPhone: string,
  messageText: string,
  credentials: WhatsAppSendCredentials
): Promise<void> {
  const whatsappApiUrl = `${WHATSAPP_API_BASE_URL}/${credentials.phoneNumberId}/messages`

  const messagePayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone,
    type: 'text',
    text: { body: messageText },
  }

  const apiResponse = await fetch(whatsappApiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${credentials.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messagePayload),
  })

  if (!apiResponse.ok) {
    const errorBody = await apiResponse.text()
    throw new Error(
      `[AI Agent Product Response] WhatsApp text send failed (${apiResponse.status}): ${errorBody}`
    )
  }
}

// ─── Caption Builder ──────────────────────────────────────────────────────────

/**
 * buildProductCardCaption
 * Generates the caption text shown under each product image in WhatsApp.
 * Keeps it short (WhatsApp truncates long captions on some devices).
 *
 * Format:
 *   *Nike Air Max 90*
 *   💰 ₹5,499
 *   ✅ In Stock
 *   👉 Reply "add Nike shoes" to add to cart
 *
 * @param product         - Product data from retriever.ts
 * @param productIndex    - 1-based index (shown to customer for easy reference)
 * @returns Caption string (max ~200 chars recommended)
 */
function buildProductCardCaption(product: RetrievedProduct, productIndex: number): string {
  const currencySymbol = product.currency === 'INR' ? '₹' : product.currency
  const priceFormatted = `${currencySymbol}${product.price.toFixed(0)}`
  const stockStatus = product.in_stock ? '✅ In Stock' : '❌ Out of Stock'

  const captionLines = [
    `*${productIndex}. ${product.name}*`,
    `💰 ${priceFormatted}`,
    stockStatus,
    product.in_stock
      ? `👉 Reply "add ${product.name.split(' ')[0]}" to add to cart`
      : `(Currently unavailable)`,
  ]

  return captionLines.join('\n')
}

// ─── Text-Only Fallback ───────────────────────────────────────────────────────

/**
 * buildProductListText
 * Generates a plain-text product list when no images are available.
 * Used as fallback by sendProductCardsToCustomer().
 *
 * @param products - Array of retrieved products
 * @returns Formatted product list as a single string
 */
function buildProductListText(products: RetrievedProduct[]): string {
  const productLines = products.map((product, index) => {
    const currencySymbol = product.currency === 'INR' ? '₹' : product.currency
    const priceFormatted = `${currencySymbol}${product.price.toFixed(0)}`
    const stockStatus = product.in_stock ? '✅' : '❌'
    return `${index + 1}. ${stockStatus} *${product.name}* — ${priceFormatted}`
  })

  return (
    `Here are the products I found:\n\n` +
    productLines.join('\n') +
    `\n\nReply with the product name to add to cart!`
  )
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * sendProductCardsToCustomer
 * Main entry point called by engine.ts after the text reply is sent.
 * Sends product image cards (or text list if no images) to the customer.
 *
 * Strategy:
 *   - Filter to MAX_PRODUCT_CARDS_TO_SEND products
 *   - For each: if image_url exists → send as image card; else collect for text fallback
 *   - If no images at all → send one text message with full product list
 *   - Individual card failures are logged but don't stop other cards
 *
 * @param recipientPhone  - Customer's WhatsApp phone number
 * @param products        - Products found by retriever.ts
 * @param credentials     - WhatsApp API credentials
 * @returns ProductCardsSendResult with counts
 */
export async function sendProductCardsToCustomer(
  recipientPhone: string,
  products: RetrievedProduct[],
  credentials: WhatsAppSendCredentials
): Promise<ProductCardsSendResult> {
  if (products.length === 0) {
    return { cardsSent: 0, failedCards: 0, sentProductNames: [] }
  }

  // Limit to max cards to avoid overwhelming the customer
  const productsToDisplay = products.slice(0, MAX_PRODUCT_CARDS_TO_SEND)

  const productsWithImages = productsToDisplay.filter((p) => p.image_url)
  const productsWithoutImages = productsToDisplay.filter((p) => !p.image_url)

  let cardsSent = 0
  let failedCards = 0
  const sentProductNames: string[] = []

  // Send image cards for products that have images
  for (let index = 0; index < productsWithImages.length; index++) {
    const product = productsWithImages[index]
    const captionText = buildProductCardCaption(product, index + 1)

    try {
      await sendWhatsAppImageMessage(
        recipientPhone,
        product.image_url!, // Guaranteed non-null by filter above
        captionText,
        credentials
      )

      cardsSent++
      sentProductNames.push(product.name)

      console.log(
        `[AI Agent Product Response] Image card sent for product: ${product.name}`
      )
    } catch (imageSendError) {
      failedCards++
      console.error(
        `[AI Agent Product Response] Failed to send image for "${product.name}":`,
        imageSendError
      )
      // Continue sending other cards even if one fails
    }
  }

  // If some products had no images, include them in a text fallback message
  if (productsWithoutImages.length > 0) {
    const textFallbackMessage = buildProductListText(productsWithoutImages)

    try {
      await sendWhatsAppTextMessage(recipientPhone, textFallbackMessage, credentials)
      cardsSent += productsWithoutImages.length
      sentProductNames.push(...productsWithoutImages.map((p) => p.name))
    } catch (textSendError) {
      failedCards += productsWithoutImages.length
      console.error(
        '[AI Agent Product Response] Failed to send text product list:',
        textSendError
      )
    }
  }

  // If ALL products had no images (and text send above ran), nothing extra to do
  // If ALL products had images (handled above), we're done

  console.log(
    `[AI Agent Product Response] Result: ${cardsSent} cards sent, ${failedCards} failed for phone=${recipientPhone}`
  )

  return { cardsSent, failedCards, sentProductNames }
}

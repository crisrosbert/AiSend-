// src/lib/agent/tools/payment-tools.ts
//
// Lets the AI agent create a Razorpay payment link and send it in chat.
// Money routes to the TENANT's own Razorpay account (per-tenant keys).
//
// Used by: src/lib/agent/engine.ts (registered in TOOLS)

import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/whatsapp/encryption'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null
function db() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _client
}

export interface SendPaymentLinkArgs {
  tenantId: string
  contactId: string
  conversationId: string
  amountRupees: number
  description: string
  customerName?: string
  customerPhone?: string
}

/**
 * Create a Razorpay payment link for the tenant and return a message
 * containing the payable URL for the AI to send. Returns a PAYMENT_FAILED
 * signal on error so the AI never sends a broken/fake link.
 */
export async function sendPaymentLink(
  args: SendPaymentLinkArgs,
): Promise<string> {
  try {
    if (!args.amountRupees || args.amountRupees <= 0) {
      return 'Ask the customer what amount they need to pay before creating a link.'
    }

    // Load the tenant's Razorpay credentials
    const { data: rzp } = await db()
      .from('razorpay_config')
      .select('key_id, key_secret, is_active')
      .eq('tenant_id', args.tenantId)
      .maybeSingle()

    if (!rzp || !rzp.is_active) {
      return 'PAYMENT_UNAVAILABLE: Online payment is not set up for this business yet. Tell the customer the team will share payment details directly.'
    }

    const keyId = rzp.key_id
    const keySecret = decrypt(rzp.key_secret)
    const amountPaise = Math.round(args.amountRupees * 100)

    // Create the payment link via Razorpay API
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const res = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        description: args.description || 'Payment',
        customer: {
          name: args.customerName || undefined,
          contact: args.customerPhone && !args.customerPhone.startsWith('web_')
            ? args.customerPhone
            : undefined,
        },
        notify: { sms: false, email: false }, // we send it in chat ourselves
        reminder_enable: true,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[payment-tools] Razorpay error:', res.status, errText.slice(0, 200))
      return 'PAYMENT_FAILED: Could not create the payment link. Apologize and tell the customer the team will share payment details shortly.'
    }

    const data = await res.json()
    const shortUrl = data.short_url
    const linkId = data.id

    // Log it
    await db().from('payment_links').insert({
      tenant_id: args.tenantId,
      conversation_id: args.conversationId,
      contact_id: args.contactId,
      razorpay_link_id: linkId,
      short_url: shortUrl,
      amount_paise: amountPaise,
      description: args.description,
      status: 'created',
    })

    return `Payment link created. Send this to the customer: ${shortUrl} — Tell them they can pay ₹${args.amountRupees} securely via UPI, card, or netbanking. Confirm you'll let them know once payment is received.`
  } catch (err) {
    console.error('[payment-tools] error:', err)
    return 'PAYMENT_FAILED: A technical error occurred. Tell the customer the team will share payment details directly.'
  }
}

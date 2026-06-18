import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'
import {
  getOrgIdForUser,
  getTemplateCategory,
  getOrgBalance,
  priceForCategory,
  deductCredits,
} from '@/lib/billing/credits'

interface BroadcastResult {
  phone: string
  status: 'sent' | 'failed'
  whatsapp_message_id?: string
  error?: string
}

/**
 * Two input shapes are accepted:
 *
 *   NEW (preferred — supports per-recipient variable substitution):
 *     {
 *       recipients: Array<{ phone: string; params: string[] }>,
 *       template_name, template_language
 *     }
 *
 *   LEGACY (all phones receive the same params — kept so existing
 *   callers don't break):
 *     {
 *       phone_numbers: string[],
 *       template_params: string[],
 *       template_name, template_language
 *     }
 *
 * Previous implementation only supported the legacy shape, and the
 * sending hook was forced to ship every batch with `templateParams[0]`
 * — meaning every recipient got contact-0's personalization. The new
 * shape is what actually fixes that.
 */
interface NewRecipient {
  phone: string
  params?: string[]
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Per-user broadcast budget. Note: this limits how often a user
    // can *start* a campaign, not how many messages go out inside
    // one — the fan-out loop below runs without additional gating.
    const limit = checkRateLimit(`broadcast:${user.id}`, RATE_LIMITS.broadcast)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    const body = await request.json()
    const {
      recipients: newRecipients,
      phone_numbers,
      template_name,
      template_language,
      template_params,
    } = body

    // Normalize to a list of {phone, params} regardless of shape.
    let recipients: NewRecipient[]
    if (Array.isArray(newRecipients) && newRecipients.length > 0) {
      recipients = newRecipients
    } else if (Array.isArray(phone_numbers) && phone_numbers.length > 0) {
      const shared: string[] = Array.isArray(template_params)
        ? template_params
        : []
      recipients = phone_numbers.map((phone: string) => ({
        phone,
        params: shared,
      }))
    } else {
      return NextResponse.json(
        {
          error:
            'Provide either `recipients` (preferred) or `phone_numbers` — must be a non-empty array',
        },
        { status: 400 }
      )
    }

    if (!template_name) {
      return NextResponse.json(
        { error: 'template_name is required' },
        { status: 400 }
      )
    }

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        {
          error:
            'WhatsApp not configured. Please set up your WhatsApp integration first.',
        },
        { status: 400 }
      )
    }

    const accessToken = decrypt(config.access_token)

    // ── Wallet pre-flight ──────────────────────────────────────────
    // Resolve the org + price per message (by template category) up
    // front. We block the whole broadcast if the wallet can't cover at
    // least one message — partial sends with a drained wallet are worse
    // UX than a clean "top up" error. Per-message deduction still
    // happens inside the loop (so a mid-broadcast failure doesn't
    // charge for messages Meta rejected).
    //
    // service messages (price 0) skip all of this — nothing to charge.
    const orgId = await getOrgIdForUser(supabase, user.id)
    const category = await getTemplateCategory(
      supabase,
      user.id,
      template_name,
      template_language || undefined,
    )
    const unitPrice = priceForCategory(category)

    if (unitPrice > 0) {
      if (!orgId) {
        return NextResponse.json(
          {
            error:
              'No organization linked to this account — cannot bill messages. Contact support.',
          },
          { status: 400 }
        )
      }
      const balance = await getOrgBalance(supabase, orgId)
      const estimatedTotal = unitPrice * recipients.length
      if (balance < unitPrice) {
        return NextResponse.json(
          {
            error: 'INSUFFICIENT_CREDITS',
            message: `Wallet balance ₹${balance.toFixed(2)} is too low to send. Top up to continue.`,
            balance,
            unit_price: unitPrice,
            estimated_total: estimatedTotal,
          },
          { status: 402 }
        )
      }
    }

    const results: BroadcastResult[] = []
    let sentCount = 0
    let failedCount = 0
    let totalCharged = 0
    let stoppedForCredits = false

    for (const recipient of recipients) {
      // If a prior iteration drained the wallet, stop sending and mark
      // the rest as failed rather than firing messages we can't bill.
      if (stoppedForCredits) {
        results.push({
          phone: recipient.phone,
          status: 'failed',
          error: 'Insufficient wallet balance',
        })
        failedCount++
        continue
      }

      const sanitized = sanitizePhoneForMeta(recipient.phone)

      if (!isValidE164(sanitized)) {
        results.push({
          phone: recipient.phone,
          status: 'failed',
          error: 'Invalid phone number format',
        })
        failedCount++
        continue
      }

      // Retry with phone variants on "not in allowed list" so numbers
      // that differ only in a trunk-prefix 0 still reach recipients.
      const variants = phoneVariants(sanitized)
      let sentMessageId: string | null = null
      let lastError: string | null = null

      for (const variant of variants) {
        try {
          const result = await sendTemplateMessage({
            phoneNumberId: config.phone_number_id,
            accessToken,
            to: variant,
            templateName: template_name,
            language: template_language || 'en_US',
            params: recipient.params ?? [],
          })
          sentMessageId = result.messageId
          lastError = null
          break
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          if (!isRecipientNotAllowedError(errorMessage)) {
            lastError = errorMessage
            break
          }
          lastError = errorMessage
          // retry with next variant
        }
      }

      if (sentMessageId) {
        // Bill the wallet for this delivered message. We charge AFTER
        // Meta accepted it, so rejected sends are never billed. If the
        // debit fails for insufficient funds, the message already went
        // out (we honor it) but we stop the rest of the broadcast.
        if (unitPrice > 0 && orgId) {
          const deb = await deductCredits(supabase, {
            orgId,
            userId: user.id,
            amount: unitPrice,
            description: `WhatsApp ${category} message to ${recipient.phone}`,
            reference: sentMessageId,
          })
          if (deb.ok) {
            totalCharged += unitPrice
          } else if (deb.reason === 'insufficient') {
            stoppedForCredits = true
          }
        }

        results.push({
          phone: recipient.phone,
          status: 'sent',
          whatsapp_message_id: sentMessageId,
        })
        sentCount++
      } else {
        console.error(
          `Failed to send broadcast to ${recipient.phone}:`,
          lastError
        )
        results.push({
          phone: recipient.phone,
          status: 'failed',
          error: lastError || 'Unknown error',
        })
        failedCount++
      }
    }

    return NextResponse.json({
      success: true,
      total: recipients.length,
      sent: sentCount,
      failed: failedCount,
      results,
      billing: {
        category,
        unit_price: unitPrice,
        total_charged: Number(totalCharged.toFixed(4)),
        stopped_for_credits: stoppedForCredits,
      },
    })
  } catch (error) {
    console.error('Error in WhatsApp broadcast POST:', error)
    return NextResponse.json(
      { error: 'Failed to process broadcast' },
      { status: 500 }
    )
  }
}

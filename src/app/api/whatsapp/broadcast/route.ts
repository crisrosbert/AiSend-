import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
export const dynamic = 'force-dynamic'

/**
 * The dashboard calls this with one recipient per request, so a normal
 * send finishes in well under a second. The budget is here for the
 * other caller: anything hitting the API directly with a large
 * `recipients` array, which would otherwise be cut off at the platform
 * default mid-loop, having already charged for the messages it sent.
 */
export const maxDuration = 60
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
import { filterBroadcastPhones } from '@/lib/optin/manager'

interface BroadcastResult {
  phone: string
  status: 'sent' | 'failed' | 'skipped'
  whatsapp_message_id?: string
  error?: string
}

interface NewRecipient {
  phone: string
  params?: string[]
  /**
   * Which broadcast_recipients row this send belongs to.
   *
   * Sent by the dashboard so a successful send can be written back
   * against the right row. Optional, because the same endpoint is used
   * for one-off sends that belong to no campaign.
   */
  contact_id?: string
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
      // The dashboard has always sent this; nothing ever read it, which
      // is why no send was recorded against its campaign.
      broadcast_id,
    } = body
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

    // ── OPT-IN GUARD (compliance safety net) ──────────────────────
    // Filter out recipients who have opted out (replied STOP). This is
    // the legally-required, number-protecting step. Default mode blocks
    // ONLY opted-out contacts so it won't accidentally block untagged
    // contacts. To tighten to "opted-in only", change 'block_opted_out'
    // to 'require_opted_in' below (do this once warm contacts are tagged).
    const optinGuard = await filterBroadcastPhones(
      user.id,
      recipients.map((r) => r.phone),
      'block_opted_out',
    )
    const blockedSet = new Set(optinGuard.blocked.map((b) => b.phone))
    const skippedResults: BroadcastResult[] = optinGuard.blocked.map((b) => ({
      phone: b.phone,
      status: 'skipped',
      error: `Skipped: ${b.reason}`,
    }))
    // Keep only recipients that passed the guard.
    recipients = recipients.filter((r) => !blockedSet.has(r.phone))

    if (recipients.length === 0) {
      return NextResponse.json({
        success: true,
        total: skippedResults.length,
        sent: 0,
        failed: 0,
        skipped: skippedResults.length,
        results: skippedResults,
        message: 'All recipients were skipped (opted out or not eligible).',
      })
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

    // Start results with the skipped (opted-out) rows so the caller
    // sees a full accounting of every phone they submitted.
    const results: BroadcastResult[] = [...skippedResults]
    let sentCount = 0
    let failedCount = 0
    let totalCharged = 0
    let stoppedForCredits = false
    for (const recipient of recipients) {
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
        }
      }
      if (sentMessageId) {
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
        // ── Record the send against the campaign ──
        //
        // Without this, delivery tracking never worked. The webhook
        // finds a recipient row by whatsapp_message_id, but nothing on
        // the sending side ever wrote that column — the dashboard sent
        // broadcast_id and this route ignored it. So every row stayed
        // 'pending' with a null message id, no ticks ever turned blue,
        // and "resend to unread" had no idea who had read anything.
        //
        // Failures here are logged, never fatal: the message has
        // already gone to the customer and reporting it as failed
        // because the bookkeeping slipped would be worse than a gap in
        // the stats.
        if (broadcast_id && recipient.contact_id) {
          const { error: recErr } = await supabase
            .from('broadcast_recipients')
            .update({
              status: 'sent',
              whatsapp_message_id: sentMessageId,
              sent_at: new Date().toISOString(),
            })
            .eq('broadcast_id', broadcast_id)
            .eq('contact_id', recipient.contact_id)
          if (recErr) {
            console.error('[broadcast] could not mark recipient sent:', recErr.message)
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

        // Record the failure too. If only successes are written, a row
        // left at 'pending' is ambiguous — never attempted, or attempted
        // and failed? Marking failures makes 'pending' mean exactly one
        // thing: this recipient has not been tried yet. That is what
        // lets a campaign be resumed safely.
        if (broadcast_id && recipient.contact_id) {
          const { error: recErr } = await supabase
            .from('broadcast_recipients')
            .update({
              status: 'failed',
              error_message: (lastError || 'Unknown error').slice(0, 500),
            })
            .eq('broadcast_id', broadcast_id)
            .eq('contact_id', recipient.contact_id)
          if (recErr) {
            console.error('[broadcast] could not mark recipient failed:', recErr.message)
          }
        }

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
      total: recipients.length + skippedResults.length,
      sent: sentCount,
      failed: failedCount,
      skipped: skippedResults.length,
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

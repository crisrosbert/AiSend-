import { SupabaseClient } from '@supabase/supabase-js'
import { sendTextMessage } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'

/**
 * Load WhatsApp credentials for a user (phone_number_id + decrypted access_token).
 */
async function loadWaCredentials(
  userId: string,
  supabase: SupabaseClient
): Promise<{ phoneNumberId: string; accessToken: string } | null> {
  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('phone_number_id, access_token')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return {
    phoneNumberId: data.phone_number_id,
    accessToken: decrypt(data.access_token),
  }
}

/**
 * Record a merchant notification in the dashboard (ai_agent_notifications table).
 * The merchant sees these in their dashboard notification panel.
 */
export async function notifyMerchantNewOrder(
  orderId: string,
  userId: string,
  orderTotal: number,
  customerPhone: string,
  paymentMethod: string,
  supabase: SupabaseClient
): Promise<void> {
  const maskedPhone =
    customerPhone.length > 4
      ? '***' + customerPhone.slice(-4)
      : customerPhone

  await supabase.from('ai_agent_notifications').insert({
    user_id: userId,
    type: 'new_order',
    title: 'New Order Received',
    message: `Order #${orderId.slice(0, 8)} — ₹${orderTotal.toLocaleString('en-IN')} from ${maskedPhone} via ${paymentMethod}`,
    metadata: {
      order_id: orderId,
      total: orderTotal,
      payment_method: paymentMethod,
    },
  })
}

/**
 * Send a WhatsApp message to the customer when their order status changes.
 * Handles shipped (with optional tracking) and delivered statuses.
 */
export async function notifyCustomerOrderUpdate(
  contactPhone: string,
  orderId: string,
  newStatus: string,
  trackingNumber: string | null,
  userId: string,
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  const creds = await loadWaCredentials(userId, supabase)
  if (!creds) {
    return { success: false, error: 'WhatsApp credentials not found' }
  }

  // Load store name for branded messages
  const { data: config } = await supabase
    .from('ai_agent_configs')
    .select('store_name')
    .eq('user_id', userId)
    .single()
  const storeName = config?.store_name || 'Our Store'
  const shortId = orderId.slice(0, 8).toUpperCase()

  let text: string
  switch (newStatus) {
    case 'confirmed':
      text = `✅ *Order Confirmed*\n\nHi! Your order #${shortId} from ${storeName} has been confirmed. We'll notify you when it ships.\n\nThank you for your purchase!`
      break
    case 'processing':
      text = `📦 *Order Processing*\n\nYour order #${shortId} from ${storeName} is being prepared for shipment. We'll send you tracking details once it ships.`
      break
    case 'shipped': {
      let trackingInfo = ''
      if (trackingNumber) {
        trackingInfo = `\n\n🔗 Tracking Number: *${trackingNumber}*`
      }
      text = `🚚 *Order Shipped!*\n\nGreat news! Your order #${shortId} from ${storeName} has been shipped.${trackingInfo}\n\nYou'll receive it soon!`
      break
    }
    case 'delivered':
      text = `🎉 *Order Delivered*\n\nYour order #${shortId} from ${storeName} has been delivered! We hope you love your purchase.\n\nIf you have any questions, just reply to this message.`
      break
    case 'cancelled':
      text = `❌ *Order Cancelled*\n\nYour order #${shortId} from ${storeName} has been cancelled. If you didn't request this, please contact us.\n\nWe apologize for any inconvenience.`
      break
    default:
      text = `📋 *Order Update*\n\nYour order #${shortId} from ${storeName} status has been updated to: ${newStatus}.`
  }

  try {
    await sendTextMessage({
      phoneNumberId: creds.phoneNumberId,
      accessToken: creds.accessToken,
      to: contactPhone,
      text,
    })
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[notifyCustomerOrderUpdate] Failed:', message)
    return { success: false, error: message }
  }
}

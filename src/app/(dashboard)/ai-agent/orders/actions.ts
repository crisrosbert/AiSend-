'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { notifyCustomerOrderUpdate } from '@/lib/ai-agent/notifications'

const VALID_STATUSES = [
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const

export async function updateOrderStatus(orderId: string, newStatus: string) {
  if (!VALID_STATUSES.includes(newStatus as typeof VALID_STATUSES[number])) {
    return { error: 'Invalid status' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Build the update payload with timestamp fields
  const updatePayload: Record<string, unknown> = {
    order_status: newStatus,
    updated_at: new Date().toISOString(),
  }

  if (newStatus === 'shipped') {
    updatePayload.shipped_at = new Date().toISOString()
  } else if (newStatus === 'delivered') {
    updatePayload.delivered_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('ai_agent_orders')
    .update(updatePayload)
    .eq('id', orderId)
    .eq('user_id', user.id) // security: only own orders

  if (error) return { error: error.message }

  // Send WhatsApp notification to customer (best-effort, don't block on failure)
  const { data: order } = await supabase
    .from('ai_agent_orders')
    .select('contact_phone, tracking_number')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single()

  if (order?.contact_phone) {
    await notifyCustomerOrderUpdate(
      order.contact_phone,
      orderId,
      newStatus,
      order.tracking_number ?? null,
      user.id,
      supabase
    ).catch((err) => {
      console.error('[updateOrderStatus] Notification failed:', err)
    })
  }

  revalidatePath('/ai-agent/orders')
  revalidatePath('/ai-agent')
  return { success: true }
}

export async function updateOrderTracking(
  orderId: string,
  trackingNumber: string,
  trackingUrl?: string
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const updatePayload: Record<string, unknown> = {
    tracking_number: trackingNumber,
    updated_at: new Date().toISOString(),
  }
  if (trackingUrl) {
    updatePayload.tracking_url = trackingUrl
  }

  const { error } = await supabase
    .from('ai_agent_orders')
    .update(updatePayload)
    .eq('id', orderId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/ai-agent/orders')
  revalidatePath('/ai-agent')
  return { success: true }
}

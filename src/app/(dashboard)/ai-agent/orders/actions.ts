'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('ai_agent_orders')
    .update({
      order_status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('user_id', user.id) // security: only own orders

  if (error) return { error: error.message }

  revalidatePath('/ai-agent/orders')
  revalidatePath('/ai-agent')
  return { success: true }
}

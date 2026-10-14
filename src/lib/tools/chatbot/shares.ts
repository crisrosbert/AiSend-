// Share links for the free chatbot demo. A share stores the scan result so the
// link works after the 2h chat session expires; each page view signs a fresh
// session. Server-only, best effort: returns null when the DB is not set up.

import { randomBytes } from 'node:crypto'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import type { BotProfile } from './profile'
import type { KnowledgeChunk } from './knowledge'

export interface Share {
  id: string
  host: string
  profile: BotProfile
  chunks: KnowledgeChunk[]
  facts: string
  listed: boolean
}

const enabled = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
export const SHARE_ID = /^[a-z0-9]{10}$/

export function newShareId(): string {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789'
  const b = randomBytes(10)
  return Array.from(b, (x) => a[x % a.length]).join('')
}

export async function createShare(input: Omit<Share, 'id'>): Promise<string | null> {
  if (!enabled()) {
    console.error('[chatbot-share] Supabase env vars missing')
    return null
  }
  const id = newShareId()
  try {
    const db = supabaseAdmin()
    const { error } = await db.from('tool_chatbot_shares').insert({
      id,
      host: input.host,
      profile: input.profile,
      chunks: input.chunks,
      facts: input.facts,
      listed: input.listed,
    })
    if (error) {
      console.error('[chatbot-share] insert failed (did you run migration 011?):', error.message)
      return null
    }
    if (input.listed) {
      await db.from('tool_scanned_sites').update({ demo_id: id }).eq('host', input.host)
    }
    return id
  } catch (e) {
    console.error('[chatbot-share] unexpected', e)
    return null
  }
}

export async function getShare(id: string): Promise<Share | null> {
  if (!enabled() || !SHARE_ID.test(id)) return null
  try {
    const { data } = await supabaseAdmin()
      .from('tool_chatbot_shares')
      .select('id, host, profile, chunks, facts, listed, expires_at')
      .eq('id', id)
      .maybeSingle()
    if (!data || new Date(data.expires_at).getTime() < Date.now()) return null
    // Hidden / removed sites never serve a demo.
    const { data: site } = await supabaseAdmin().from('tool_scanned_sites').select('hidden').eq('host', data.host).maybeSingle()
    if (site?.hidden) return null
    return data as Share
  } catch {
    return null
  }
}

/** Removal: hide the brand immediately and kill its demos. Logged for review. */
export async function removeHost(host: string, contact: string, note: string): Promise<boolean> {
  if (!enabled()) return false
  try {
    const db = supabaseAdmin()
    await db.from('tool_removal_requests').insert({ host, contact: contact.slice(0, 200), note: note.slice(0, 500) })
    await db.from('tool_scanned_sites').update({ hidden: true, demo_id: null }).eq('host', host)
    await db.from('tool_chatbot_shares').update({ expires_at: new Date(0).toISOString(), listed: false }).eq('host', host)
    return true
  } catch {
    return false
  }
}

export function cleanHost(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const t = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0]
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(t) && t.length <= 120 ? t : null
}

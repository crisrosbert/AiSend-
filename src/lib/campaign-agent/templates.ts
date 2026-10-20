// Server-side template submission for the Campaign Agent. The same steps as
// POST /api/whatsapp/templates/create, but callable from the cron (no browser
// session): load the account's WhatsApp config, submit to Meta, mirror locally.

import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/whatsapp/encryption'
import { createTemplate, uploadProfilePhoto } from '@/lib/whatsapp/meta-api'
import { GRAPH_BASE_URL } from '@/lib/meta/graph-version'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>

export const FOOTER = 'Reply STOP to unsubscribe'

export type LocalStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected'

function localStatus(meta: string): LocalStatus {
  switch (meta.toUpperCase()) {
    case 'APPROVED': return 'Approved'
    case 'REJECTED': case 'DISABLED': case 'PAUSED': return 'Rejected'
    default: return 'Pending'
  }
}

async function loadConfig(db: Db, userId: string) {
  const { data } = await db.from('whatsapp_config').select('waba_id, access_token').eq('user_id', userId).maybeSingle()
  if (!data?.waba_id || !data.access_token) throw new Error('WhatsApp is not connected for this account.')
  return { wabaId: data.waba_id as string, accessToken: decrypt(data.access_token as string) }
}

export interface SubmitArgs {
  name: string
  body: string
  sampleName: string
  /** Public https URL of the header image, if the campaign has one. */
  imageUrl?: string | null
  language?: string
}

/** Submits one Marketing template. Throws with Meta's own message if it is refused. */
export async function submitTemplate(db: Db, userId: string, a: SubmitArgs): Promise<{ status: LocalStatus; metaId: string }> {
  const { wabaId, accessToken } = await loadConfig(db, userId)
  const language = a.language ?? 'en_US'

  let headerMediaHandle: string | undefined
  if (a.imageUrl) {
    const appId = process.env.META_APP_ID
    if (!appId) throw new Error('Images need META_APP_ID to be set on the server.')
    const res = await fetch(a.imageUrl)
    if (!res.ok) throw new Error(`The campaign image could not be fetched (${res.status}).`)
    const mimeType = res.headers.get('content-type') || 'image/jpeg'
    headerMediaHandle = await uploadProfilePhoto({ appId, accessToken, fileBytes: await res.arrayBuffer(), mimeType, fileName: 'header.jpg' })
  }

  const result = await createTemplate({
    wabaId,
    accessToken,
    name: a.name,
    category: 'Marketing',
    language,
    bodyText: a.body,
    headerMediaFormat: headerMediaHandle ? 'IMAGE' : undefined,
    headerMediaHandle,
    footerText: FOOTER,
    sampleValues: [a.sampleName],
  })

  const status = localStatus(result.status)
  const row = {
    user_id: userId,
    name: a.name,
    category: 'Marketing',
    language,
    header_type: headerMediaHandle ? 'image' : null,
    header_content: headerMediaHandle ? a.imageUrl : null,
    body_text: a.body,
    footer_text: FOOTER,
    buttons: null,
    status,
    meta_template_id: result.id,
    updated_at: new Date().toISOString(),
  }
  const { data: existing } = await db.from('message_templates').select('id').eq('user_id', userId).eq('name', a.name).eq('language', language).maybeSingle()
  const { error } = existing?.id
    ? await db.from('message_templates').update(row).eq('id', existing.id)
    : await db.from('message_templates').insert(row)
  if (error) console.error('[campaign-agent] template saved at Meta but not locally:', error.message)
  return { status, metaId: result.id }
}

/** Meta's stated reason for a rejection, if it gives one. Never throws. */
export async function rejectionReason(db: Db, userId: string, name: string, language = 'en_US'): Promise<string | null> {
  try {
    const { data: t } = await db.from('message_templates').select('meta_template_id').eq('user_id', userId).eq('name', name).eq('language', language).maybeSingle()
    if (!t?.meta_template_id) return null
    const { accessToken } = await loadConfig(db, userId)
    const res = await fetch(`${GRAPH_BASE_URL}/${t.meta_template_id}?fields=rejected_reason,status`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) return null
    const j = (await res.json()) as { rejected_reason?: string }
    const r = (j.rejected_reason ?? '').trim()
    return r && r.toUpperCase() !== 'NONE' ? r : null
  } catch {
    return null
  }
}

// src/lib/agent/tools/media-tools.ts
//
// Lets the AI send rich media (images, PDFs, brochures, YouTube videos)
// during a conversation. The AI knows what media exists via context injection
// and calls send_media to surface the right item at the right moment.
//
// Used by: src/lib/agent/engine.ts

import { createClient } from '@supabase/supabase-js'

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

export interface MediaItem {
  id: string
  media_type: string
  title: string
  url: string
  description: string | null
  tags: string[] | null
}

export async function getAgentMedia(agentId: string): Promise<MediaItem[]> {
  try {
    const { data } = await db()
      .from('agent_media')
      .select('id, media_type, title, url, description, tags')
      .eq('agent_id', agentId)
    return data || []
  } catch (err) {
    console.error('[media] load error:', err)
    return []
  }
}

export function describeMediaForPrompt(media: MediaItem[]): string {
  if (media.length === 0) return ''
  const lines = media.map(
    (m) =>
      `- "${m.title}" (${m.media_type})${m.description ? ': ' + m.description : ''} [id: ${m.id}]`,
  )
  return `\n\n[Available media you can send with send_media — use the id]:\n${lines.join('\n')}`
}

export async function resolveMedia(
  agentId: string,
  idOrTitle: string,
): Promise<MediaItem | null> {
  try {
    const { data: byId } = await db()
      .from('agent_media')
      .select('id, media_type, title, url, description, tags')
      .eq('agent_id', agentId)
      .eq('id', idOrTitle)
      .maybeSingle()
    if (byId) return byId

    const { data: byTitle } = await db()
      .from('agent_media')
      .select('id, media_type, title, url, description, tags')
      .eq('agent_id', agentId)
      .ilike('title', `%${idOrTitle}%`)
      .limit(1)
      .maybeSingle()
    return byTitle || null
  } catch (err) {
    console.error('[media] resolve error:', err)
    return null
  }
}

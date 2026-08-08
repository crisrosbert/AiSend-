// src/lib/whatsapp-agent/deliver-media.ts
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
// The agent's media capability worked on the website widget and silently
// did nothing on WhatsApp.
//
// The engine resolves what to send and hands it back as `mediaToSend`.
// The widget route reads that array and renders it. Every WhatsApp
// caller — the general agent handler, the journey fallback, the ads
// agent — ignored it. So a real-estate agent asked for flat photos would
// say "here are the photos of the 3BHK" and send no photos at all.
//
// That is the same defect as the "one moment!" replies: the agent
// describing something that never happened. This is the delivery half
// that was missing.
//
// ── ON LINKS THAT ARE NOT FILES ──────────────────────────────────────
// A YouTube or Instagram URL is a web page, not a video file. Meta
// downloads whatever `link` points at, so sending a watch page as a
// video fails outright. Those go out as a text message with the URL —
// WhatsApp renders its own preview, which is what the customer wants
// anyway.

import {
  sendImageMessage,
  sendDocumentMessage,
  sendVideoMessage,
  sendTextMessage,
} from '@/lib/whatsapp/meta-api'
import type { MediaItem } from '@/lib/agent/tools/media-tools'

export interface DeliverMediaArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  media: MediaItem[]
}

export interface DeliveredMedia {
  item: MediaItem
  messageId: string | null
  /** How it actually went out, which is what belongs in the message log. */
  contentType: 'image' | 'document' | 'video' | 'text'
  /** Set when delivery failed; the caller decides whether to say so. */
  error?: string
}

/** File extensions Meta accepts as a real video upload. */
const VIDEO_FILE = /\.(mp4|3gp)(\?|$)/i

/**
 * Send each media item to the customer, in order.
 *
 * One item failing does not stop the rest — a broken brochure link
 * should not also cost the customer the floor plan. Every outcome comes
 * back so the caller can log what the customer actually received.
 */
export async function deliverAgentMedia(
  args: DeliverMediaArgs,
): Promise<DeliveredMedia[]> {
  const results: DeliveredMedia[] = []

  for (const item of args.media) {
    if (!item?.url) continue

    const base = {
      phoneNumberId: args.phoneNumberId,
      accessToken: args.accessToken,
      to: args.to,
    }
    // The title carries the context ("2BHK — living room"), so it earns
    // its place as the caption rather than arriving as a bare image.
    const caption = [item.title, item.description].filter(Boolean).join(' — ') || undefined

    try {
      const kind = classify(item)

      if (kind === 'image') {
        const sent = await sendImageMessage({ ...base, link: item.url, caption })
        results.push({ item, messageId: sent.messageId, contentType: 'image' })
      } else if (kind === 'document') {
        const sent = await sendDocumentMessage({
          ...base,
          link: item.url,
          caption,
          filename: toFilename(item.title),
        })
        results.push({ item, messageId: sent.messageId, contentType: 'document' })
      } else if (kind === 'video') {
        const sent = await sendVideoMessage({ ...base, link: item.url, caption })
        results.push({ item, messageId: sent.messageId, contentType: 'video' })
      } else {
        // A page, not a file. Send the link and let WhatsApp preview it.
        const sent = await sendTextMessage({
          ...base,
          text: caption ? `${caption}\n${item.url}` : item.url,
        })
        results.push({ item, messageId: sent.messageId, contentType: 'text' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[deliver-media] "${item.title}" failed:`, message)
      results.push({ item, messageId: null, contentType: 'text', error: message })
    }
  }

  return results
}

type MediaKind = 'image' | 'document' | 'video' | 'link'

/**
 * Decide how an item should travel. media_type is what the uploader
 * recorded, but the URL is the better authority when the two disagree —
 * a "video" row holding a youtube.com link is a page, whatever it says.
 */
function classify(item: MediaItem): MediaKind {
  const type = (item.media_type || '').toLowerCase()
  const url = item.url

  if (type === 'instagram') return 'link'
  if (type === 'video') return VIDEO_FILE.test(url) ? 'video' : 'link'
  if (type === 'pdf' || type === 'brochure' || type === 'document') return 'document'
  if (type === 'image') return 'image'

  // Unknown type — fall back to reading the URL.
  if (/\.(jpe?g|png|webp)(\?|$)/i.test(url)) return 'image'
  if (/\.pdf(\?|$)/i.test(url)) return 'document'
  if (VIDEO_FILE.test(url)) return 'video'
  return 'link'
}

/** WhatsApp shows this under a document, so it needs an extension. */
function toFilename(title: string): string {
  const clean = (title || 'document').replace(/[/\\?%*:|"<>]/g, '-').trim()
  return /\.[a-z0-9]{2,4}$/i.test(clean) ? clean : `${clean}.pdf`
}

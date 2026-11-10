import { parseVideoUrl } from '@/lib/video-embed'

/**
 * A video on a marketing page.
 *
 * Paste a link as `src` and it renders the right player: a YouTube,
 * Vimeo or Instagram Reel link becomes an embedded player, and a direct
 * .mp4 / .webm link becomes a native <video>. Leave `src` empty — or paste
 * something that is not a video — and it shows a clean "video coming soon"
 * panel with the video's title, the same way <ImageSlot> does for pictures.
 * Visitors never see developer instructions.
 *
 * No client JS: the link is parsed on the server and the page ships plain
 * markup. Iframes are `loading="lazy"`, so a video below the fold costs
 * nothing until the visitor scrolls to it.
 *
 * The props are unchanged so every existing caller keeps compiling.
 * `label` and `quiet` used to switch between a "paste a link" instruction
 * and the public version; there is now only the public version, so both
 * are accepted and ignored (label is used only if title is empty).
 */

interface VideoSlotProps {
  /** Video link: YouTube, Vimeo, Instagram Reel, or a direct video file. */
  src?: string
  /** Accessible name for the player, e.g. "WhatsApp API setup walkthrough". */
  title: string
  /** Kept for old callers. Used as the heading only when `title` is empty. */
  label?: string
  /** Optional poster image for a direct video file. */
  poster?: string
  /** 9:16 instead of 16:9 — for YouTube Shorts and Instagram Reels. */
  portrait?: boolean
  /** Kept for old callers. The public stand-in is now always used. */
  quiet?: boolean
}

export function VideoSlot({ src, title, label, poster, portrait }: VideoSlotProps) {
  const video = parseVideoUrl(src)
  const shape = portrait ? ' vidslot--portrait' : ''

  if (video.kind === 'iframe') {
    return (
      <div className={`vidslot is-loaded${shape}`}>
        <iframe
          className="vidslot__frame"
          src={video.src}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    )
  }

  if (video.kind === 'file') {
    return (
      <div className={`vidslot is-loaded${shape}`}>
        <video
          className="vidslot__frame"
          src={video.src}
          poster={poster || undefined}
          controls
          playsInline
          preload="metadata"
          aria-label={title}
        />
      </div>
    )
  }

  return (
    <div className={`vidslot${shape}`}>
      <div className="vidslot__ph">
        <span className="vidslot__badge" aria-hidden="true">
          <svg className="vidslot__icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 7.5v9l7.5-4.5z" />
          </svg>
        </span>
        <div className="vidslot__k">{title || label}</div>
        <div className="vidslot__d">Video coming soon</div>
      </div>
    </div>
  )
}

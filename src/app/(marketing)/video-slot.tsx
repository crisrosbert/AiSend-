import { parseVideoUrl } from '@/lib/video-embed'

/**
 * A video on a marketing page.
 *
 * Paste a link as `src` and it renders the right player: a YouTube or
 * Vimeo link becomes an embedded player, and a direct .mp4 / .webm link
 * becomes a native <video>. Leave `src` empty — or paste something that is
 * not a video — and it shows a labelled stand-in panel instead of a blank
 * box, the same way <ImageSlot> does for pictures.
 *
 * No client JS: the link is parsed on the server and the page ships plain
 * markup. Iframes are `loading="lazy"`, so a video below the fold costs
 * nothing until the visitor scrolls to it.
 */

interface VideoSlotProps {
  /** Paste the video link here: YouTube, Vimeo, or a direct video file. */
  src?: string
  /** Accessible name for the player, e.g. "WhatsApp API setup walkthrough". */
  title: string
  /** Shown on the stand-in panel, e.g. "Setup video". */
  label: string
  /** Optional poster image for a direct video file. */
  poster?: string
}

export function VideoSlot({ src, title, label, poster }: VideoSlotProps) {
  const video = parseVideoUrl(src)

  if (video.kind === 'iframe') {
    return (
      <div className="vidslot is-loaded">
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
      <div className="vidslot is-loaded">
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
    <div className="vidslot">
      <div className="vidslot__ph">
        <svg className="vidslot__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor" stroke="none" />
        </svg>
        <div className="vidslot__k">{label}</div>
        <div className="vidslot__d">
          Pass a YouTube, Vimeo or .mp4 link as <code>src</code>
        </div>
        <div className="vidslot__dim">16:9 · https links only</div>
      </div>
    </div>
  )
}

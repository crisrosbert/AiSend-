// src/lib/video-embed.ts
//
// Turns a pasted video link into something a page can safely render.
//
// The marketing pages take their videos as plain URLs, pasted in by hand.
// People paste whatever is in their address bar, so this accepts every
// common shape of a YouTube or Vimeo link, plus a direct file URL, and
// returns one of three things:
//
//   iframe — a YouTube / Vimeo embed URL, to put in an <iframe>
//   file   — a direct video file, to put in a <video> element
//   none   — empty or unusable, so the caller shows a placeholder
//
// Only https:// links are ever accepted. A pasted `javascript:` or `data:`
// URL must never reach an iframe or video src, and a plain http:// link
// would be blocked as mixed content on an https page anyway.

export type VideoSource =
  | { kind: 'iframe'; provider: 'youtube' | 'vimeo'; src: string }
  | { kind: 'file'; src: string }
  | { kind: 'none' }

const FILE_EXTENSIONS = /\.(mp4|webm|ogg|ogv|mov|m4v)$/i

// YouTube video ids are always 11 characters from this alphabet.
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

function parseUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')

  if (host === 'youtu.be') {
    const id = url.pathname.split('/')[1] ?? ''
    return YOUTUBE_ID.test(id) ? id : null
  }

  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v') ?? ''
      return YOUTUBE_ID.test(id) ? id : null
    }
    // /embed/ID, /shorts/ID, /live/ID, /v/ID
    const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/)
    if (match && YOUTUBE_ID.test(match[1])) return match[1]
  }

  return null
}

function vimeoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '')

  if (host === 'vimeo.com') {
    // vimeo.com/123456789 — and vimeo.com/channels/staffpicks/123456789
    const match = url.pathname.match(/\/(\d{6,})(?:\/|$)/)
    return match ? match[1] : null
  }

  if (host === 'player.vimeo.com') {
    const match = url.pathname.match(/^\/video\/(\d{6,})/)
    return match ? match[1] : null
  }

  return null
}

export function parseVideoUrl(raw: string | undefined | null): VideoSource {
  if (!raw || !raw.trim()) return { kind: 'none' }

  const url = parseUrl(raw)
  if (!url) return { kind: 'none' }

  const yt = youtubeId(url)
  if (yt) {
    return {
      kind: 'iframe',
      provider: 'youtube',
      // nocookie: no tracking cookies until the visitor presses play.
      // rel=0: related videos come from the same channel, not anyone's.
      src: `https://www.youtube-nocookie.com/embed/${yt}?rel=0`,
    }
  }

  const vm = vimeoId(url)
  if (vm) {
    return {
      kind: 'iframe',
      provider: 'vimeo',
      src: `https://player.vimeo.com/video/${vm}?dnt=1`,
    }
  }

  // Anything else must look like a real video file. A random web page
  // pasted by mistake would otherwise render as a blank player.
  if (FILE_EXTENSIONS.test(url.pathname)) {
    return { kind: 'file', src: url.toString() }
  }

  return { kind: 'none' }
}

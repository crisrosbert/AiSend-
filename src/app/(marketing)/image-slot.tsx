'use client'

import { useCallback, useState } from 'react'

/**
 * A picture on the landing page.
 *
 * Give it a `src` and it renders the image. Leave `src` empty — or point
 * it at a file that does not exist yet — and it shows a clean, designed
 * panel (soft green card with a small chat illustration and the picture's
 * description) instead of a broken-image icon or developer instructions.
 * A half-finished page therefore still looks deliberate to visitors.
 *
 * The props are unchanged so every existing caller keeps compiling.
 * `label` and `dimensions` used to be printed on the placeholder; they are
 * now optional and only kept so old calls do not break. Visitors never see
 * them.
 */

type Variant = 'bleed' | 'flush' | 'plain'

interface ImageSlotProps {
  /** Image URL, e.g. "/home/home-hero.webp". Everything else can stay as it is. */
  src?: string
  /** Describes the picture. Also the caption on the stand-in panel. */
  alt: string
  /** Kept for old callers. Used as the caption only when `alt` is empty. */
  label?: string
  /** Kept for old callers. Not shown. */
  dimensions?: string
  /**
   * bleed — sits flush against the bottom edge of a band
   * flush — fills the top of a card that has text underneath
   * plain — no card border, for a wide scene on a tinted background
   */
  variant?: Variant
  /** Height of the stand-in only; a loaded image sets its own height. */
  minHeight?: number
}

export function ImageSlot({ src, alt, label, variant, minHeight }: ImageSlotProps) {
  // Start as "no image" and only flip once one actually decodes, so a
  // blocked or missing file can never leave a broken icon on the page.
  const [loaded, setLoaded] = useState(false)

  // If the browser finished loading the picture before React took over
  // (cached image, fast network), onLoad never fires. This catches that.
  const imgRef = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true)
  }, [])

  const className = [
    'imgslot',
    variant ? `imgslot--${variant}` : '',
    loaded ? 'is-loaded' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const caption = alt || label || ''

  return (
    <div
      className={className}
      style={minHeight && !loaded ? { minHeight } : undefined}
      role={loaded ? undefined : 'img'}
      aria-label={loaded ? undefined : caption || undefined}
    >
      {src ? (
        // A plain <img> on purpose, not next/image. These URLs are pasted
        // in by hand and can point anywhere, and next/image refuses any
        // host missing from images.remotePatterns — which would mean
        // editing next.config every time a picture changes. The CSP
        // already allows https: images, so this works with no config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          className="imgslot__img"
          src={src}
          alt={alt}
          hidden={!loaded}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(false)}
        />
      ) : null}

      {!loaded && (
        <div className="imgslot__ph" aria-hidden="true">
          <svg className="imgslot__art" viewBox="0 0 240 150" fill="none">
            <rect x="20" y="10" width="200" height="130" rx="14" fill="#fff" stroke="#CFE6DA" />
            <rect x="20" y="10" width="200" height="26" rx="14" fill="#E8F4EE" />
            <rect x="20" y="24" width="200" height="12" fill="#E8F4EE" />
            <circle cx="36" cy="23" r="4" fill="#9DD4B8" />
            <circle cx="49" cy="23" r="4" fill="#BFE3D0" />
            <circle cx="62" cy="23" r="4" fill="#D7EEE1" />
            <rect x="36" y="48" width="96" height="22" rx="11" fill="#EEF3F0" />
            <rect x="108" y="78" width="96" height="22" rx="11" fill="#1B6B4A" />
            <rect x="36" y="108" width="70" height="18" rx="9" fill="#EEF3F0" />
            <rect x="46" y="55" width="52" height="5" rx="2.5" fill="#C9D6CF" />
            <rect x="120" y="85" width="60" height="5" rx="2.5" fill="#6FD9A0" />
          </svg>
          {caption ? <div className="imgslot__cap">{caption}</div> : null}
        </div>
      )}
    </div>
  )
}

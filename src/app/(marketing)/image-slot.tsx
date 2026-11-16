'use client'

import { useCallback, useState } from 'react'

/**
 * A picture on the landing page.
 *
 * Give it a `src` and it renders the image. Leave `src` empty — or point
 * it at a link that 404s — and it falls back to a labelled dashed panel
 * instead of a broken-image icon, so a half-finished page still reads as
 * deliberate rather than broken.
 */

type Variant = 'bleed' | 'flush' | 'plain'

interface ImageSlotProps {
  /** Paste the image URL here. Everything else can stay as it is. */
  src?: string
  alt: string
  /** Shown on the stand-in panel, e.g. "Hero image". */
  label: string
  /** Guidance shown on the stand-in, e.g. "1200 × 900 · PNG, JPG or WebP". */
  dimensions: string
  /**
   * bleed — sits flush against the bottom edge of a band
   * flush — fills the top of a card that has text underneath
   * plain — transparent, for a wide scene on a tinted background
   */
  variant?: Variant
  /** Height of the stand-in only; a loaded image sets its own height. */
  minHeight?: number
}

export function ImageSlot({
  src,
  alt,
  label,
  dimensions,
  variant,
  minHeight,
}: ImageSlotProps) {
  // Start as "no image" and only flip once one actually decodes, so a
  // blocked or missing file can never leave a broken icon on the page.
  const [loaded, setLoaded] = useState(false)

  // The server sends this <img> in the HTML and the browser starts fetching it
  // at once (the page even preloads it), so the picture can finish loading
  // BEFORE React has attached onLoad. That onLoad then never fires and the
  // placeholder stays up forever, even though the file is fine. A ref callback
  // runs when the element is attached, so we check for an image that is already
  // complete and decoded.
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth > 0) setLoaded(true)
  }, [])

  const className = [
    'imgslot',
    variant ? `imgslot--${variant}` : '',
    loaded ? 'is-loaded' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} style={minHeight && !loaded ? { minHeight } : undefined}>
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
        <div className="imgslot__ph">
          <div className="slot__k">{label}</div>
          <div className="slot__d">
            Pass the image URL as <code>src</code>
          </div>
          <div className="slot__dim">{dimensions}</div>
        </div>
      )}
    </div>
  )
}

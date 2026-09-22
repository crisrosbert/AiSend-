'use client'

import { useState } from 'react'

/**
 * The footer's promotional banner image. Renders the pasted-in banner once
 * it loads; falls back to a labelled dashed panel instead of a broken-image
 * icon when `src` is empty or the URL 404s — same pattern as the landing
 * page's ImageSlot, reimplemented here since the footer renders outside the
 * landing page's `.lp` CSS scope.
 */
export function FooterPromoBanner({
  href,
  src,
  alt,
}: {
  href: string
  src?: string
  alt: string
}) {
  const [loaded, setLoaded] = useState(false)

  return (
    <a className="block w-full mb-14" href={href}>
      {src ? (
        // Pasted-in URL, any host; next/image would need it added to remotePatterns.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="w-full h-auto rounded-2xl shadow-2xl border border-neutral-100"
          src={src}
          alt={alt}
          hidden={!loaded}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(false)}
        />
      ) : null}

      {!loaded && (
        <div className="w-full rounded-2xl border-2 border-dashed border-neutral-600 bg-neutral-900 flex flex-col items-center justify-center text-center px-6 py-16">
          <span className="text-sm font-semibold text-neutral-200">Promo banner image</span>
          <span className="text-xs mt-1 text-neutral-400">
            Pass the image URL as the banner&apos;s <code>src</code>
          </span>
          <span className="text-[11px] mt-1 text-neutral-500">Wide banner, e.g. 1600 × 400</span>
        </div>
      )}
    </a>
  )
}

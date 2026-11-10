'use client'

import { useCallback, useState } from 'react'

/**
 * The footer's promotional banner. Renders the banner picture once it
 * loads; until then (picture not added yet, or the file is missing) it
 * shows a designed call-to-action banner built from live text, so there is
 * never a broken-image icon or developer instructions on the page.
 *
 * Same idea as the landing page's ImageSlot, reimplemented here because the
 * footer renders outside the landing page's `.lp` CSS scope. Every prop that
 * existed before still works; `title` and `cta` are new and optional.
 */
export function FooterPromoBanner({
  href,
  src,
  alt,
  title = 'Your customers are already on WhatsApp.',
  cta = 'Start free',
}: {
  href: string
  src?: string
  /** Describes the banner picture (and is the link's name once it loads). */
  alt: string
  /** Headline of the fallback banner. */
  title?: string
  /** Button text of the fallback banner. */
  cta?: string
}) {
  const [loaded, setLoaded] = useState(false)

  // Catches a picture that finished loading before React took over.
  const imgRef = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true)
  }, [])

  return (
    <a className="block w-full mb-14" href={href} aria-label={loaded ? alt : undefined}>
      {src ? (
        // Pasted-in URL, any host; next/image would need it added to remotePatterns.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          className="w-full h-auto rounded-2xl shadow-2xl border border-neutral-100"
          src={src}
          alt={alt}
          hidden={!loaded}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(false)}
        />
      ) : null}

      {!loaded && (
        <div className="w-full rounded-2xl border border-emerald-900/60 bg-gradient-to-br from-[#0f3d2b] to-[#1B6B4A] px-6 py-12 sm:px-12 sm:py-14 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div>
            <span className="block text-xl sm:text-2xl font-extrabold tracking-tight text-[#fff]">
              {title}
            </span>
            <span className="block mt-2 text-sm sm:text-base text-emerald-100">
              Is your business reaching them there?
            </span>
          </div>
          <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-6 py-3 text-sm sm:text-base font-bold text-[#14523A] shadow-lg">
            {cta} <span className="ml-2" aria-hidden="true">→</span>
          </span>
        </div>
      )}
    </a>
  )
}

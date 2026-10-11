'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Icon, type IconName } from './icons'

export interface RailTool {
  href: string
  name: string
  text: string
  tag: string
  icon: IconName
}

/**
 * A horizontally scrolling row of cards. People on a touchpad swipe; everyone
 * else gets arrow buttons and dots, and the dots show where they are.
 */
export function ToolsRail({
  heading,
  intro,
  tools,
  openLabel,
  viewAllHref,
  viewAllLabel,
}: {
  heading: string
  intro: string
  tools: readonly RailTool[]
  openLabel: string
  viewAllHref: string
  viewAllLabel: string
}) {
  const rail = useRef<HTMLDivElement>(null)
  // `stops` is how many places the rail can rest at; `at` is the current one.
  const [pos, setPos] = useState({ stops: 1, at: 0 })

  /** Distance between the left edges of two neighbouring cards. */
  function stepOf(el: HTMLDivElement): number {
    const [first, second] = Array.from(el.children) as HTMLElement[]
    return second ? second.offsetLeft - first.offsetLeft : el.clientWidth
  }

  useEffect(() => {
    const el = rail.current
    if (!el) return
    const measure = () => {
      const step = stepOf(el)
      const max = el.scrollWidth - el.clientWidth
      const stops = max <= 1 || step <= 0 ? 1 : Math.ceil(max / step - 0.05) + 1
      const at = Math.min(stops - 1, Math.round(el.scrollLeft / step) || 0)
      setPos((prev) => (prev.stops === stops && prev.at === at ? prev : { stops, at }))
    }
    // Fires once when observing starts, which takes the first measurement.
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    el.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', measure)
    }
  }, [])

  function goTo(stop: number) {
    const el = rail.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: stop * stepOf(el), behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <section className="tl-section" aria-labelledby="tl-tools">
      <div className="tl-wrap">
        <div className="tl-railbar">
          <div className="tl-head tl-head--left" style={{ margin: 0 }}>
            <h2 id="tl-tools" className="tl-h2">{heading}</h2>
            <p className="tl-sub">{intro}</p>
          </div>
          {pos.stops > 1 && (
          <div className="tl-railbtns">
            <button type="button" className="tl-railbtn" onClick={() => goTo(Math.max(0, pos.at - 1))} aria-label="Previous tools">
              <Icon name="arrowLeft" size={19} />
            </button>
            <button type="button" className="tl-railbtn" onClick={() => goTo(Math.min(pos.stops - 1, pos.at + 1))} aria-label="Next tools">
              <Icon name="arrowRight" size={19} />
            </button>
          </div>
          )}
        </div>
        <div className="tl-rail" ref={rail} tabIndex={0} role="region" aria-label={heading}>
          {tools.map((t) => (
            <article key={t.href} className="tl-tool-card">
              <div className="tl-tool-card__band" aria-hidden="true">
                <span><Icon name={t.icon} size={28} /></span>
              </div>
              <span className="tl-tag-pill">{t.tag}</span>
              <h3>{t.name}</h3>
              <p>{t.text}</p>
              <Link className="tl-btn tl-btn--ghost tl-btn--sm" href={t.href}>
                {openLabel}
                <Icon name="arrowRight" size={16} />
                <span className="sr-only"> {t.name}</span>
              </Link>
            </article>
          ))}
        </div>
        <div className="tl-railfoot">
          {pos.stops > 1 && (
            <div className="tl-dots">
              {Array.from({ length: pos.stops }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className="tl-dotbtn"
                  aria-label={`Show tools, page ${i + 1} of ${pos.stops}`}
                  aria-current={i === pos.at}
                  onClick={() => goTo(i)}
                />
              ))}
            </div>
          )}
          <Link className="tl-btn tl-btn--primary" href={viewAllHref}>
            {viewAllLabel}
            <Icon name="arrowRight" size={18} />
          </Link>
        </div>
      </div>
    </section>
  )
}

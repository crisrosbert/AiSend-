'use client'

// "Where to put your link" — each card loads a ready-written message into the
// generator above (via a browser event, so the two stay independent) and
// scrolls to it. Clicking a card does something useful instead of just linking.

import { dispatchPreset } from '@/lib/tools/landing-config'
import { Icon, type IconName } from './icons'

export interface UseCase {
  icon: IconName
  title: string
  text: string
  /** Message loaded into the generator. */
  message: string
  /** Extra settings for tools with more than one field (see PresetDetail). */
  data?: Readonly<Record<string, string>>
}

export function UseCases({
  heading,
  intro,
  cases,
  actionLabel,
}: {
  heading: string
  intro: string
  cases: readonly UseCase[]
  actionLabel: string
}) {
  function use(message: string, data?: Readonly<Record<string, string>>) {
    dispatchPreset(message, data)
    const target = document.getElementById('generator')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <section className="tl-section" aria-labelledby="tl-cases">
      <div className="tl-wrap">
        <div className="tl-head">
          <h2 id="tl-cases" className="tl-h2">{heading}</h2>
          <p className="tl-sub">{intro}</p>
        </div>
        <div className="tl-cards">
          {cases.map((c) => (
            <article key={c.title} className="tl-card">
              <span className="tl-icon"><Icon name={c.icon} size={22} /></span>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
              <button type="button" className="tl-card__go" onClick={() => use(c.message, c.data)}>
                {actionLabel}
                <Icon name="arrowRight" size={17} />
                <span className="sr-only"> for {c.title}</span>
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

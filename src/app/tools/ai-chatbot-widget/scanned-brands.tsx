'use client'

import { useEffect, useState } from 'react'
import type { ScannedBrand } from '@/lib/tools/chatbot/scanned-sites'

function Bubble({ b, i, active }: { b: ScannedBrand; i: number; active: boolean }) {
  const [broken, setBroken] = useState(false)
  return (
    <li
      className={`sb-bubble${active ? ' sb-active' : ''}`}
      style={{ animationDelay: `${(i % 5) * -1.1}s`, animationDuration: `${6 + (i % 4)}s` }}
      title={b.name}
    >
      {b.demoId ? <a className="sb-link" href={`/tools/ai-chatbot-widget/demo/${b.demoId}`} aria-label={`Try the ${b.name} chatbot demo`} /> : null}
      <span className="sb-disc">
        {broken ? (
          <b>{b.name.charAt(0).toUpperCase()}</b>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.logoUrl} alt={`${b.name} logo`} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        )}
      </span>
      {active ? <span className="sb-tag">{b.host}{b.demoId ? ' · try demo' : ''}</span> : null}
    </li>
  )
}

export function ScannedBrands({ brands }: { brands: ScannedBrand[] }) {
  const [active, setActive] = useState(0)
  useEffect(() => {
    if (brands.length < 2) return
    const t = setInterval(() => setActive((a) => (a + 1) % brands.length), 2600)
    return () => clearInterval(t)
  }, [brands.length])

  // 4 / 3 / 3 staggered rows
  const rows = [brands.slice(0, 4), brands.slice(4, 7), brands.slice(7, 10)].filter((r) => r.length)
  let idx = -1
  return (
    <section className="sb-wrap" aria-labelledby="sb-h">
      <div className="sb-inner">
        <p className="sb-eyebrow">The brand wall</p>
        <h2 id="sb-h" className="sb-title">A chatbot for every brand</h2>
        <p className="sb-sub">Websites people are building a chatbot for with this free tool right now.</p>
        <div className="sb-rows">
          {rows.map((row, r) => (
            <ul key={r} className="sb-row" style={{ marginLeft: r % 2 ? 36 : 0 }}>
              {row.map((b) => {
                idx += 1
                return <Bubble key={b.host} b={b} i={idx} active={idx === active} />
              })}
            </ul>
          ))}
        </div>
        <p className="sb-note">
          Logos are read from each site's public pages. Demo links only appear when the person who scanned the site confirmed they may show it. Not yours? <a href="/tools/ai-chatbot-widget/remove" style={{ color: '#6ee7b7', textDecoration: 'underline' }}>Remove a site</a> instantly.
        </p>
      </div>
    </section>
  )
}

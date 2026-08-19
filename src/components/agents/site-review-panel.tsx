// src/components/agents/site-review-panel.tsx
//
// What we read from the website, shown for approval.
//
// ── WHY A PANEL AND NOT SILENT AUTO-FILL ─────────────────────────────
// The route already returned the business name, logo, greeting and
// suggested questions — and the drawer threw all of it away, keeping
// only the persona. That is the whole gap between "paste a URL and it
// builds your agent" and "paste a URL and get a text box back".
//
// But filling the fields silently would be worse than not filling them.
// Some of this is read verbatim from the site's own metadata (name,
// logo, colour) and some is written by a model (role, greeting,
// questions). The two deserve different trust, and the merchant is the
// only one who can tell whether "Kalosa Aesthetics" is the name they
// actually trade under.
//
// So: everything is shown, each item can be applied on its own, and
// nothing is saved until they press Save agent. Applying is one click
// per field and one for all of it, because a review step nobody can
// complete quickly is a review step people learn to skip.

'use client'

import { useState } from 'react'
import { Check, Globe, Sparkles, AlertCircle } from 'lucide-react'

export interface SiteBrand {
  name: string | null
  logoUrl: string | null
  description: string | null
  themeColor: string | null
}

export interface SiteFacts {
  business_name: string | null
  what_they_do: string | null
  services: string[]
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  hours: string | null
  role: string | null
  greeting: string | null
  suggested_questions: string[]
}

export interface CrawledPageSummary {
  url: string
  title: string
  words: number
}

export interface SiteReviewData {
  brand: SiteBrand
  facts: SiteFacts
  pages: CrawledPageSummary[]
  skipped: Array<{ url: string; reason: string }>
  truncated: boolean
  chunks: number
  title: string
}

export interface AppliedFields {
  name?: string
  avatarUrl?: string
  brandColor?: string
  greeting?: string
  suggestedQuestions?: string[]
  role?: string
}

interface Props {
  data: SiteReviewData
  /** Called with only the fields the merchant chose to apply. */
  onApply: (fields: AppliedFields) => void
  onDismiss: () => void
}

export function SiteReviewPanel({ data, onApply, onDismiss }: Props) {
  const { brand, facts, pages, skipped, truncated, chunks } = data
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [showPages, setShowPages] = useState(false)

  const name = brand.name ?? facts.business_name
  const questions = facts.suggested_questions ?? []

  function markApplied(key: string, fields: AppliedFields) {
    onApply(fields)
    setApplied((prev) => new Set(prev).add(key))
  }

  function applyEverything() {
    const fields: AppliedFields = {}
    if (name) fields.name = name
    if (brand.logoUrl) fields.avatarUrl = brand.logoUrl
    if (brand.themeColor) fields.brandColor = brand.themeColor
    if (facts.greeting) fields.greeting = facts.greeting
    if (facts.role) fields.role = facts.role
    if (questions.length) fields.suggestedQuestions = questions

    onApply(fields)
    setApplied(new Set(['name', 'logo', 'colour', 'greeting', 'role', 'questions']))
  }

  // A crawl that read one page is not a failure, but it is worth saying:
  // it usually means the site is one page, or its links are rendered by
  // JavaScript. Either way the agent knows less than the merchant thinks.
  const thin = pages.length === 1

  return (
    <div className="srp">
      <div className="srp-head">
        <Sparkles size={15} />
        <strong>Here&rsquo;s what we found</strong>
        <span className="srp-count">
          {pages.length} page{pages.length === 1 ? '' : 's'} · {chunks} passage
          {chunks === 1 ? '' : 's'}
        </span>
        <button type="button" className="srp-dismiss" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>

      {/* ── Identity: read from the site, not generated ── */}
      <div className="srp-identity">
        {brand.logoUrl ? (
          // Not next/image: this is an arbitrary third-party URL that
          // has not been added to the remotePatterns allowlist, and a
          // logo that fails to load must not break the panel.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoUrl}
            alt=""
            className="srp-logo"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div className="srp-logo srp-logo-empty"><Globe size={18} /></div>
        )}

        <div className="srp-identity-text">
          <div className="srp-name">{name ?? 'Name not found'}</div>
          {facts.role && <div className="srp-role">{facts.role}</div>}
          {brand.description && <div className="srp-desc">{brand.description}</div>}
        </div>
      </div>

      <Row
        label="Agent name"
        value={name}
        done={applied.has('name')}
        onApply={() => name && markApplied('name', { name })}
      />

      <Row
        label="Avatar"
        value={brand.logoUrl ? 'Logo from your site' : null}
        done={applied.has('logo')}
        onApply={() => brand.logoUrl && markApplied('logo', { avatarUrl: brand.logoUrl })}
      />

      {brand.themeColor && (
        <Row
          label="Brand colour"
          value={brand.themeColor}
          swatch={brand.themeColor}
          done={applied.has('colour')}
          onApply={() => markApplied('colour', { brandColor: brand.themeColor! })}
        />
      )}

      <Row
        label="Greeting"
        value={facts.greeting}
        done={applied.has('greeting')}
        onApply={() => facts.greeting && markApplied('greeting', { greeting: facts.greeting })}
      />

      {/* ── Suggested questions ── */}
      {questions.length > 0 && (
        <div className="srp-row srp-row-block">
          <div className="srp-row-head">
            <span className="srp-label">Suggested questions</span>
            <ApplyButton
              done={applied.has('questions')}
              onClick={() => markApplied('questions', { suggestedQuestions: questions })}
            />
          </div>
          <div className="srp-chips">
            {questions.map((question) => (
              <span key={question} className="srp-chip">{question}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Business details: not applied to the agent, but worth showing.
          These are what the agent will answer FROM, so seeing them wrong
          here is the cheapest possible moment to catch a bad crawl. ── */}
      {(facts.phone || facts.hours || facts.address || facts.services.length > 0) && (
        <div className="srp-facts">
          {facts.phone && <Fact label="Phone" value={facts.phone} />}
          {facts.hours && <Fact label="Hours" value={facts.hours} />}
          {facts.address && <Fact label="Address" value={facts.address} />}
          {facts.services.length > 0 && (
            <Fact label="Services" value={facts.services.join(' · ')} />
          )}
        </div>
      )}

      {/* ── Honest reporting about the crawl itself ── */}
      {thin && (
        <div className="srp-warn">
          <AlertCircle size={13} />
          Only one page could be read. If your site has more, its links may be
          built by JavaScript — add key pages by hand under Knowledge.
        </div>
      )}

      {truncated && (
        <div className="srp-warn">
          <AlertCircle size={13} />
          We stopped at {pages.length} pages. Re-train from a deeper page to
          reach the rest.
        </div>
      )}

      <div className="srp-actions">
        <button type="button" className="srp-apply-all" onClick={applyEverything}>
          Use all of this
        </button>
        <button
          type="button"
          className="srp-link"
          onClick={() => setShowPages((v) => !v)}
        >
          {showPages ? 'Hide' : 'Show'} pages read
        </button>
      </div>

      {showPages && (
        <ul className="srp-pages">
          {pages.map((page) => (
            <li key={page.url}>
              <span className="srp-page-title">{page.title}</span>
              <span className="srp-page-meta">{page.words} words</span>
            </li>
          ))}
          {skipped.map((item) => (
            <li key={item.url} className="srp-page-skipped">
              <span className="srp-page-title">{item.url}</span>
              <span className="srp-page-meta">{item.reason}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="srp-note">
        Nothing is saved until you press <strong>Save agent</strong>. The name,
        logo and colour are read from your site; the greeting and questions were
        written by AI from your pages — read them before you save.
      </p>
    </div>
  )
}

function Row({
  label, value, done, onApply, swatch,
}: {
  label: string
  value: string | null
  done: boolean
  onApply: () => void
  swatch?: string
}) {
  if (!value) return null
  return (
    <div className="srp-row">
      <span className="srp-label">{label}</span>
      <span className="srp-value">
        {swatch && <i className="srp-swatch" style={{ background: swatch }} />}
        {value}
      </span>
      <ApplyButton done={done} onClick={onApply} />
    </div>
  )
}

function ApplyButton({ done, onClick }: { done: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={done ? 'srp-btn srp-btn-done' : 'srp-btn'}
      onClick={onClick}
      disabled={done}
    >
      {done ? <><Check size={12} /> Added</> : 'Use'}
    </button>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="srp-fact">
      <span className="srp-fact-label">{label}</span>
      <span className="srp-fact-value">{value}</span>
    </div>
  )
}

// src/components/agents/site-review-panel.tsx
//
// What we read from the website, shown for approval — and editable
// before it is applied.
//
// ── WHY EDITABLE, NOT JUST APPROVABLE ────────────────────────────────
// The first version offered each field as take-it-or-leave-it. That is
// the wrong shape for this data, because most of what comes back is
// 90% right: the name has a stray word, one of three questions is off,
// the logo resolved to a favicon when a better image exists. "Leave
// it" then means retyping the whole thing somewhere else, and a review
// step that costs more than doing it by hand gets skipped.
//
// So every applied field is an input pre-filled with what we found.
// Use applies whatever is in the box, not what the crawl said. The
// distinction that still matters — read from the site versus written
// by a model — is kept in the footnote rather than in what you are
// allowed to touch.
//
// Nothing here writes to the database. Applying copies into the
// drawer's local state; Save agent is still the only thing that
// persists.

'use client'

import { useState } from 'react'
import { Check, Globe, Sparkles, AlertCircle, X, Plus, RotateCcw } from 'lucide-react'

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
  /** Called with only the fields chosen, carrying any edits made here. */
  onApply: (fields: AppliedFields) => void
  onDismiss: () => void
}

/** Three slots, so a removed question leaves a gap to type into. */
const QUESTION_SLOTS = 3

export function SiteReviewPanel({ data, onApply, onDismiss }: Props) {
  const { brand, facts, pages, skipped, truncated, chunks } = data

  // What the crawl said. Kept separate from the draft so "reset" can
  // put it back after an edit goes wrong.
  const found = {
    name: brand.name ?? facts.business_name ?? '',
    avatarUrl: brand.logoUrl ?? '',
    greeting: facts.greeting ?? '',
    role: facts.role ?? '',
    questions: (facts.suggested_questions ?? []).slice(0, QUESTION_SLOTS),
  }

  const [name, setName] = useState(found.name)
  const [avatarUrl, setAvatarUrl] = useState(found.avatarUrl)
  const [greeting, setGreeting] = useState(found.greeting)
  const [role, setRole] = useState(found.role)
  const [questions, setQuestions] = useState<string[]>(found.questions)

  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [showPages, setShowPages] = useState(false)
  const [logoBroken, setLogoBroken] = useState(false)

  // An edit un-marks the row: "Added" must never sit next to a value
  // different from the one that was added.
  function edit(key: string, set: (value: string) => void) {
    return (value: string) => {
      set(value)
      setApplied((prev) => {
        if (!prev.has(key)) return prev
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  function markApplied(key: string, fields: AppliedFields) {
    onApply(fields)
    setApplied((prev) => new Set(prev).add(key))
  }

  const liveQuestions = questions.map((q) => q.trim()).filter(Boolean)

  function applyEverything() {
    const fields: AppliedFields = {}
    if (name.trim()) fields.name = name.trim()
    if (avatarUrl.trim()) fields.avatarUrl = avatarUrl.trim()
    if (brand.themeColor) fields.brandColor = brand.themeColor
    if (greeting.trim()) fields.greeting = greeting.trim()
    if (role.trim()) fields.role = role.trim()
    if (liveQuestions.length) fields.suggestedQuestions = liveQuestions

    onApply(fields)
    setApplied(new Set(['name', 'logo', 'colour', 'greeting', 'role', 'questions']))
  }

  function setQuestion(index: number, value: string) {
    setQuestions((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
    setApplied((prev) => {
      if (!prev.has('questions')) return prev
      const next = new Set(prev)
      next.delete('questions')
      return next
    })
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

      {/* ── Live preview of the agent as configured right now ──
          Updates as the fields below are edited, so the effect of a
          change is visible without saving and opening the widget. */}
      <div className="srp-identity">
        {avatarUrl && !logoBroken ? (
          // Not next/image: an arbitrary third-party URL that is not in
          // the remotePatterns allowlist, and it must be allowed to fail
          // without breaking the panel.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="srp-logo"
            onError={() => setLogoBroken(true)}
            onLoad={() => setLogoBroken(false)}
          />
        ) : (
          <div className="srp-logo srp-logo-empty"><Globe size={18} /></div>
        )}

        <div className="srp-identity-text">
          <div className="srp-name">{name || 'Name not found'}</div>
          {role && <div className="srp-role">{role}</div>}
          {brand.description && <div className="srp-desc">{brand.description}</div>}
        </div>
      </div>

      <EditRow
        label="Agent name"
        value={name}
        onChange={edit('name', setName)}
        original={found.name}
        placeholder="What the agent is called"
        done={applied.has('name')}
        onApply={() => name.trim() && markApplied('name', { name: name.trim() })}
      />

      <EditRow
        label="Role"
        value={role}
        onChange={edit('role', setRole)}
        original={found.role}
        placeholder="e.g. Customer support for Asort"
        done={applied.has('role')}
        onApply={() => role.trim() && markApplied('role', { role: role.trim() })}
      />

      <EditRow
        label="Avatar URL"
        value={avatarUrl}
        onChange={(value) => { setLogoBroken(false); edit('logo', setAvatarUrl)(value) }}
        original={found.avatarUrl}
        placeholder="https://yoursite.com/logo.png"
        done={applied.has('logo')}
        onApply={() => avatarUrl.trim() && markApplied('logo', { avatarUrl: avatarUrl.trim() })}
        // Said plainly rather than left to a broken preview: the crawler
        // falls back to /favicon.ico, which is 32px and looks poor
        // enlarged into a chat header.
        hint={
          logoBroken
            ? "That image didn't load — check the address."
            : /favicon\.ico$/i.test(avatarUrl)
              ? 'This is the site favicon, usually quite small. A logo file will look better.'
              : undefined
        }
      />

      <EditRow
        label="Greeting"
        value={greeting}
        onChange={edit('greeting', setGreeting)}
        original={found.greeting}
        placeholder="The first thing a visitor reads"
        multiline
        done={applied.has('greeting')}
        onApply={() => greeting.trim() && markApplied('greeting', { greeting: greeting.trim() })}
      />

      {/* ── Suggested questions ── */}
      <div className="srp-row srp-row-block">
        <div className="srp-row-head">
          <span className="srp-label">Suggested questions</span>
          <ApplyButton
            done={applied.has('questions')}
            disabled={liveQuestions.length === 0}
            onClick={() => markApplied('questions', { suggestedQuestions: liveQuestions })}
          />
        </div>

        <div className="srp-questions">
          {questions.map((question, index) => (
            <div className="srp-q" key={index}>
              <input
                className="srp-input"
                value={question}
                placeholder="A question a customer would actually ask"
                onChange={(e) => setQuestion(index, e.target.value)}
              />
              <button
                type="button"
                className="srp-q-remove"
                aria-label="Remove question"
                onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== index))}
              >
                <X size={13} />
              </button>
            </div>
          ))}

          {questions.length < QUESTION_SLOTS && (
            <button
              type="button"
              className="srp-q-add"
              onClick={() => setQuestions((prev) => [...prev, ''])}
            >
              <Plus size={13} /> Add a question
            </button>
          )}
        </div>

        <p className="srp-q-note">
          Ask what a customer would ask, in their words. Only include
          questions your pages can answer — a chip that leads nowhere teaches
          a visitor on their first click that the chat is not worth using.
        </p>
      </div>

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
        logo and colour were read from your site; the role, greeting and
        questions were written by AI from your pages — read those before you
        save.
      </p>
    </div>
  )
}

/**
 * One editable field with its own Use button.
 *
 * The reset arrow only appears once the value differs from what was
 * found. A control that is always visible but usually does nothing is
 * noise; one that appears when it becomes useful is a hint.
 */
function EditRow({
  label, value, onChange, original, placeholder, done, onApply, multiline, hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  original: string
  placeholder?: string
  done: boolean
  onApply: () => void
  multiline?: boolean
  hint?: string
}) {
  const changed = value !== original && original !== ''

  return (
    <div className="srp-row srp-row-block">
      <div className="srp-row-head">
        <span className="srp-label">{label}</span>
        <div className="srp-row-tools">
          {changed && (
            <button
              type="button"
              className="srp-reset"
              onClick={() => onChange(original)}
              title="Put back what we found"
              aria-label="Reset to the value we found"
            >
              <RotateCcw size={12} />
            </button>
          )}
          <ApplyButton done={done} disabled={!value.trim()} onClick={onApply} />
        </div>
      </div>

      {multiline ? (
        <textarea
          className="srp-input srp-textarea"
          rows={2}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="srp-input"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {hint && <p className="srp-field-hint">{hint}</p>}
    </div>
  )
}

function ApplyButton({
  done, onClick, disabled,
}: {
  done: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={done ? 'srp-btn srp-btn-done' : 'srp-btn'}
      onClick={onClick}
      disabled={done || disabled}
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

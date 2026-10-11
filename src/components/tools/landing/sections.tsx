// Server-rendered sections of a free-tool landing page. Each one takes its
// copy and media as props, so the next /tools/* page reuses the layout and
// supplies its own words.

import Link from 'next/link'
import { VideoSlot } from '@/app/(marketing)/video-slot'
import { formatPostDate, type PostMeta } from '@/lib/blog/posts'
import { teamWhatsAppLink } from '@/lib/tools/landing-config'
import { Icon, type IconName } from './icons'
import { LeadForm } from './lead-form'

/* ── Why use it: copy on the left, Reels / Shorts on the right ────────── */

export interface Benefit {
  icon: IconName
  title: string
  text: string
}

export function WhyUse({
  heading,
  intro,
  benefits,
  reels,
}: {
  heading: string
  intro: string
  benefits: readonly Benefit[]
  /** Paste a YouTube Short or Instagram Reel link as `src` to fill a slot. */
  reels: readonly { src?: string; title: string }[]
}) {
  return (
    <section className="tl-section" aria-labelledby="tl-why">
      <div className="tl-wrap tl-split">
        <div>
          <h2 id="tl-why" className="tl-h2">{heading}</h2>
          <p className="tl-sub">{intro}</p>
          <ul className="tl-benefits">
            {benefits.map((b) => (
              <li key={b.title} className="tl-benefit">
                <span className="tl-icon"><Icon name={b.icon} size={22} /></span>
                <div>
                  <h3>{b.title}</h3>
                  <p>{b.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="tl-reels">
          {reels.map((r) => (
            <div key={r.title} className="tl-reel">
              <VideoSlot portrait quiet src={r.src} title={r.title} label="Short or Reel" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── How it works: three steps joined by arrows that keep moving ──────── */

export interface Step {
  title: string
  text: string
  sample: { kind: 'number' | 'message' | 'link'; text: string }
}

const SAMPLE_ICON: Record<Step['sample']['kind'], IconName> = {
  number: 'phone',
  message: 'chat',
  link: 'link',
}

export function Workflow({ heading, intro, steps }: { heading: string; intro: string; steps: readonly Step[] }) {
  return (
    <section className="tl-section tl-section--tint" aria-labelledby="tl-flow">
      <div className="tl-wrap">
        <div className="tl-head">
          <h2 id="tl-flow" className="tl-h2">{heading}</h2>
          <p className="tl-sub">{intro}</p>
        </div>
        <ol className="tl-steps">
          {steps.map((s, i) => (
            <li key={s.title} className="tl-step">
              <span className="tl-node" aria-hidden="true">{i + 1}</span>
              {i < steps.length - 1 && (
                <span className="tl-track" aria-hidden="true"><i className="tl-dot" /></span>
              )}
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <div
                className={`tl-mini${s.sample.kind === 'link' ? ' tl-mini--mono' : ''}${s.sample.kind === 'message' ? ' tl-mini--bubble' : ''}`}
                aria-hidden="true"
              >
                {s.sample.kind !== 'message' && <Icon name={SAMPLE_ICON[s.sample.kind]} size={18} />}
                <span>{s.sample.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ── Banner: one clear reason to start a WhatsApp chat with the team ──── */

export function CtaBanner({
  heading,
  text,
  label,
  message,
}: {
  heading: string
  text: string
  label: string
  /** First message of the chat the button opens. */
  message: string
}) {
  return (
    <section className="tl-section tl-section--tight" aria-label="Talk to the team">
      <div className="tl-wrap">
        <div className="tl-banner">
          <div className="tl-banner__text">
            <span className="tl-banner__icon"><Icon name="chat" size={30} /></span>
            <div>
              <h2>{heading}</h2>
              <p>{text}</p>
            </div>
          </div>
          <a className="tl-btn tl-btn--white" href={teamWhatsAppLink(message)} target="_blank" rel="noopener noreferrer">
            <Icon name="chat" size={19} />
            {label}
          </a>
        </div>
      </div>
    </section>
  )
}

/* ── Beyond the link: what the product adds ───────────────────────────── */

export interface Feature {
  icon: IconName
  title: string
  text: string
}

export function BeyondLink({
  heading,
  intro,
  features,
  ctaLabel,
  ctaHref,
  moreLabel,
  moreHref,
}: {
  heading: string
  intro: string
  features: readonly Feature[]
  ctaLabel: string
  ctaHref: string
  moreLabel: string
  moreHref: string
}) {
  return (
    <section className="tl-section" aria-labelledby="tl-beyond">
      <div className="tl-wrap tl-split">
        <div>
          <h2 id="tl-beyond" className="tl-h2">{heading}</h2>
          <p className="tl-sub">{intro}</p>
          <ul className="tl-features">
            {features.map((f) => (
              <li key={f.title} className="tl-feature">
                <span className="tl-icon"><Icon name={f.icon} size={22} /></span>
                <div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="tl-beyond-cta">
            <Link className="tl-btn tl-btn--primary" href={ctaHref}>{ctaLabel}</Link>
            <Link className="tl-textlink" href={moreHref}>
              {moreLabel}
              <Icon name="arrowRight" size={17} />
            </Link>
          </div>
        </div>

        <div className="tl-mock" aria-hidden="true">
          <div className="tl-mock__pane">
            <div className="tl-mock__title">Inbox</div>
            {[
              { i: 'A', n: 'Aarav', m: 'Is this still in stock?', unread: true },
              { i: 'M', n: 'Meera', m: 'Thanks, received it!', unread: false },
              { i: 'K', n: 'Kabir', m: 'Can I see a demo?', unread: true },
            ].map((c) => (
              <div key={c.n} className="tl-convo">
                <span className="tl-avatar">{c.i}</span>
                <div><b>{c.n}</b><span>{c.m}</span></div>
                {c.unread && <i className="tl-unread" />}
              </div>
            ))}
          </div>
          <div className="tl-mock__pane tl-chat">
            <div className="tl-mock__title">Aarav</div>
            <div className="tl-bubble tl-bubble--in">Hi! Could you send the price list?</div>
            <span className="tl-tag"><Icon name="bot" size={13} />AI reply</span>
            <div className="tl-bubble">Of course, sending it now. Anything else I can help with?</div>
          </div>
          <div className="tl-mock__cap">Sample conversation</div>
        </div>
      </div>
    </section>
  )
}

/* ── Two videos side by side ──────────────────────────────────────────── */

export interface VideoItem {
  src?: string
  title: string
  /** Shown under the video when set, e.g. a customer's name. */
  caption?: string
  detail?: string
}

export function VideoRow({
  heading,
  intro,
  videos,
}: {
  heading: string
  intro: string
  videos: readonly VideoItem[]
}) {
  return (
    <section className="tl-section tl-section--tint" aria-labelledby="tl-videos">
      <div className="tl-wrap">
        <div className="tl-head">
          <h2 id="tl-videos" className="tl-h2">{heading}</h2>
          <p className="tl-sub">{intro}</p>
        </div>
        <div className="tl-videos">
          {videos.map((v) => (
            <div key={v.title} className="tl-video">
              <VideoSlot quiet src={v.src} title={v.title} label="Video" />
              {v.caption && <h3>{v.caption}</h3>}
              {v.detail && <p>{v.detail}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Reviews: only ever real ones ─────────────────────────────────────── */

export interface Review {
  quote: string
  name: string
  role?: string
  /** 1–5. Omit to show no stars. */
  rating?: 1 | 2 | 3 | 4 | 5
}

export function Reviews({
  heading,
  intro,
  reviews,
  inviteHeading,
  inviteText,
  inviteLabel,
  inviteMessage,
}: {
  heading: string
  intro: string
  reviews: readonly Review[]
  inviteHeading: string
  inviteText: string
  inviteLabel: string
  inviteMessage: string
}) {
  return (
    <section className="tl-section" aria-labelledby="tl-reviews">
      <div className="tl-wrap">
        <div className="tl-head">
          <h2 id="tl-reviews" className="tl-h2">{heading}</h2>
          {reviews.length > 0 && <p className="tl-sub">{intro}</p>}
        </div>

        {reviews.length > 0 ? (
          <div className="tl-reviews">
            {reviews.map((r) => (
              <figure key={`${r.name}-${r.quote.slice(0, 12)}`} className="tl-review" style={{ margin: 0 }}>
                {r.rating && (
                  <div className="tl-stars" role="img" aria-label={`${r.rating} out of 5 stars`}>
                    {Array.from({ length: r.rating }, (_, i) => <Icon key={i} name="star" size={18} />)}
                  </div>
                )}
                <blockquote>&ldquo;{r.quote}&rdquo;</blockquote>
                <figcaption>
                  <b>{r.name}</b>
                  {r.role && <span>{r.role}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="tl-invite">
            <span className="tl-icon"><Icon name="star" size={22} /></span>
            <h3 style={{ fontSize: 22, fontWeight: 700 }}>{inviteHeading}</h3>
            <p>{inviteText}</p>
            <a className="tl-btn tl-btn--ghost" href={teamWhatsAppLink(inviteMessage)} target="_blank" rel="noopener noreferrer">
              <Icon name="chat" size={18} />
              {inviteLabel}
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

/* ── Related articles ─────────────────────────────────────────────────── */

export function RelatedPosts({ heading, intro, posts }: { heading: string; intro: string; posts: readonly PostMeta[] }) {
  if (posts.length === 0) return null
  return (
    <section className="tl-section tl-section--tint" aria-labelledby="tl-posts">
      <div className="tl-wrap">
        <div className="tl-head">
          <h2 id="tl-posts" className="tl-h2">{heading}</h2>
          <p className="tl-sub">{intro}</p>
        </div>
        <div className="tl-posts">
          {posts.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="tl-post">
              <div className="tl-post__band"><span className="tl-post__cat">{p.category}</span></div>
              <div className="tl-post__body">
                <h3>{p.title}</h3>
                <p>{p.description}</p>
                <span className="tl-post__meta">{formatPostDate(p.date)}, {p.readingMinutes} min read</span>
                <span className="tl-post__more">Read article <Icon name="arrowRight" size={16} /></span>
              </div>
            </Link>
          ))}
        </div>
        <div className="tl-center">
          <Link className="tl-btn tl-btn--ghost" href="/blog">View all articles</Link>
        </div>
      </div>
    </section>
  )
}

/* ── FAQ ──────────────────────────────────────────────────────────────── */

export interface FaqItem {
  q: string
  a: string
  /** Optional checklist shown under the answer. */
  points?: readonly string[]
}

export function Faq({ heading, items }: { heading: string; items: readonly FaqItem[] }) {
  return (
    <section className="tl-section" aria-labelledby="tl-faq">
      <div className="tl-wrap">
        <div className="tl-faq">
          <h2 id="tl-faq">{heading}</h2>
          {items.map((f, i) => (
            <details key={f.q} className="tl-q" open={i === 0}>
              <summary>
                <span>{f.q}</span>
                <span className="tl-q__icon">
                  <Icon name="plus" size={16} strokeWidth={2.4} className="plus" />
                  <Icon name="minus" size={16} strokeWidth={2.4} className="minus" />
                </span>
              </summary>
              <div className="tl-q__a">
                <p>{f.a}</p>
                {f.points && (
                  <ul>
                    {f.points.map((pt) => <li key={pt}>{pt}</li>)}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Lead section ─────────────────────────────────────────────────────── */

export function LeadSection({
  heading,
  intro,
  points,
  formId,
  sourceLabel,
  whatsappLabel,
  whatsappMessage,
  displayNumber,
}: {
  heading: string
  intro: string
  points: readonly string[]
  /** Identifies which page the lead came from in the CRM. */
  formId: string
  /** Names the page in the WhatsApp message the visitor sends us. */
  sourceLabel: string
  whatsappLabel: string
  whatsappMessage: string
  displayNumber: string
}) {
  return (
    <section className="tl-section tl-section--tint" id="talk-to-us" aria-labelledby="tl-lead" style={{ scrollMarginTop: 110 }}>
      <div className="tl-wrap tl-lead">
        <div>
          <h2 id="tl-lead" className="tl-h2">{heading}</h2>
          <p className="tl-sub">{intro}</p>
          <ul className="tl-lead__points">
            {points.map((p) => (
              <li key={p}>
                <Icon name="check" size={20} strokeWidth={2.4} />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className="tl-lead__alt">
            <a className="tl-btn tl-btn--primary" href={teamWhatsAppLink(whatsappMessage)} target="_blank" rel="noopener noreferrer">
              <Icon name="chat" size={19} />
              {whatsappLabel}
            </a>
            <span className="tl-lead__num">{displayNumber}</span>
          </div>
        </div>
        <LeadForm formId={formId} sourceLabel={sourceLabel} />
      </div>
    </section>
  )
}

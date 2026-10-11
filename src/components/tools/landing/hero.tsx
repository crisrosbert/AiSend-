import { Icon } from './icons'
import { teamWhatsAppLink } from '@/lib/tools/landing-config'

interface ToolHeroProps {
  badge: string
  title: string
  lead: string
  primaryLabel: string
  /** In-page anchor of the tool, e.g. "#generator". */
  primaryHref: string
  secondaryLabel: string
  /** First message of the "talk to us" WhatsApp button. */
  whatsappMessage: string
  proof: readonly string[]
}

/**
 * Left: what the tool does and the two ways in (use it, or talk to us).
 * Right: a phone showing the end result — a chat that started from a link.
 * The sample number, link and messages are illustrative.
 */
export function ToolHero({
  badge,
  title,
  lead,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  whatsappMessage,
  proof,
}: ToolHeroProps) {
  return (
    <section className="tl-hero gradient-hero-bg">
      <div className="tl-wrap">
        <div className="tl-hero__grid">
          <div>
            <span className="tl-pill">
              <Icon name="chat" size={16} />
              {badge}
            </span>
            <h1>{title}</h1>
            <p className="tl-hero__lead">{lead}</p>
            <div className="tl-hero__cta">
              <a className="tl-btn tl-btn--primary" href={primaryHref}>
                {primaryLabel}
              </a>
              <a
                className="tl-btn tl-btn--ghost"
                href={teamWhatsAppLink(whatsappMessage)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="chat" size={18} />
                {secondaryLabel}
              </a>
            </div>
            <ul className="tl-proof">
              {proof.map((p) => (
                <li key={p}>
                  <Icon name="check" size={17} strokeWidth={2.4} />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="tl-stage" aria-hidden="true">
            <svg className="tl-curve" viewBox="0 0 480 470" preserveAspectRatio="xMidYMid meet">
              <defs>
                <marker id="tl-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M1 1 9 5 1 9" fill="none" stroke="#1B6B4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </marker>
              </defs>
              <path d="M170 388 C 290 420, 372 350, 352 262" markerEnd="url(#tl-arrow)" />
            </svg>

            <div className="tl-chip tl-chip--a">
              <Icon name="phone" size={18} />
              +91 98765 43210
            </div>
            <div className="tl-chip tl-chip--b tl-chip--mono">
              <Icon name="link" size={17} />
              wa.me/919876543210
            </div>

            <div className="tl-phone">
              <div className="tl-phone__head">
                <span className="tl-phone__avatar">
                  <Icon name="store" size={17} />
                </span>
                <div>
                  <div className="tl-phone__name">Your business</div>
                  <div className="tl-phone__status">online</div>
                </div>
              </div>
              <div className="tl-phone__body">
                <span className="tl-day">Today</span>
                <div className="tl-bubble">
                  Hi! I&apos;d like to know more about your services.
                  <div className="tl-bubble__meta">
                    10:42 <Icon name="ticks" size={14} strokeWidth={2.2} />
                  </div>
                </div>
                <div className="tl-bubble tl-bubble--in">
                  Hello! Thanks for getting in touch. How can we help?
                  <div className="tl-bubble__meta">10:42</div>
                </div>
              </div>
              <div className="tl-phone__foot">
                <span className="tl-phone__input">Message</span>
                <span className="tl-phone__send">
                  <Icon name="send" size={16} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

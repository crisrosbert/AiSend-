import type { CSSProperties } from 'react'
import Link from 'next/link'
import { FooterPromoBanner } from './footer-promo-banner'

/**
 * globals.css sets `h1,h2,h3,h4 { color; font-family; letter-spacing }`
 * outside any `@layer`, which — per the CSS cascade-layers spec — beats
 * ANY Tailwind utility class (Tailwind's own utilities are layered), no
 * matter how specific. Column headings use <h3>, so those three
 * properties have to be set inline to actually take effect here.
 */
const H3_STYLE: CSSProperties = {
  color: '#fff',
  fontFamily: "'Inter', sans-serif",
  letterSpacing: '0.025em',
}

const LINK = 'hover:text-[#fff] transition-colors duration-150'

/**
 * The shared marketing footer — home, every /tools page, and the legal
 * pages. Wrapped in its own Inter font-family so it doesn't inherit the
 * dashboard's Plus Jakarta Sans / Sora.
 *
 * Every link points at a page that exists today. The earlier version
 * carried links to pages that were never built (About us, Press, Careers,
 * Industries, Help Center, Case Studies, Status, social profiles…) and
 * third-party rating badges (G2, Capterra, Trustpilot, GDPR, Meta partner)
 * that nobody has verified. Those were removed rather than left as dead or
 * unproven. When a real page or a real verified badge exists, add it back
 * here.
 */
export function SiteFooter() {
  return (
    <footer
      className="relative w-full bg-[#1c1c1c] text-neutral-300 pt-10 pb-6 border-t border-neutral-800"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12">
        <FooterPromoBanner
          href="/signup"
          src="/home/footer-banner.webp"
          alt="Your customers are already on WhatsApp. Is your business reaching them there? Start Your Free WhatsApp Campaign."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-y-10 gap-x-8 text-[13px] pt-2 pb-12">
          {/* Column 1: Brand */}
          <div className="lg:col-span-4 pr-0 lg:pr-8">
            <div className="mb-4">
              <Link aria-label="AiSend Home" className="inline-block" href="/">
                <div className="flex items-baseline space-x-0.5">
                  <span className="text-xl md:text-[22px] font-black tracking-tight text-[#fff] uppercase">
                    AISEND
                  </span>
                </div>
                <p className="text-[9px] tracking-[0.22em] text-neutral-300 uppercase font-medium mt-[-2px]">
                  WhatsApp Marketing &amp; Automation
                </p>
              </Link>
            </div>

            <p className="text-neutral-400 leading-relaxed text-[13px] mb-6 max-w-sm">
              AiSend is a multi-tenant WhatsApp marketing platform built for growing businesses. We
              help you automate broadcasts, run chatbots, and turn conversations into conversions —
              all from one dashboard.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span className="inline-flex items-center gap-2 rounded border border-emerald-900/60 bg-[#075E54] px-3 h-9 text-[11px] font-semibold text-[#fff]">
                <svg className="w-3.5 h-3.5 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.52 3.48A11.94 11.94 0 0 0 12.04 0C5.5 0 .2 5.3.2 11.84c0 2.09.55 4.13 1.6 5.93L0 24l6.38-1.67a11.86 11.86 0 0 0 5.66 1.44h.01c6.53 0 11.83-5.3 11.83-11.84 0-3.16-1.23-6.13-3.36-8.45z" />
                </svg>
                Built on the WhatsApp Business API
              </span>
            </div>
          </div>

          {/* Column 2: Product */}
          <div className="lg:col-span-2 space-y-2">
            <h3 className="text-sm font-semibold mb-3" style={H3_STYLE}>Product</h3>
            <ul className="space-y-2 text-neutral-400">
              <li><Link className={LINK} href="/signup">WhatsApp Broadcast Campaigns</Link></li>
              <li><Link className={LINK} href="/signup">Chatbot &amp; Automation</Link></li>
              <li><Link className={LINK} href="/signup">Shared Team Inbox</Link></li>
              <li><Link className={LINK} href="/signup">CRM &amp; Contacts</Link></li>
              <li><Link className={LINK} href="/tools/whatsapp-template-generator">Template Generator</Link></li>
              <li><Link className={LINK} href="/tools/whatsapp-catalog-builder">Catalog Builder</Link></li>
              <li><Link className={LINK} href="/signup">Analytics</Link></li>
              <li><Link className={LINK} href="/whatsapp-business-api">WhatsApp Business API</Link></li>
            </ul>
          </div>

          {/* Column 3: Free tools */}
          <div className="lg:col-span-2 space-y-2">
            <h3 className="text-sm font-semibold mb-3" style={H3_STYLE}>Free Tools</h3>
            <ul className="space-y-2 text-neutral-400">
              <li><Link className={LINK} href="/tools">All Free Tools</Link></li>
              <li><Link className={LINK} href="/tools/whatsapp-link-generator">WhatsApp Link Generator</Link></li>
              <li><Link className={LINK} href="/tools/whatsapp-qr-code">WhatsApp QR Code</Link></li>
              <li><Link className={LINK} href="/tools/whatsapp-roi-calculator">WhatsApp ROI Calculator</Link></li>
              <li><Link className={LINK} href="/tools/whatsapp-bulk-sender">WhatsApp Bulk Sender</Link></li>
              <li><Link className={LINK} href="/tools/ai-chatbot-widget">AI Chatbot Widget</Link></li>
            </ul>
          </div>

          {/* Column 4: Resources */}
          <div className="lg:col-span-2 space-y-2">
            <h3 className="text-sm font-semibold mb-3" style={H3_STYLE}>Resources</h3>
            <ul className="space-y-2 text-neutral-400">
              <li><Link className={LINK} href="/blog">Blog</Link></li>
              <li><Link className={LINK} href="/whatsapp-business-api">WhatsApp Business API Guide</Link></li>
              <li><Link className={LINK} href="/#pricing">Pricing</Link></li>
              <li><Link className={LINK} href="/#faq">FAQs</Link></li>
            </ul>
          </div>

          {/* Column 5: Company */}
          <div className="lg:col-span-2 space-y-2">
            <h3 className="text-sm font-semibold mb-3" style={H3_STYLE}>Company</h3>
            <ul className="space-y-2 text-neutral-400">
              <li><Link className={LINK} href="/contact">Contact Us</Link></li>
              <li><Link className={LINK} href="/privacy">Privacy Policy</Link></li>
              <li><Link className={LINK} href="/terms">Terms of Service</Link></li>
              <li><Link className={LINK} href="/data-deletion">Data Deletion</Link></li>
            </ul>
          </div>
        </div>

        {/* Contact row */}
        <div className="pt-6 pb-6 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <a
            aria-label="Chat with AiSend on WhatsApp"
            className="inline-flex items-center gap-2 rounded bg-[#25D366] hover:opacity-90 px-3 h-8 text-xs font-semibold text-[#fff] transition-opacity"
            href="https://wa.me/918796437535"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.52 3.48A11.94 11.94 0 0 0 12.04 0C5.5 0 .2 5.3.2 11.84c0 2.09.55 4.13 1.6 5.93L0 24l6.38-1.67a11.86 11.86 0 0 0 5.66 1.44h.01c6.53 0 11.83-5.3 11.83-11.84 0-3.16-1.23-6.13-3.36-8.45z" />
            </svg>
            Chat on WhatsApp
          </a>
        </div>

        {/* Legal row */}
        <div className="pt-5 border-t border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 gap-4">
          <p className="text-center sm:text-left">
            Copyright © {new Date().getFullYear()} AiSend. All rights reserved.
          </p>
          <div className="flex items-center space-x-3 text-neutral-400">
            <a className="hover:text-[#fff] transition-colors" href="/sitemap.xml">Sitemap</a>
            <span className="text-neutral-600" aria-hidden="true">|</span>
            <Link className="hover:text-[#fff] transition-colors" href="/privacy">Privacy Policy</Link>
            <span className="text-neutral-600" aria-hidden="true">|</span>
            <Link className="hover:text-[#fff] transition-colors" href="/terms">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

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

/**
 * The shared marketing footer — home, every /tools page, and the legal
 * pages. Reproduces the user-supplied design exactly (copy, badges and
 * third-party ratings included) with real Tailwind utility classes, so no
 * separate stylesheet is needed. Wrapped in its own Inter font-family so it
 * doesn't inherit the dashboard's Plus Jakarta Sans / Sora.
 *
 * Links that map to a real route are wired to it; every other link in the
 * source design (Blog, FAQs, Help Center, About us, the Services/Industries
 * columns, etc.) points at a page that doesn't exist yet and is left as "#"
 * exactly as given.
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
          alt="Your customers are already on WhatsApp. Is your business reaching them there? Start Your Free WhatsApp Campaign."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-y-10 gap-x-8 text-[13px] pt-2 pb-12">
          {/* Column 1: Brand + partner badges */}
          <div className="lg:col-span-4 pr-0 lg:pr-8">
            <div className="mb-4">
              <Link aria-label="AiSend Home" className="inline-block" href="/">
                <div className="flex items-baseline space-x-0.5">
                  <span className="text-xl md:text-[22px] font-black tracking-tight text-[#fff] uppercase">
                    AISEND
                  </span>
                  <span className="text-[10px] text-[#fff] font-bold align-super">®</span>
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
              {/* Meta Business Partner badge */}
              <div className="bg-white rounded p-1.5 px-2.5 flex items-center shadow-sm h-11 border border-neutral-300">
                <div className="flex items-center space-x-1.5">
                  <svg className="w-4 h-4" fill="#0866FF" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 5 3.66 9.15 8.44 9.9v-7H7.9V12h2.54V9.8c0-2.5 1.49-3.9 3.77-3.9 1.09 0 2.23.2 2.23.2v2.45h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.9h-2.34v7C18.34 21.15 22 17 22 12c0-5.52-4.48-10-10-10z" />
                  </svg>
                  <div className="text-[9px] leading-tight text-neutral-800 font-semibold">
                    <span>Meta Business</span>
                    <br />
                    <span className="text-[7.5px] uppercase font-bold text-neutral-600 tracking-wider">
                      Solution Partner
                    </span>
                  </div>
                </div>
              </div>

              {/* WhatsApp Business API badge */}
              <div className="bg-[#075E54] text-[#fff] rounded p-1 px-2 flex items-center space-x-1.5 h-11 border border-emerald-900/60 shadow-sm">
                <div className="w-3.5 h-3.5 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.52 3.48A11.94 11.94 0 0 0 12.04 0C5.5 0 .2 5.3.2 11.84c0 2.09.55 4.13 1.6 5.93L0 24l6.38-1.67a11.86 11.86 0 0 0 5.66 1.44h.01c6.53 0 11.83-5.3 11.83-11.84 0-3.16-1.23-6.13-3.36-8.45zM12.05 21.6a9.8 9.8 0 0 1-4.99-1.37l-.36-.21-3.78.99 1.01-3.68-.23-.38a9.77 9.77 0 0 1-1.5-5.19c0-5.4 4.4-9.79 9.8-9.79 2.62 0 5.08 1.02 6.93 2.87a9.72 9.72 0 0 1 2.87 6.92c0 5.4-4.4 9.79-9.75 9.84z" />
                  </svg>
                </div>
                <div className="text-left leading-tight">
                  <span className="text-[7px] text-gray-300 font-medium block">Official</span>
                  <span className="text-[10px] font-bold text-[#fff] tracking-tight">WhatsApp API</span>
                </div>
              </div>

              {/* G2 rating badge */}
              <div className="bg-[#1f1f1f] text-[#fff] rounded p-1.5 px-3 flex flex-col justify-center h-11 border border-neutral-700/60">
                <div className="flex items-center space-x-1">
                  <span className="text-sm font-black tracking-tight text-[#fff]">G2</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-[10px] font-bold text-[#fff] leading-none">4.6</span>
                  <div className="flex text-[#ff5a36] text-[9px] space-x-0.5">
                    <span>★</span>
                    <span>★</span>
                    <span>★</span>
                    <span>★</span>
                    <span>★</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Our Services */}
          <div className="lg:col-span-2 space-y-2">
            <h3 className="text-sm font-semibold mb-3" style={H3_STYLE}>Our Services</h3>
            <ul className="space-y-2 text-neutral-400">
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">WhatsApp Broadcast Campaigns</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Chatbot &amp; Automation</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Multi-Agent Live Chat</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">CRM &amp; Contact Management</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Template Message Manager</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Catalog &amp; Commerce on WhatsApp</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Analytics &amp; Reporting</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">API &amp; Integrations</a></li>
            </ul>
          </div>

          {/* Column 3: Company + Tools */}
          <div className="lg:col-span-2 space-y-2">
            <h3 className="text-sm font-semibold mb-3" style={H3_STYLE}>Company</h3>
            <ul className="space-y-2 text-neutral-400 mb-6">
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">About us</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Press Releases</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Careers</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Partner Program</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Customer Stories</a></li>
            </ul>
            <h3 className="text-sm font-semibold pt-2 mb-3" style={H3_STYLE}>Tools</h3>
            <ul className="space-y-2 text-neutral-400">
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">WhatsApp ROI Calculator</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Message Cost Calculator</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Broadcast List Builder</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">API Documentation</a></li>
            </ul>
          </div>

          {/* Column 4: Industries */}
          <div className="lg:col-span-2 space-y-2">
            <h3 className="text-sm font-semibold mb-3" style={H3_STYLE}>Industries</h3>
            <ul className="space-y-2 text-neutral-400">
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">E-commerce &amp; D2C</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Healthcare</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Education</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Real Estate</a></li>
            </ul>
          </div>

          {/* Column 5: Quick Links */}
          <div className="lg:col-span-2 space-y-2">
            <h3 className="text-sm font-semibold mb-3" style={H3_STYLE}>Quick Links</h3>
            <ul className="space-y-2 text-neutral-400">
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Blog</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">FAQs</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Help Center</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Case Studies</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Testimonials</a></li>
              <li><Link className="hover:text-[#fff] transition-colors duration-150" href="/#pricing">Pricing</Link></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">WhatsApp Marketing Guide</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Integrations</a></li>
              <li><a className="hover:text-[#fff] transition-colors duration-150" href="#">Status</a></li>
              <li><Link className="hover:text-[#fff] transition-colors duration-150" href="/contact">Contact Us</Link></li>
            </ul>
          </div>
        </div>

        {/* Social links + third-party ratings */}
        <div className="pt-6 pb-6 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-3">
            <a aria-label="Facebook" className="w-7 h-7 rounded bg-[#1877f2] hover:opacity-90 flex items-center justify-center text-[#fff] transition-opacity" href="#">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M9.198 21.5h4v-8.01h3.604l.396-3.98h-4V7.5c0-.988.243-1.49 1.455-1.49H17.2V2.32c-.59-.08-1.57-.22-3.085-.22-3.14 0-5.117 1.88-5.117 5.17v2.24H6v3.98h3.198v8.01z" />
              </svg>
            </a>
            <a aria-label="X (formerly Twitter)" className="w-7 h-7 rounded bg-[#0f1419] border border-neutral-700 hover:bg-neutral-800 flex items-center justify-center text-[#fff] transition-colors" href="#">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a aria-label="YouTube" className="w-7 h-7 rounded bg-[#ff0000] hover:opacity-90 flex items-center justify-center text-[#fff] transition-opacity" href="#">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
            <a aria-label="LinkedIn" className="w-7 h-7 rounded bg-[#0a66c2] hover:opacity-90 flex items-center justify-center text-[#fff] transition-opacity" href="#">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76c.86 0 1.55-.7 1.55-1.56 0-.85-.69-1.55-1.55-1.55a1.56 1.56 0 0 0-1.56 1.55c0 .86.7 1.56 1.56 1.56m1.39 9.74v-8.37H5.07v8.37h2.78z" />
              </svg>
            </a>
            <a aria-label="WhatsApp" className="w-7 h-7 rounded bg-[#25D366] hover:opacity-90 flex items-center justify-center text-[#fff] transition-opacity" href="#">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M20.52 3.48A11.94 11.94 0 0 0 12.04 0C5.5 0 .2 5.3.2 11.84c0 2.09.55 4.13 1.6 5.93L0 24l6.38-1.67a11.86 11.86 0 0 0 5.66 1.44h.01c6.53 0 11.83-5.3 11.83-11.84 0-3.16-1.23-6.13-3.36-8.45z" />
              </svg>
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-neutral-200">
            <div className="flex items-center space-x-1.5 bg-neutral-900/60 px-2 py-1 rounded border border-neutral-800">
              <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center p-0.5 shadow-sm">
                <span className="text-[8px] font-black text-orange-600">G2</span>
              </div>
              <span>4.6/5 rating</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-neutral-900/60 px-2 py-1 rounded border border-neutral-800">
              <span className="w-4 h-4 rounded-full bg-white text-black font-extrabold flex items-center justify-center text-[10px] leading-none">C</span>
              <span>4.5 rating</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-neutral-900/60 px-2 py-1 rounded border border-neutral-800">
              <span className="w-4 h-4 rounded-full bg-[#00b67a] text-[#fff] font-extrabold flex items-center justify-center text-[10px] leading-none">T</span>
              <span>4.4/5 rating</span>
            </div>
            <div className="flex items-center bg-white text-neutral-800 rounded px-1.5 py-0.5 text-[10px] font-bold border border-neutral-300">
              <div className="w-3.5 h-4 bg-[#25D366] rounded-sm mr-1 flex items-center justify-center text-[#fff] text-[8px]">
                🔒
              </div>
              <div className="leading-none text-left">
                <span className="text-neutral-900 font-extrabold text-[11px]">GDPR</span>
                <br />
                <span className="text-[7.5px] uppercase font-semibold text-neutral-600">Compliant</span>
              </div>
            </div>
          </div>
        </div>

        {/* Legal row */}
        <div className="pt-5 border-t border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 gap-4">
          <p className="text-center sm:text-left">
            Copyright © {new Date().getFullYear()} AiSend<sup>®</sup>. All rights reserved.
          </p>
          <div className="flex items-center space-x-3 text-neutral-400">
            <a className="hover:text-[#fff] transition-colors" href="#">Sitemap</a>
            <span className="text-neutral-600">|</span>
            <Link className="hover:text-[#fff] transition-colors" href="/privacy">Privacy Policy</Link>
            <span className="text-neutral-600">|</span>
            <Link className="hover:text-[#fff] transition-colors" href="/terms">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

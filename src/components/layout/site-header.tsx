'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * Shared header for every public page (home, /tools/*, /privacy, /terms,
 * /contact). Reproduces the user-supplied reference design exactly.
 *
 * Two changes from the source markup, both load-bearing rather than
 * cosmetic:
 *  - `text-white` is written as `text-[#fff]` throughout. globals.css has
 *    a legacy `.text-white{color:var(--ink)!important}` rule (a holdover
 *    from re-theming the dashboard) that silently turns white text dark;
 *    the bracket form is a distinct Tailwind class name, so it isn't
 *    caught by that rule. Same issue, same fix, as the footer.
 *  - The reference's hamburger button had no mobile panel behind it. This
 *    adds one, since a dead button on every phone-width visit isn't a
 *    design choice, it's a bug the mockup didn't get to.
 *
 * Contact links reuse the same channels already public on /contact
 * (src/app/contact/contact-content.tsx) instead of the reference's
 * Techmagnate phone/email, and Login/Start for FREE point at this app's
 * own /login and /signup instead of a competitor's app — per the user's
 * explicit answer when this file was implemented.
 */

const NAV_LABELS = ['Company', 'Our Services', 'Our Work', 'Industry', 'Insights']

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header
      className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Utility bar */}
      <div className="hidden sm:block w-full border-b border-gray-200 bg-[#f4f9fc] text-gray-700 text-sm font-medium">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-end h-10 gap-6">
          <a
            className="inline-flex items-center gap-2 text-gray-800 hover:text-[#1B6B4A] transition-colors"
            href="https://wa.me/918796437535"
          >
            <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-medium text-gray-800">+91 87964 37535</span>
          </a>
          <a
            className="inline-flex items-center gap-2 text-gray-800 hover:text-[#1B6B4A] transition-colors"
            href="mailto:crisrosbert@gmail.com"
          >
            <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-medium text-gray-800">crisrosbert@gmail.com</span>
          </a>
          <Link
            className="inline-flex items-center gap-2 text-[#fff] px-5 h-full font-semibold transition-colors bg-[#1B6B4A] hover:bg-[#14523A]"
            href="/contact"
          >
            <span className="font-bold tracking-tight">Request a Call</span>
            <span className="text-sm font-bold">→</span>
          </Link>
        </div>
      </div>

      {/* Main nav */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link aria-label="AiSend Home" className="flex items-center focus:outline-none" href="/">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#1B6B4A] to-[#6FD9A0] flex items-center justify-center text-[#fff] shadow-md shadow-[#1B6B4A]/25">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </div>
              <div className="flex items-center text-2xl font-black tracking-tight select-none">
                <span className="text-[#1B6B4A]">AI</span>
                <span className="text-emerald-950 ml-0.5">SEND</span>
                <span className="w-2 h-2 rounded-full bg-[#1B6B4A] ml-0.5 mt-1.5 inline-block" />
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-gray-700">
            {NAV_LABELS.map((label) => (
              <div key={label} className="relative group cursor-pointer py-2">
                <span className="flex items-center gap-1 hover:text-[#1B6B4A] transition-colors text-gray-800 font-medium text-base">
                  {label}
                  <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#1B6B4A] transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </span>
              </div>
            ))}
            <a className="hover:text-[#1B6B4A] text-gray-800 font-medium transition-colors py-2 text-base" href="#">Blog</a>
            <Link className="hover:text-[#1B6B4A] text-gray-800 font-medium transition-colors py-2 text-base" href="/contact">Contact</Link>
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center gap-1 text-sm font-medium text-gray-600 cursor-pointer hover:text-emerald-600 px-2 py-1">
            <span>Eng</span>
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </div>
          <Link className="text-sm font-semibold text-gray-700 hover:text-emerald-600 px-3 py-2 transition-colors" href="/login">
            Login
          </Link>
          <Link
            className="hidden sm:inline-flex items-center justify-center bg-[#1B6B4A] hover:bg-[#14523A] text-[#fff] text-sm font-medium px-5 py-2.5 rounded-lg shadow-sm hover:shadow transition-all duration-150"
            href="/signup"
          >
            Start for FREE
          </Link>
          <button
            aria-expanded={mobileOpen}
            aria-label="Toggle Navigation"
            className="md:hidden p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
            onClick={() => setMobileOpen((v) => !v)}
            type="button"
          >
            {mobileOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M4 6h16M4 12h16m-7 6h7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 sm:px-6 py-4 space-y-1">
          {NAV_LABELS.map((label) => (
            <span key={label} className="block px-2 py-2.5 text-gray-500 font-medium text-base">
              {label}
            </span>
          ))}
          <a className="block px-2 py-2.5 text-gray-800 font-medium text-base hover:text-[#1B6B4A]" href="#">Blog</a>
          <Link className="block px-2 py-2.5 text-gray-800 font-medium text-base hover:text-[#1B6B4A]" href="/contact" onClick={() => setMobileOpen(false)}>
            Contact
          </Link>
          <div className="pt-3 mt-2 border-t border-gray-100 flex flex-col gap-2">
            <Link className="text-center text-sm font-semibold text-gray-700 px-3 py-2.5 rounded-lg border border-gray-200" href="/login" onClick={() => setMobileOpen(false)}>
              Login
            </Link>
            <Link className="text-center bg-[#1B6B4A] hover:bg-[#14523A] text-[#fff] text-sm font-medium px-5 py-2.5 rounded-lg shadow-sm" href="/signup" onClick={() => setMobileOpen(false)}>
              Start for FREE
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import '../(marketing)/landing.css'

export const metadata: Metadata = {
  title: 'Free WhatsApp Tools',
  description:
    'Free WhatsApp tools for businesses — link generators, QR codes, and more. No signup required.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://app.performancemktg.net/tools' },
}

const TOOLS = [
  {
    href: '/tools/whatsapp-link-generator',
    name: 'WhatsApp Link Generator',
    desc: 'Create a free click-to-chat wa.me link with a QR code, in your browser.',
    tag: 'Click-to-chat',
  },
  {
    href: '/tools/whatsapp-bulk-sender',
    name: 'WhatsApp Bulk Sender',
    desc: 'Send templated WhatsApp messages to thousands of contacts, officially.',
    tag: 'Official API',
  },
  {
    href: '/tools/whatsapp-qr-code',
    name: 'WhatsApp QR Code',
    desc: 'Download a scannable QR code for your WhatsApp number.',
    tag: 'Print-ready',
  },
  {
    href: '/tools/whatsapp-text-formatter',
    name: 'WhatsApp Text Formatter',
    desc: 'Bold, italic, strikethrough, and bullets — with a live chat preview.',
    tag: 'Editor',
  },
]

export default function ToolsIndexPage() {
  return (
    <>
      <div className="lp" style={{ fontFamily: "'Inter', sans-serif" }}>
        <SiteHeader />

        <section className="relative pt-16 pb-16 md:pt-20 md:pb-20 overflow-hidden gradient-hero-bg">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 shadow-sm text-xs sm:text-sm font-semibold text-emerald-950 mb-6">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#1B6B4A]" />
              </span>
              <span>Free forever — no signup required</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Free WhatsApp tools</h1>
            <p className="mt-4 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              No signup, no app install — just useful things for a business running on WhatsApp.
            </p>
          </div>
        </section>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 -mt-6 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {TOOLS.map((t) => (
              <Link
                key={t.name}
                href={t.href}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-200 p-7"
              >
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#14523A] mb-4">
                  {t.tag}
                </span>
                <h2 className="text-xl font-bold">{t.name}</h2>
                <p className="mt-2 text-sm sm:text-base text-gray-600 leading-relaxed">{t.desc}</p>
                <span className="mt-5 inline-flex items-center text-sm font-bold text-[#1B6B4A]">
                  Try it free <span className="ml-1.5">→</span>
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-16 bg-[#1B6B4A] rounded-3xl px-8 py-12 sm:px-14 sm:py-14 text-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#fff]">
              Like these? The full platform does a lot more.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-emerald-100 max-w-xl mx-auto">
              Broadcasts, automations, a shared team inbox, and payments in chat — all on the official WhatsApp API.
            </p>
            <Link
              href="/signup"
              className="mt-7 inline-flex items-center justify-center bg-[#fff] hover:bg-emerald-50 text-[#1B6B4A] font-bold text-base px-8 py-3.5 rounded-xl shadow-lg transition-colors"
            >
              Start free — no card <span className="ml-2">→</span>
            </Link>
          </div>
        </main>
      </div>
      <SiteFooter />
    </>
  )
}

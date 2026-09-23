import type { Metadata } from 'next'
import Link from 'next/link'
import { CatalogExtractorTool } from './catalog-extractor-tool'
import { ImageSlot } from '@/app/(marketing)/image-slot'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import '../../(marketing)/landing.css'

export const metadata: Metadata = {
  title: 'Free WhatsApp Catalogue Builder — Find Your Products Automatically',
  description:
    'Paste your store URL and get a ready-to-send WhatsApp product list — name, price, and photo for every item. Works on Shopify, WooCommerce, and most online stores. Free, no signup.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://app.performancemktg.net/tools/whatsapp-catalog-builder' },
}

const SOURCES = [
  {
    t: "Shopify's own product feed",
    d: 'Every Shopify store publishes a public product list at /products.json — when we find one, it\'s the richest source: every price, no guessing.',
  },
  {
    t: 'Structured product data (schema.org)',
    d: 'The same markup Google reads to show a price under your listing in search results. Works on WooCommerce, Magento, and most stores built with SEO in mind.',
  },
  {
    t: 'Open Graph product tags',
    d: 'A thinner fallback for sites with neither of the above — still enough to pull a name, price, and photo for the link preview WhatsApp itself would show.',
  },
]

const USE_CASES = [
  { t: "Moving your catalogue to WhatsApp for the first time", d: "Skip retyping every product by hand — paste your URL, copy the list, paste it into a broadcast or a catalogue message." },
  { t: 'Agencies onboarding a new client', d: "Get a client's product list in seconds during a call instead of asking them to export a spreadsheet." },
  { t: 'A store with no Shopify or API access', d: "Works from the public website alone — nothing to connect, no store credentials needed." },
  { t: 'Quick-checking what a competitor sells', d: 'A fast way to see a store\'s current range and pricing without browsing page by page.' },
]

const FAQS = [
  {
    q: 'How does this find my products without connecting to my store?',
    a: "It reads your store's own public pages the same way Google does — either your platform's public product feed (Shopify), structured data your pages already publish for search engines (schema.org), or the preview tags WhatsApp itself reads when a link is shared. No login, no API key, no app to install.",
  },
  {
    q: 'Which platforms does this work on?',
    a: "Best on Shopify (its product feed is public by default) and any store that marks up its product pages for search engines — most WooCommerce, Magento, and hand-built stores that care about SEO do. A store with none of these won't return results.",
  },
  {
    q: 'Why did it find 0 products?',
    a: "Either the page you pasted isn't a store front page or product page, or the site doesn't publish any of the three data sources this tool reads. Try pasting a specific product page instead of the homepage, or a category/collection page.",
  },
  {
    q: 'Is this the same as WhatsApp\'s own Catalog feature?',
    a: "No — WhatsApp's built-in Catalog lives inside WhatsApp Business and is set up separately. This tool just gets your product list out of your website fast, so you're not retyping it by hand while setting that up (or building a broadcast message).",
  },
  {
    q: 'Is anything I paste here saved?',
    a: 'No. The URL is read once, for this request, and nothing about the search — the URL, the products found, or your session — is stored afterwards.',
  },
  {
    q: 'Does this include every product in my store?',
    a: "It stops after a reasonable number of products or a time limit, whichever comes first — meant as a fast preview, not a full inventory export. For very large catalogues, run it against a specific category page to get products from that section.",
  },
  {
    q: 'Can I use the prices it finds directly?',
    a: 'Treat them as a starting point — double-check against your store before sending anything to customers, since a site occasionally lists a sale price or a from-price that this tool reads at face value.',
  },
]

export default function WhatsAppCatalogBuilderPage() {
  return (
    <>
      <div className="lp" style={{ fontFamily: "'Inter', sans-serif" }}>
        <SiteHeader />

        <section className="relative pt-16 pb-16 md:pt-20 md:pb-24 overflow-hidden gradient-hero-bg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              <div className="lg:col-span-7 flex flex-col items-start text-left">
                <span className="inline-block px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#14523A] mb-5">
                  Free tool · No signup
                </span>
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.12]">
                  Turn your store into a WhatsApp catalogue
                </h1>
                <p className="mt-5 text-base sm:text-lg text-gray-600 max-w-xl leading-relaxed">
                  Paste your store&apos;s URL. We find your products — name, price, photo — and turn them into a
                  ready-to-send WhatsApp list. No signup, nothing saved.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs sm:text-sm font-medium text-gray-500">
                  <span>✓ No signup required</span>
                  <span>✓ Works on Shopify, WooCommerce &amp; more</span>
                  <span>✓ Nothing saved</span>
                </div>
              </div>

              <div className="lg:col-span-5 relative">
                <div className="absolute -top-12 -left-12 w-72 h-72 bg-[#1B6B4A]/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 -right-10 w-72 h-72 bg-[#6FD9A0]/25 rounded-full blur-3xl pointer-events-none" />
                <div className="relative mx-auto max-w-lg lg:max-w-none">
                  <div className="relative rounded-3xl p-2 bg-gradient-to-b from-white/90 to-white/40 backdrop-blur-xl border border-white/60 shadow-2xl">
                    <ImageSlot
                      alt="A WhatsApp catalogue built from a store's own product list"
                      label="Catalogue preview"
                      dimensions="1000 × 900 · PNG, JPG or WebP"
                      variant="flush"
                    />
                    <div className="absolute -top-4 -left-4 sm:-left-6 bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#1B6B4A] flex items-center justify-center font-bold text-lg border border-emerald-200">🛍️</div>
                      <div>
                        <div className="text-xs text-gray-400 font-medium">Products found</div>
                        <div className="text-sm font-extrabold text-gray-900">24 items, one paste</div>
                      </div>
                    </div>
                    <div className="absolute -bottom-5 -left-3 sm:-left-4 bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#1B6B4A] flex items-center justify-center font-bold text-base border border-emerald-200">✓</div>
                      <div>
                        <div className="text-xs text-gray-400 font-medium">Works with</div>
                        <div className="text-sm font-extrabold text-gray-900">Shopify &amp; SEO-friendly stores</div>
                      </div>
                    </div>
                    <div className="absolute -top-3 -right-3 sm:-right-5 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-2">
                      <span className="text-emerald-500 font-bold text-sm">⚡</span>
                      <span className="text-xs font-bold text-gray-900">Under 15 seconds</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="-mt-6 sm:-mt-10 relative z-10">
            <CatalogExtractorTool />
          </div>

          <section className="mt-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-center mb-10">Where this data comes from</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {SOURCES.map((s) => (
                <div key={s.t} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-base font-bold">{s.t}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{s.d}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-center mb-10">Who this saves time for</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {USE_CASES.map((u) => (
                <div key={u.t} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-base font-bold">{u.t}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{u.d}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16 bg-emerald-50/70 border border-emerald-100 rounded-2xl p-8 sm:p-10 flex flex-wrap gap-6 items-center justify-between">
            <div className="max-w-lg">
              <h2 className="text-xl font-bold">Want this catalogue live on WhatsApp, not just copied and pasted?</h2>
              <p className="mt-2 text-sm sm:text-base text-gray-600 leading-relaxed">
                AiSend sends catalogue and broadcast messages straight from your product list on the official
                WhatsApp API.
              </p>
            </div>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center bg-[#1B6B4A] hover:bg-[#14523A] text-[#fff] font-semibold text-sm px-6 py-3 rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              Start free <span className="ml-2">→</span>
            </Link>
          </section>

          <section className="mt-16 max-w-3xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-center mb-10">Common questions</h2>
            <div className="divide-y divide-gray-200 border-y border-gray-200">
              {FAQS.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex justify-between items-center font-semibold text-base sm:text-lg list-none cursor-pointer focus:outline-none">
                    <span>{f.q}</span>
                    <span className="transition group-open:rotate-180 text-gray-500">
                      <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20"><path d="M6 9l6 6 6-6" /></svg>
                    </span>
                  </summary>
                  <p className="text-gray-600 mt-3 text-sm sm:text-base leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </main>
      </div>
      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />
    </>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { breadcrumbJsonLd, faqJsonLd, serializeJsonLd } from '@/lib/seo/json-ld'
import { SITE_URL } from '@/lib/seo/site'
import '../../(marketing)/landing.css'
import { ChatbotTool } from './chatbot-tool'
import { EXTRA_FAQ, SECTIONS } from './content'

const PATH = '/tools/ai-chatbot-widget'
const TITLE = 'Free AI Chatbot Widget for Your Website'
const DESC =
  'Paste your website address and get an AI chatbot trained on your own pages in under a minute. Test it live, then add it to your site for free and capture leads.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE_URL}${PATH}` },
  openGraph: { title: TITLE, description: DESC, url: `${SITE_URL}${PATH}`, type: 'website' },
  robots: { index: true, follow: true },
}

const FAQ = [
  { q: 'Is the AI chatbot widget really free?', a: 'Yes. You can build and test the chatbot without signing up. Creating a free account lets you embed it on your website and see the conversations and leads it collects.' },
  { q: 'How does the chatbot learn about my business?', a: 'It reads the public pages of the website you enter, such as your home, services, pricing and contact pages, and answers visitor questions from that content. It does not invent details that are not on your site.' },
  { q: 'Can I change the chatbot name, tone and greeting?', a: 'Yes. After the scan you can edit the name, role, tone of voice, greeting, suggested questions and colour, and the preview updates straight away.' },
  { q: 'What happens when the chatbot does not know the answer?', a: 'It says it is not sure and points the visitor to your contact details, so customers are never given a made-up price or policy.' },
  { q: 'Does it work with WhatsApp?', a: 'Yes. AiSend connects the same chatbot to your WhatsApp Business number, so one assistant can answer visitors on your website and customers on WhatsApp.' },
  { q: 'Will it work on any website?', a: 'It works on most public websites. Sites that block bots, or that load all their text with JavaScript, may not be readable. In that case our team can set the chatbot up with you manually.' },
]

const ALL_FAQ = [...FAQ, ...EXTRA_FAQ]

const HOW = [
  ['1. Enter your website', 'Type your address. No signup, no card.'],
  ['2. We read your pages', 'Your services, products, prices and contact details become the chatbot\'s knowledge.'],
  ['3. Test and tweak', 'Chat with it, rename it, set the tone and pick your colour.'],
  ['4. Add it for free', 'Create a free account to embed it and capture every lead.'],
]

export default function AiChatbotWidgetPage() {
  const ld = [
    breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Free tools', path: '/tools' }, { name: 'AI chatbot widget', path: PATH }]),
    faqJsonLd(ALL_FAQ),
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: TITLE, url: `${SITE_URL}${PATH}`, applicationCategory: 'BusinessApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' } },
  ]
  return (
    <div className="lp" style={{ fontFamily: "'Inter', sans-serif" }}>
      <SiteHeader />
      <main>
        <section className="gradient-hero-bg" style={{ padding: '56px 16px 40px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
              <Link href="/">Home</Link> / <Link href="/tools">Free tools</Link> / AI chatbot widget
            </nav>
            <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto 32px' }}>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Free AI chatbot widget for your website</h1>
              <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">
                Paste your website address. In under a minute you get a chatbot that answers visitor questions from your own pages, 24 hours a day. Test it here, then add it to your site for free.
              </p>
            </div>
            <ChatbotTool />
          </div>
        </section>

        <section style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 16px' }}>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-center">How the AI chatbot widget works</h2>
          <div className="grid gap-5 mt-8 sm:grid-cols-2 lg:grid-cols-4">
            {HOW.map(([t, d]) => (
              <div key={t} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-bold text-lg">{t}</h3>
                <p className="mt-2 text-gray-600 text-[15px] leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <article style={{ maxWidth: 920, margin: '0 auto', padding: '0 16px 56px' }}>
          <nav aria-label="On this page" className="bg-white rounded-2xl border border-gray-100 p-5 mb-10">
            <p className="font-bold mb-2">On this page</p>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-[15px]">
              {SECTIONS.map((sec) => (
                <li key={sec.id}><a href={`#${sec.id}`} className="text-emerald-800 hover:underline">{sec.h2}</a></li>
              ))}
            </ul>
          </nav>
          {SECTIONS.map((sec) => (
            <section key={sec.id} id={sec.id} className="mb-10 scroll-mt-24">
              <h2 className="text-2xl font-extrabold tracking-tight mb-4">{sec.h2}</h2>
              {sec.paras.map((t, i) => (
                <p key={i} className="text-gray-700 leading-relaxed mb-4">{t}</p>
              ))}
              {sec.list ? (
                <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
                  {sec.list.map((li) => <li key={li}>{li}</li>)}
                </ul>
              ) : null}
              {sec.table ? (
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-left text-[15px] border border-gray-200 rounded-xl overflow-hidden">
                    <thead className="bg-emerald-50">
                      <tr>{sec.table.head.map((h, i) => <th key={i} className="p-3 font-bold">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {sec.table.rows.map((r) => (
                        <tr key={r[0]} className="border-t border-gray-100">
                          {r.map((c, i) => <td key={i} className={`p-3 ${i === 0 ? 'font-semibold' : 'text-gray-700'}`}>{c}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {sec.after?.map((t, i) => <p key={i} className="text-gray-700 leading-relaxed mb-4">{t}</p>)}
              {sec.id === 'lead-capture' ? (
                <p className="mb-4">
                  <Link href="/blog/where-to-see-website-chatbot-leads" className="font-semibold text-emerald-800 underline">Read the guide: where your chatbot leads appear</Link>
                </p>
              ) : null}
            </section>
          ))}
        </article>

        <section style={{ maxWidth: 920, margin: '0 auto', padding: '0 16px 64px' }}>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-center">Frequently asked questions</h2>
          <div className="mt-8 space-y-3">
            {ALL_FAQ.map((f) => (
              <details key={f.q} className="bg-white rounded-xl border border-gray-100 p-5">
                <summary className="font-semibold cursor-pointer">{f.q}</summary>
                <p className="mt-3 text-gray-600 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(ld) }} />
    </div>
  )
}

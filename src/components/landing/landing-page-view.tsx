import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import {
  breadcrumbJsonLd,
  faqJsonLd,
  serializeJsonLd,
  webPageJsonLd,
} from '@/lib/seo/json-ld'
import type { LandingContent, Section } from '@/lib/landing/types'
import {
  Cards,
  Comparison,
  Cta,
  Faq,
  Hero,
  Logos,
  Prose,
  Stats,
  Steps,
  Testimonials,
  VideoBand,
  type Tone,
} from './sections'
import '@/app/(marketing)/landing.css'

/**
 * Renders a landing page from its content file.
 *
 * Sections run top to bottom in the order the content lists them. Ordinary
 * sections alternate white / tinted so the page has a rhythm without any
 * page choosing its own colours; the hero, the green video band and the
 * closing call-to-action carry their own backgrounds and sit outside that
 * rhythm.
 *
 * Search-engine data is generated from the same content, so it can never
 * drift from what the page says: a WebPage entry, a breadcrumb trail, and
 * a FAQPage entry whenever the page has FAQs.
 */

function renderSection(section: Section, tone: Tone, key: string) {
  switch (section.type) {
    case 'hero':
      return <Hero key={key} section={section} />
    case 'logos':
      return <Logos key={key} section={section} tone={tone} />
    case 'stats':
      return <Stats key={key} section={section} tone={tone} />
    case 'comparison':
      return <Comparison key={key} section={section} tone={tone} />
    case 'cards':
      return <Cards key={key} section={section} tone={tone} />
    case 'video':
      return <VideoBand key={key} section={section} />
    case 'steps':
      return <Steps key={key} section={section} tone={tone} />
    case 'testimonials':
      return <Testimonials key={key} section={section} tone={tone} />
    case 'cta':
      return <Cta key={key} section={section} />
    case 'faq':
      return <Faq key={key} section={section} tone={tone} />
    case 'prose':
      return <Prose key={key} section={section} tone={tone} />
    default: {
      // Adding a section type without rendering it is a compile error here.
      const unreachable: never = section
      return unreachable
    }
  }
}

/** Sections that bring their own background and skip the white/tinted rhythm. */
const SELF_COLOURED = new Set<Section['type']>(['hero', 'video', 'cta'])

export function LandingPageView({ content }: { content: LandingContent }) {
  let tinted = false
  const rendered = content.sections.map((section, i) => {
    let tone: Tone = 'white'
    if (!SELF_COLOURED.has(section.type)) {
      tone = tinted ? 'tinted' : 'white'
      tinted = !tinted
    }
    return renderSection(section, tone, `${section.type}-${i}`)
  })

  const path = `/${content.slug}`
  const faqs = content.sections.flatMap((s) => (s.type === 'faq' ? s.items : []))

  const structuredData = [
    webPageJsonLd({ name: content.seo.title, description: content.seo.description, path }),
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: content.breadcrumb, path },
    ]),
    ...(faqs.length ? [faqJsonLd(faqs)] : []),
  ]

  return (
    <>
      <div className="lp" style={{ fontFamily: "'Inter', sans-serif" }}>
        <SiteHeader />
        <main>{rendered}</main>
        {structuredData.map((data, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
          />
        ))}
      </div>
      <SiteFooter />
    </>
  )
}

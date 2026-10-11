import type { Metadata } from 'next'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { ToolHero } from '@/components/tools/landing/hero'
import {
  BeyondLink,
  CtaBanner,
  Faq,
  LeadSection,
  RelatedPosts,
  Reviews,
  VideoRow,
  Workflow,
  WhyUse,
} from '@/components/tools/landing/sections'
import { UseCases } from '@/components/tools/landing/use-cases'
import { ToolsRail } from '@/components/tools/landing/tools-rail'
import { loadPosts } from '@/lib/blog/posts'
import { SITE_NAME, SITE_URL } from '@/lib/seo/site'
import { TOOL_LEAD } from '@/lib/tools/landing-config'
import { LinkGeneratorTool } from './link-generator-tool'
import {
  BANNER,
  BEYOND,
  FAQ_HEADING,
  FAQS,
  HERO,
  LEAD,
  LEAD_FORM_ID,
  PAGE_URL,
  POSTS_COPY,
  RELATED_POST_TAG,
  REVIEWS,
  REVIEWS_COPY,
  SEO,
  TOOLS_RAIL,
  USE_CASES,
  VIDEOS,
  WHY,
  WORKFLOW,
} from './content'
import '../../(marketing)/landing.css'
import '@/components/tools/landing/tool-landing.css'

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..800&display=swap'

export const metadata: Metadata = {
  title: SEO.title,
  description: SEO.description,
  robots: { index: true, follow: true },
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: 'website',
    url: PAGE_URL,
    siteName: SITE_NAME,
    title: SEO.ogTitle,
    description: SEO.ogDescription,
  },
  twitter: { card: 'summary', title: SEO.ogTitle, description: SEO.ogDescription },
}

/** Structured data: what the page is, where it sits, and its questions. */
function structuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'WhatsApp Link Generator',
        url: PAGE_URL,
        description: SEO.description,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Any',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
        provider: { '@type': 'Organization', name: 'AiSend', url: SITE_URL },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Free tools', item: `${SITE_URL}/tools` },
          { '@type': 'ListItem', position: 3, name: 'WhatsApp link generator', item: PAGE_URL },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQS.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: f.points ? `${f.a} ${f.points.join('. ')}.` : f.a,
          },
        })),
      },
    ],
  }
}

export default function WhatsAppLinkGeneratorPage() {
  const related = loadPosts()
    .filter((p) => p.tags.includes(RELATED_POST_TAG))
    .slice(0, 3)

  return (
    <>
      {/* DM Sans is used only on this page's new sections, so it is loaded here rather than site-wide. */}
      <link rel="stylesheet" href={FONT_HREF} precedence="default" />

      <div className="lp" style={{ fontFamily: "'Inter', sans-serif" }}>
        <SiteHeader />

        <main className="tl">
          <ToolHero {...HERO} />

          <section className="tl-section tl-section--tight" aria-label="WhatsApp link generator">
            <div className="tl-wrap">
              <LinkGeneratorTool />
            </div>
          </section>

          <WhyUse {...WHY} />
          <Workflow {...WORKFLOW} />
          <UseCases {...USE_CASES} />
          <CtaBanner {...BANNER} />
          <BeyondLink {...BEYOND} />
          <VideoRow {...VIDEOS} />
          <Reviews reviews={REVIEWS} {...REVIEWS_COPY} />
          <RelatedPosts {...POSTS_COPY} posts={related} />
          <ToolsRail {...TOOLS_RAIL} />
          <Faq heading={FAQ_HEADING} items={FAQS} />
          <LeadSection
            {...LEAD}
            formId={LEAD_FORM_ID}
            displayNumber={TOOL_LEAD.displayNumber}
          />
        </main>
      </div>
      <SiteFooter />

      <script
        type="application/ld+json"
        // "<" is escaped so no string in the data can close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, '\\u003c') }}
      />
    </>
  )
}

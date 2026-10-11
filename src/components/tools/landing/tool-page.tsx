// One layout for every /tools/* landing page. A page supplies its words
// (ToolPageContent), the tool itself and, if it wants, its own hero picture.
// The section order lives here, so all tool pages feel the same and a change
// to the layout is made once.

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { loadPosts } from '@/lib/blog/posts'
import { SITE_NAME, SITE_URL } from '@/lib/seo/site'
import { TOOL_LEAD } from '@/lib/tools/landing-config'
import { ToolHero } from './hero'
import { Guide, type GuideSection } from './guide'
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
  type Benefit,
  type Feature,
  type FaqItem,
  type Review,
  type Step,
  type VideoItem,
} from './sections'
import { UseCases, type UseCase } from './use-cases'
import { ToolsRail, type RailTool } from './tools-rail'
import '../../../app/(marketing)/landing.css'
import './tool-landing.css'

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..800&display=swap'

export interface ToolPageContent {
  /** Address of the page, e.g. "/tools/whatsapp-qr-code". */
  path: string
  seo: { title: string; description: string; ogTitle: string; ogDescription: string }
  schema: {
    /** Name of the tool in search results and structured data. */
    name: string
    /** Last crumb of the breadcrumb trail. */
    breadcrumb: string
  }
  /** Blog posts with this tag appear under "Related articles". */
  relatedTag: string
  /** Shows up as the lead's source in the CRM. */
  formId: string
  /** Accessible name of the tool section. */
  toolLabel: string
  hero: {
    badge: string
    title: string
    lead: string
    primaryLabel: string
    primaryHref: string
    secondaryLabel: string
    whatsappMessage: string
    proof: readonly string[]
  }
  why: { heading: string; intro: string; benefits: readonly Benefit[]; reels: readonly { src?: string; title: string }[] }
  workflow: { heading: string; intro: string; steps: readonly Step[] }
  useCases: { heading: string; intro: string; actionLabel: string; cases: readonly UseCase[] }
  banner: { heading: string; text: string; label: string; message: string }
  guide: { heading: string; intro: string; sections: readonly GuideSection[] }
  beyond: {
    heading: string
    intro: string
    features: readonly Feature[]
    ctaLabel: string
    ctaHref: string
    moreLabel: string
    moreHref: string
  }
  videos: { heading: string; intro: string; videos: readonly VideoItem[] }
  reviews: readonly Review[]
  reviewsCopy: {
    heading: string
    intro: string
    inviteHeading: string
    inviteText: string
    inviteLabel: string
    inviteMessage: string
  }
  postsCopy: { heading: string; intro: string }
  toolsRail: {
    heading: string
    intro: string
    openLabel: string
    viewAllHref: string
    viewAllLabel: string
    tools: readonly RailTool[]
  }
  faqHeading: string
  faqs: readonly FaqItem[]
  lead: {
    heading: string
    intro: string
    points: readonly string[]
    whatsappLabel: string
    whatsappMessage: string
    sourceLabel: string
  }
}

export function toolMetadata(c: ToolPageContent): Metadata {
  const url = `${SITE_URL}${c.path}`
  return {
    title: c.seo.title,
    description: c.seo.description,
    robots: { index: true, follow: true },
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      siteName: SITE_NAME,
      title: c.seo.ogTitle,
      description: c.seo.ogDescription,
    },
    twitter: { card: 'summary', title: c.seo.ogTitle, description: c.seo.ogDescription },
  }
}

/** What the page is, where it sits, and the questions it answers. */
export function toolStructuredData(c: ToolPageContent) {
  const url = `${SITE_URL}${c.path}`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: c.schema.name,
        url,
        description: c.seo.description,
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
          { '@type': 'ListItem', position: 3, name: c.schema.breadcrumb, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: c.faqs.map((f) => ({
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

export function ToolPage({
  content: c,
  tool,
  stage,
}: {
  content: ToolPageContent
  /** The interactive tool. It must render an element with id="generator". */
  tool: ReactNode
  /** Optional hero picture; see ToolHero. */
  stage?: ReactNode
}) {
  const related = loadPosts()
    .filter((p) => p.tags.includes(c.relatedTag))
    .slice(0, 3)

  return (
    <>
      {/* DM Sans is used only on the tool pages, so it is loaded here rather than site-wide. */}
      <link rel="stylesheet" href={FONT_HREF} precedence="default" />

      <div className="lp" style={{ fontFamily: "'Inter', sans-serif" }}>
        <SiteHeader />

        <main className="tl">
          <ToolHero {...c.hero} stage={stage} />

          <section className="tl-section tl-section--tight" aria-label={c.toolLabel}>
            <div className="tl-wrap">{tool}</div>
          </section>

          <WhyUse {...c.why} />
          <Workflow {...c.workflow} />
          <UseCases {...c.useCases} />
          <CtaBanner {...c.banner} />
          <Guide {...c.guide} />
          <BeyondLink {...c.beyond} />
          <VideoRow {...c.videos} />
          <Reviews reviews={c.reviews} {...c.reviewsCopy} />
          <RelatedPosts {...c.postsCopy} posts={related} />
          <ToolsRail {...c.toolsRail} />
          <Faq heading={c.faqHeading} items={c.faqs} />
          <LeadSection
            {...c.lead}
            formId={c.formId}
            displayNumber={TOOL_LEAD.displayNumber}
          />
        </main>
      </div>
      <SiteFooter />

      <script
        type="application/ld+json"
        // "<" is escaped so no string in the data can close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(toolStructuredData(c)).replace(/</g, '\\u003c') }}
      />
    </>
  )
}

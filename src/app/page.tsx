import type { Metadata } from 'next'
import LandingPage from './(marketing)/landing-page'
import { serializeJsonLd } from '@/lib/seo/json-ld'
import { buildMetadata } from '@/lib/seo/metadata'
import { absoluteUrl } from '@/lib/seo/site'
import { HOME_BRAND, HOME_DESCRIPTION, HOME_TITLE, homeJsonLd } from '@/lib/seo/home-json-ld'

// The root layout defaults every page to noindex, which is right for the
// signed-in app and wrong here. buildMetadata() opts the homepage back in
// and adds the canonical link and the OpenGraph + Twitter cards, the same
// way the blog, tools and landing pages do.
const base = buildMetadata({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  path: '/',
})

export const metadata: Metadata = {
  ...base,
  // `absolute` skips the layout's "%s — AiSend" template: the title
  // already says AiSend, and we do not want "AiSend — … — AiSend".
  title: { absolute: HOME_TITLE },
  // Written out in full (instead of patching base.openGraph) so the site
  // name is the brand customers know. No image yet: add `ogImage` above
  // once a real 1200 x 630 share picture is hosted.
  openGraph: {
    type: 'website',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: absoluteUrl('/'),
    siteName: HOME_BRAND,
  },
}

/**
 * Public homepage. Previously redirected straight to /dashboard, which
 * meant the app had NO public marketing page — a blocker for Razorpay
 * and Meta Tech Provider review (both require a real, accessible
 * landing page describing the product). Now serves the marketing page;
 * the in-app CTAs route to /login and /signup.
 */
export default function RootPage() {
  return (
    <>
      <LandingPage />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(homeJsonLd()) }}
      />
    </>
  )
}

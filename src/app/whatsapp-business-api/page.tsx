import { LandingPageView } from '@/components/landing/landing-page-view'
import content from '@/content/landing/whatsapp-business-api'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata = buildMetadata({
  title: content.seo.title,
  description: content.seo.description,
  path: `/${content.slug}`,
  ogImage: content.seo.ogImage,
  keywords: content.seo.keywords,
})

export default function Page() {
  return <LandingPageView content={content} />
}

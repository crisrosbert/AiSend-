import ContactContent from './contact-content'
import { buildMetadata } from '@/lib/seo/metadata'

// The page itself (form + details) lives in ./contact-content.tsx, which is
// a client component and so cannot export metadata. This small server file
// adds it. /contact is a real public page (Razorpay and Meta review both
// look for it) and it is listed in sitemap.ts, so it must be indexable:
// buildMetadata() opts it back in after the root layout's noindex default.
export const metadata = buildMetadata({
  title: 'Contact us',
  description:
    'Contact AiSend by email or WhatsApp. We typically reply within one business day.',
  path: '/contact',
})

export default function ContactPage() {
  return <ContactContent />
}

import type { Metadata } from 'next'
import ContactContent from './contact-content'

// Split from the actual page so this can export metadata — the content
// below needs 'use client' for its form state, and a client component
// cannot export metadata itself.
export const metadata: Metadata = {
  title: 'Contact Us — AiSend',
  description: 'Get in touch with the AiSend team — email, WhatsApp, or send a message.',
  robots: { index: true, follow: true },
}

export default function ContactPage() {
  return <ContactContent />
}

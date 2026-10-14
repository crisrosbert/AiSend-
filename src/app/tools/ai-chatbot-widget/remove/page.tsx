import type { Metadata } from 'next'
import { RemoveForm } from './remove-form'

export const metadata: Metadata = {
  title: 'Remove your website from the chatbot demo wall',
  robots: { index: false, follow: false },
}

export default async function RemovePage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const { site } = await searchParams
  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '64px 16px', fontFamily: "'Inter', sans-serif" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Remove your website</h1>
      <p style={{ color: '#4b5563', margin: '10px 0 24px', lineHeight: 1.6 }}>
        Our free chatbot tool reads public pages and can show a brand logo and a demo link. Enter the website and we will hide its logo and disable its demo links straight away.
      </p>
      <RemoveForm initialSite={typeof site === 'string' ? site.slice(0, 120) : ''} />
    </main>
  )
}

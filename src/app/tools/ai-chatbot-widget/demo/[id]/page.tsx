import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getShare } from '@/lib/tools/chatbot/shares'
import { signSession } from '@/lib/tools/chatbot/session'
import { DemoChat } from './demo-chat'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Chatbot demo',
  robots: { index: false, follow: false },
}

export default async function DemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const share = await getShare(id)
  if (!share) notFound()
  const session = signSession({ site: share.host, chunks: share.chunks, facts: share.facts })
  return <DemoChat site={share.host} profile={share.profile} session={session} />
}

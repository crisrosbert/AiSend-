/**
 * File: src/app/(dashboard)/ai-agent/conversations/page.tsx
 * Purpose: View all customer conversations handled by the AI Agent
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MessageSquare, AlertTriangle } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

interface Session {
  id: string
  contact_phone: string
  messages: Message[]
  needs_human: boolean
  created_at: string
  updated_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function AiAgentConversationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: sessions, error } = await supabase
    .from('ai_agent_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-gray-600 dark:text-gray-400">Failed to load conversations: {error.message}</p>
        <Link href="/ai-agent" className="text-sm text-indigo-600 underline dark:text-indigo-400">Back</Link>
      </div>
    )
  }

  const typedSessions = (sessions ?? []) as Session[]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/ai-agent"
          className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Conversations</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {typedSessions.length} customer chats
          </p>
        </div>
      </div>

      {/* Empty state */}
      {typedSessions.length === 0 && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-2xl bg-gray-100 p-6 dark:bg-gray-800">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
          </div>
          <p className="font-semibold text-gray-900 dark:text-white">No conversations yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Customer chats will appear here once the AI agent starts replying.
          </p>
        </div>
      )}

      {/* Conversation list */}
      {typedSessions.length > 0 && (
        <div className="space-y-3">
          {typedSessions.map((session) => {
            const msgs = session.messages ?? []
            const lastMsg = msgs[msgs.length - 1]
            const msgCount = msgs.length

            return (
              <div
                key={session.id}
                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                      <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-white">{session.contact_phone}</p>
                        {session.needs_human && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                            <AlertTriangle className="h-3 w-3" /> Needs human
                          </span>
                        )}
                      </div>
                      {lastMsg && (
                        <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                          <span className="font-medium">{lastMsg.role === 'user' ? 'Customer' : 'Agent'}:</span>{' '}
                          {lastMsg.content}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{formatDate(session.updated_at)}</p>
                    <p className="mt-1 text-xs text-gray-400">{msgCount} messages</p>
                  </div>
                </div>

                {/* Message thread preview */}
                {msgs.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                    {msgs.slice(-3).map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                            msg.role === 'user'
                              ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                              : 'bg-indigo-600 text-white'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {msgs.length > 3 && (
                      <p className="text-center text-xs text-gray-400">
                        {msgs.length - 3} earlier messages
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

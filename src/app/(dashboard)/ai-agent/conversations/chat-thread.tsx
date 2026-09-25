/**
 * File: src/app/(dashboard)/ai-agent/conversations/chat-thread.tsx
 * Purpose: Client component for expandable conversation thread with chat bubbles
 */

'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

function formatMessageTime(ts?: string) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ChatThread({ messages, sessionId }: { messages: Message[]; sessionId: string }) {
  const [expanded, setExpanded] = useState(false)

  if (!messages || messages.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-gray-400 dark:text-gray-500">
        No messages in this conversation
      </p>
    )
  }

  const preview = messages.slice(-3)
  const displayMessages = expanded ? messages : preview
  const hasMore = messages.length > 3

  return (
    <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
      {/* Expand / Collapse toggle */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Show all {messages.length} messages
            </>
          )}
        </button>
      )}

      {/* Messages */}
      <div className="space-y-2">
        {displayMessages.map((msg, i) => (
          <div
            key={`${sessionId}-${expanded ? i : messages.length - 3 + i}`}
            className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'rounded-bl-md bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  : 'rounded-br-md bg-indigo-600 text-white'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              {msg.timestamp && (
                <p
                  className={`mt-1 text-[10px] ${
                    msg.role === 'user'
                      ? 'text-gray-400 dark:text-gray-500'
                      : 'text-indigo-200'
                  }`}
                >
                  {formatMessageTime(msg.timestamp)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom toggle when expanded */}
      {expanded && hasMore && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
        >
          <ChevronUp className="h-3.5 w-3.5" />
          Collapse
        </button>
      )}
    </div>
  )
}

// A signed bundle of what the scan found. The browser holds it and sends it
// back with every chat message, so the server keeps no state — and because it
// is signed, nobody can swap in their own "knowledge" and use this endpoint as
// a free general-purpose chatbot.

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { KnowledgeChunk } from './knowledge'

export interface ChatSession {
  site: string
  chunks: KnowledgeChunk[]
  exp: number
}

export const SESSION_TTL_MS = 2 * 60 * 60 * 1000

function secret(): string {
  const s = process.env.TOOLS_SESSION_SECRET || process.env.ENCRYPTION_KEY
  if (s) return s
  if (process.env.NODE_ENV === 'production') throw new Error('TOOLS_SESSION_SECRET is not set')
  return 'dev-only-secret'
}

const mac = (body: string) => createHmac('sha256', secret()).update(body).digest('base64url')

export function signSession(s: Omit<ChatSession, 'exp'>, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...s, exp: now + SESSION_TTL_MS })).toString('base64url')
  return `${body}.${mac(body)}`
}

export function verifySession(token: unknown, now = Date.now()): ChatSession | null {
  if (typeof token !== 'string' || token.length > 60_000) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const want = Buffer.from(mac(body))
  const got = Buffer.from(sig)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ChatSession
    return s.exp > now && Array.isArray(s.chunks) ? s : null
  } catch {
    return null
  }
}

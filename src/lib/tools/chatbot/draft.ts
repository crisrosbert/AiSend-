// The free chatbot tool saves what the visitor built here before sending them
// to sign up. The dashboard reads it back so their chatbot is waiting for them.

export const DRAFT_KEY = 'aisend:chatbot-draft'

export interface ChatbotDraft {
  site: string
  name: string
  greeting: string
  color: string
  savedAt: number
}

const HEX = /^#[0-9a-fA-F]{6}$/
const SITE = /^[a-z0-9.-]{3,120}$/i

export function parseDraft(raw: string | null, now = Date.now()): ChatbotDraft | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as Partial<ChatbotDraft>
    if (typeof d.site !== 'string' || !SITE.test(d.site)) return null
    if (typeof d.savedAt !== 'number' || now - d.savedAt > 30 * 24 * 3600_000) return null
    return {
      site: d.site.toLowerCase(),
      name: typeof d.name === 'string' ? d.name.slice(0, 40) : 'Assistant',
      greeting: typeof d.greeting === 'string' ? d.greeting.slice(0, 160) : 'Hello! How can I help you today?',
      color: typeof d.color === 'string' && HEX.test(d.color) ? d.color : '#1B6B4A',
      savedAt: d.savedAt,
    }
  } catch {
    return null
  }
}

export function saveDraft(d: Omit<ChatbotDraft, 'savedAt'>): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, savedAt: Date.now() }))
  } catch {
    /* private mode: the signup link still carries the site address */
  }
}

export function readDraft(): ChatbotDraft | null {
  try {
    return parseDraft(localStorage.getItem(DRAFT_KEY))
  } catch {
    return null
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* nothing to clear */
  }
}

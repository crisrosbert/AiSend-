// src/lib/tools/inline-markup.ts
//
// A very small inline syntax for the long-form copy on the tool pages, so
// writers can add a link, bold words or a bit of code without touching JSX:
//
//   **bold**    `code`    [label](/page-on-this-site)    [label](https://…)
//
// Anything else stays plain text. Links are limited to this site ("/…") and
// https:// addresses, so a copy-and-paste mistake can never become a
// javascript: or plain-http link.

export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; href: string }

const PATTERN = /\*\*([^*]+?)\*\*|`([^`]+?)`|\[([^\]]+?)\]\(([^)\s]+)\)/g

function isSafeHref(href: string): boolean {
  if (href.startsWith('//')) return false
  return href.startsWith('/') || href.startsWith('https://')
}

export function parseInline(input: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let last = 0

  const pushText = (text: string) => {
    if (!text) return
    const prev = tokens[tokens.length - 1]
    if (prev && prev.type === 'text') prev.text += text
    else tokens.push({ type: 'text', text })
  }

  for (const match of input.matchAll(PATTERN)) {
    const [whole, bold, code, label, href] = match
    const start = match.index ?? 0

    if (label !== undefined && !isSafeHref(href)) {
      // Not a link we allow: keep the original characters as plain text.
      pushText(input.slice(last, start + whole.length))
      last = start + whole.length
      continue
    }

    pushText(input.slice(last, start))
    if (bold !== undefined) tokens.push({ type: 'bold', text: bold })
    else if (code !== undefined) tokens.push({ type: 'code', text: code })
    else tokens.push({ type: 'link', text: label, href })
    last = start + whole.length
  }

  pushText(input.slice(last))
  return tokens
}

// src/lib/blog/markdown.ts
//
// A small, deliberately limited Markdown reader for blog posts.
//
// Posts arrive as Word documents and become .md files (pandoc does that in
// one command), so the parser only needs the handful of things a blog post
// uses. It turns text into plain data (blocks and inline pieces) and never
// into HTML strings: the page renders that data as React elements, which
// escape everything. A post can contain "<script>" and it will show up as
// the literal text "<script>". Nothing in a post can inject markup.
//
// Supported:
//   # / ## / ### / ####   headings   (a single # is treated as ## — the
//                                     page's own title is the one <h1>)
//   paragraphs, **bold**, *italic*, `code`, [links](https://…)
//   - bullets and 1. numbered lists
//   > quotes
//   ``` fenced code ```
//   | tables |
//   ![alt](https://image-url)        a picture on its own line
//   @[video](https://youtube-link)   a video on its own line
//   ---                              a divider
//
// Links are limited to https:, http:, mailto:, tel:, site paths and
// in-page anchors. Anything else (javascript:, data:, …) is shown as plain
// text, never as a link.

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] }

export type Block =
  | { type: 'heading'; level: 2 | 3 | 4; id: string; text: string; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'quote'; children: Inline[] }
  | { type: 'code'; lang: string; text: string }
  | { type: 'image'; src: string; alt: string }
  | { type: 'video'; src: string }
  | { type: 'table'; header: Inline[][]; rows: Inline[][][] }
  | { type: 'hr' }

/* ── links ────────────────────────────────────────────────────────── */

const SAFE_HREF = /^(https?:\/\/[^\s]+|mailto:[^\s]+|tel:[^\s]+|\/[^\s]*|#[^\s]*)$/i

export function isSafeHref(href: string): boolean {
  return SAFE_HREF.test(href.trim()) && !/^\/\//.test(href.trim())
}

/* ── inline ───────────────────────────────────────────────────────── */

export function plainText(nodes: readonly Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
        case 'code':
          return n.text
        default:
          return plainText(n.children)
      }
    })
    .join('')
}

// The target may contain one level of balanced brackets, so a link like
// https://en.wikipedia.org/wiki/Foo_(bar) is read whole, not cut at the first ")".
const LINK = /^\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/

export function parseInline(source: string): Inline[] {
  const out: Inline[] = []
  let buf = ''
  const flush = () => {
    if (buf) {
      out.push({ type: 'text', text: buf })
      buf = ''
    }
  }

  let i = 0
  while (i < source.length) {
    const c = source[i]

    // A backslash makes the next character literal: \* \[ \`
    if (c === '\\' && i + 1 < source.length) {
      buf += source[i + 1]
      i += 2
      continue
    }

    if (c === '`') {
      const end = source.indexOf('`', i + 1)
      if (end > i + 1) {
        flush()
        out.push({ type: 'code', text: source.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }

    if (c === '[') {
      const m = LINK.exec(source.slice(i))
      if (m) {
        flush()
        const children = parseInline(m[1])
        if (isSafeHref(m[2])) {
          out.push({ type: 'link', href: m[2], children })
        } else {
          // Unsafe target: keep the words, drop the link.
          out.push(...children)
        }
        i += m[0].length
        continue
      }
    }

    if (c === '*' && source[i + 1] === '*') {
      const end = source.indexOf('**', i + 2)
      if (end > i + 2) {
        flush()
        out.push({ type: 'strong', children: parseInline(source.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    }

    if (c === '*') {
      const end = source.indexOf('*', i + 1)
      if (end > i + 1 && source[i + 1] !== ' ') {
        flush()
        out.push({ type: 'em', children: parseInline(source.slice(i + 1, end)) })
        i = end + 1
        continue
      }
    }

    buf += c
    i += 1
  }

  flush()
  return out
}

/* ── blocks ───────────────────────────────────────────────────────── */

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const HR = /^(-{3,}|\*{3,}|_{3,})$/
const BULLET = /^[-*+]\s+(.*)$/
const NUMBERED = /^\d+[.)]\s+(.*)$/
const IMAGE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/
const VIDEO = /^@\[video\]\(([^)\s]+)\)$/
const TABLE_SEPARATOR = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/

function splitRow(line: string): string[] {
  let row = line.trim()
  if (row.startsWith('|')) row = row.slice(1)
  if (row.endsWith('|')) row = row.slice(0, -1)
  return row.split('|').map((cell) => cell.trim())
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  const usedIds = new Map<string, number>()

  const uniqueId = (text: string): string => {
    const base = slugifyHeading(text) || 'section'
    const seen = usedIds.get(base) ?? 0
    usedIds.set(base, seen + 1)
    return seen === 0 ? base : `${base}-${seen + 1}`
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    // Fenced code
    const fence = /^```\s*([\w+-]*)\s*$/.exec(trimmed)
    if (fence) {
      const body: string[] = []
      i += 1
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        body.push(lines[i])
        i += 1
      }
      i += 1 // closing fence (or end of file)
      blocks.push({ type: 'code', lang: fence[1], text: body.join('\n') })
      continue
    }

    if (HR.test(trimmed)) {
      blocks.push({ type: 'hr' })
      i += 1
      continue
    }

    const heading = HEADING.exec(trimmed)
    if (heading) {
      // # becomes h2: the page already has its one <h1>.
      const level = Math.min(Math.max(heading[1].length, 2), 4) as 2 | 3 | 4
      const children = parseInline(heading[2])
      const text = plainText(children)
      blocks.push({ type: 'heading', level, id: uniqueId(text), text, children })
      i += 1
      continue
    }

    const video = VIDEO.exec(trimmed)
    if (video) {
      blocks.push({ type: 'video', src: video[1] })
      i += 1
      continue
    }

    const image = IMAGE.exec(trimmed)
    if (image) {
      blocks.push({ type: 'image', alt: image[1], src: image[2] })
      i += 1
      continue
    }

    // Table: a header row followed by a separator row
    if (trimmed.includes('|') && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1].trim())) {
      const header = splitRow(trimmed).map(parseInline)
      i += 2
      const rows: Inline[][][] = []
      while (i < lines.length && lines[i].trim().includes('|')) {
        rows.push(splitRow(lines[i]).map(parseInline))
        i += 1
      }
      blocks.push({ type: 'table', header, rows })
      continue
    }

    // Quote: consecutive "> " lines
    if (trimmed.startsWith('>')) {
      const parts: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        parts.push(lines[i].trim().replace(/^>\s?/, ''))
        i += 1
      }
      blocks.push({ type: 'quote', children: parseInline(parts.join(' ').trim()) })
      continue
    }

    // Lists
    const isBullet = BULLET.test(trimmed)
    const isNumbered = NUMBERED.test(trimmed)
    if (isBullet || isNumbered) {
      const marker = isNumbered ? NUMBERED : BULLET
      // Raw text per item, parsed once at the end, so formatting that spans
      // a continuation line (a **bold** phrase split across two lines) survives.
      const rawItems: string[] = []
      while (i < lines.length) {
        const current = lines[i]
        const m = marker.exec(current.trim())
        if (m && !/^\s{4,}/.test(current)) {
          rawItems.push(m[1])
          i += 1
          continue
        }
        // An indented line continues the item above it.
        if (rawItems.length && /^\s+\S/.test(current) && !marker.test(current.trim())) {
          rawItems[rawItems.length - 1] += ` ${current.trim()}`
          i += 1
          continue
        }
        break
      }
      blocks.push({ type: 'list', ordered: isNumbered, items: rawItems.map(parseInline) })
      continue
    }

    // Paragraph: runs until a blank line or the start of another block.
    // The first line is always taken, so odd input can never be skipped
    // or loop forever.
    const parts: string[] = [trimmed]
    i += 1
    while (i < lines.length) {
      const t = lines[i].trim()
      if (
        !t ||
        HEADING.test(t) ||
        HR.test(t) ||
        t.startsWith('>') ||
        t.startsWith('```') ||
        BULLET.test(t) ||
        NUMBERED.test(t) ||
        IMAGE.test(t) ||
        VIDEO.test(t)
      ) {
        break
      }
      parts.push(t)
      i += 1
    }
    blocks.push({ type: 'paragraph', children: parseInline(parts.join(' ')) })
  }

  return blocks
}

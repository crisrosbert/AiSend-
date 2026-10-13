// Pure helpers for the post page: split a post into collapsible sections, and
// lift the FAQ out of it for Google's FAQ markup. Nothing here changes the
// post's wording.

import type { Block, Inline } from './markdown'
import { plainText } from './markdown'

export type HeadingBlock = Extract<Block, { type: 'heading' }>

export interface PostSection {
  heading: HeadingBlock
  body: Block[]
}

/** Text before the first top-level heading, then one section per top-level heading. */
export function groupSections(blocks: readonly Block[]): { intro: Block[]; sections: PostSection[] } {
  const intro: Block[] = []
  const sections: PostSection[] = []
  for (const b of blocks) {
    if (b.type === 'heading' && b.level === 2) sections.push({ heading: b, body: [] })
    else if (sections.length === 0) intro.push(b)
    else sections[sections.length - 1].body.push(b)
  }
  return { intro, sections }
}

const isBoldOnly = (nodes: readonly Inline[]): boolean => nodes.length === 1 && nodes[0].type === 'strong'

/**
 * Question and answer pairs from a section titled "FAQ" / "FAQs" /
 * "Frequently asked questions": a paragraph that is only bold text is a
 * question, and the paragraphs after it (until the next one) are its answer.
 */
export function extractFaq(blocks: readonly Block[]): { q: string; a: string }[] {
  const { sections } = groupSections(blocks)
  const faq = sections.find((s) => /\bfaqs?\b|frequently asked/i.test(s.heading.text))
  if (!faq) return []
  const out: { q: string; a: string }[] = []
  let current: { q: string; parts: string[] } | null = null
  const flush = () => {
    if (current && current.parts.length) out.push({ q: current.q, a: current.parts.join(' ') })
  }
  for (const b of faq.body) {
    if (b.type === 'paragraph' && isBoldOnly(b.children)) {
      flush()
      current = { q: plainText(b.children), parts: [] }
    } else if (current && b.type === 'paragraph') {
      current.parts.push(plainText(b.children))
    } else if (current && b.type === 'list') {
      current.parts.push(b.items.map((i) => plainText(i)).join('; '))
    }
  }
  flush()
  return out
}

import { describe, expect, it } from 'vitest'
import { parseMarkdown } from './markdown'
import { extractFaq, groupSections } from './post-extras'
import { BLOG_TOOLS, TOOL_SLUGS } from './tool-catalog'

const SRC = `Intro line.

# One

Body one.

### Sub

Sub text.

# FAQs

**Is it free?**

Depends.

**Is it fast?**

Yes.

Very.
`

describe('groupSections', () => {
  it('keeps the intro apart and nests sub-headings in their section', () => {
    const { intro, sections } = groupSections(parseMarkdown(SRC))
    expect(intro).toHaveLength(1)
    expect(sections.map((s) => s.heading.text)).toEqual(['One', 'FAQs'])
    expect(sections[0].body.map((b) => b.type)).toEqual(['paragraph', 'heading', 'paragraph'])
  })
})

describe('extractFaq', () => {
  it('pairs bold questions with the paragraphs after them', () => {
    expect(extractFaq(parseMarkdown(SRC))).toEqual([
      { q: 'Is it free?', a: 'Depends.' },
      { q: 'Is it fast?', a: 'Yes. Very.' },
    ])
  })
  it('returns nothing when there is no FAQ section', () => {
    expect(extractFaq(parseMarkdown('# One\n\nText.'))).toEqual([])
  })
})

describe('tool catalog', () => {
  it('has unique slugs', () => {
    expect(new Set(TOOL_SLUGS).size).toBe(BLOG_TOOLS.length)
  })
})

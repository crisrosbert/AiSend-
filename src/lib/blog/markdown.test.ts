// src/lib/blog/markdown.test.ts

import { describe, it, expect } from 'vitest'
import { parseMarkdown, parseInline, plainText, slugifyHeading, isSafeHref } from './markdown'

const text = (t: string) => ({ type: 'text', text: t })

describe('parseInline', () => {
  it('reads plain text', () => {
    expect(parseInline('hello world')).toEqual([text('hello world')])
  })

  it('reads bold, italic and code', () => {
    expect(parseInline('a **b** c *d* e `f`')).toEqual([
      text('a '),
      { type: 'strong', children: [text('b')] },
      text(' c '),
      { type: 'em', children: [text('d')] },
      text(' e '),
      { type: 'code', text: 'f' },
    ])
  })

  it('nests formatting inside links and bold', () => {
    expect(parseInline('[a **b**](https://x.com)')).toEqual([
      {
        type: 'link',
        href: 'https://x.com',
        children: [text('a '), { type: 'strong', children: [text('b')] }],
      },
    ])
  })

  it('leaves unmatched markers as literal text', () => {
    expect(plainText(parseInline('2 * 3 and **open'))).toBe('2 * 3 and **open')
  })

  it('honours backslash escapes', () => {
    expect(parseInline('\\*not italic\\*')).toEqual([text('*not italic*')])
  })

  it('does not treat code contents as formatting', () => {
    expect(parseInline('`**x**`')).toEqual([{ type: 'code', text: '**x**' }])
  })

  it('keeps raw HTML as literal text, never as markup', () => {
    const nodes = parseInline('<script>alert(1)</script> <b>hi</b>')
    expect(nodes.every((n) => n.type === 'text')).toBe(true)
    expect(plainText(nodes)).toBe('<script>alert(1)</script> <b>hi</b>')
  })
})

describe('link safety', () => {
  it('accepts https, http, mailto, tel, site paths and anchors', () => {
    for (const href of [
      'https://example.com/a?b=1',
      'http://example.com',
      'mailto:hi@example.com',
      'tel:+918707879485',
      '/contact',
      '#faq',
    ]) {
      expect(isSafeHref(href), href).toBe(true)
    }
  })

  it('rejects script-capable and protocol-relative targets', () => {
    for (const href of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html;base64,AAAA',
      'vbscript:x',
      '//evil.example.com',
      'file:///etc/passwd',
    ]) {
      expect(isSafeHref(href), href).toBe(false)
    }
  })

  it('reads a link whose address contains brackets in one piece', () => {
    expect(parseInline('[Foo](https://en.wikipedia.org/wiki/Foo_(bar)) next')).toEqual([
      { type: 'link', href: 'https://en.wikipedia.org/wiki/Foo_(bar)', children: [text('Foo')] },
      text(' next'),
    ])
  })

  it('drops an unsafe link but keeps its words', () => {
    expect(parseInline('[click me](javascript:alert(1))')).toEqual([text('click me')])
  })
})

describe('slugifyHeading', () => {
  it('makes URL-safe anchors', () => {
    expect(slugifyHeading('Why WhatsApp in 2026?')).toBe('why-whatsapp-in-2026')
    expect(slugifyHeading('  Café & Co.  ')).toBe('cafe-co')
    expect(slugifyHeading('!!!')).toBe('')
  })
})

describe('parseMarkdown — headings', () => {
  it('maps # to h2 (the page already has one h1) and caps depth at h4', () => {
    const blocks = parseMarkdown('# One\n\n## Two\n\n### Three\n\n###### Six')
    expect(blocks.map((b) => (b.type === 'heading' ? b.level : null))).toEqual([2, 2, 3, 4])
  })

  it('gives headings unique anchor ids, even when the text repeats', () => {
    const ids = parseMarkdown('## Setup\n\n## Setup\n\n## Setup')
      .map((b) => (b.type === 'heading' ? b.id : ''))
    expect(ids).toEqual(['setup', 'setup-2', 'setup-3'])
  })

  it('falls back to "section" for a heading with nothing sluggable', () => {
    const [b] = parseMarkdown('## !!!')
    expect(b.type === 'heading' && b.id).toBe('section')
  })

  it('strips formatting from the heading text used for the table of contents', () => {
    const [b] = parseMarkdown('## A **bold** [link](https://x.com)')
    expect(b.type === 'heading' && b.text).toBe('A bold link')
  })
})

describe('parseMarkdown — blocks', () => {
  it('joins consecutive lines into one paragraph and splits on blank lines', () => {
    const blocks = parseMarkdown('line one\nline two\n\nsecond')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type === 'paragraph' && plainText(blocks[0].children)).toBe('line one line two')
  })

  it('reads bullet and numbered lists', () => {
    const [bullets, numbers] = parseMarkdown('- a\n- b\n\n1. x\n2. y')
    expect(bullets).toMatchObject({ type: 'list', ordered: false })
    expect(numbers).toMatchObject({ type: 'list', ordered: true })
    expect(bullets.type === 'list' && bullets.items).toHaveLength(2)
  })

  it('keeps formatting that continues onto an indented line of a list item', () => {
    const [list] = parseMarkdown('- start **bold\n  still bold** end')
    expect(list.type === 'list' && list.items[0]).toEqual([
      text('start '),
      { type: 'strong', children: [text('bold still bold')] },
      text(' end'),
    ])
  })

  it('reads quotes, dividers and fenced code', () => {
    const blocks = parseMarkdown('> wise\n> words\n\n---\n\n```json\n{ "a": 1 }\n```')
    expect(blocks[0]).toMatchObject({ type: 'quote' })
    expect(blocks[1]).toEqual({ type: 'hr' })
    expect(blocks[2]).toEqual({ type: 'code', lang: 'json', text: '{ "a": 1 }' })
  })

  it('does not parse markdown inside a code block', () => {
    const [code] = parseMarkdown('```\n# not a heading\n**not bold**\n```')
    expect(code).toEqual({ type: 'code', lang: '', text: '# not a heading\n**not bold**' })
  })

  it('reads a picture and a video that sit on their own line', () => {
    const blocks = parseMarkdown('![A chart](https://cdn.example.com/c.png)\n\n@[video](https://youtu.be/dQw4w9WgXcQ)')
    expect(blocks[0]).toEqual({ type: 'image', alt: 'A chart', src: 'https://cdn.example.com/c.png' })
    expect(blocks[1]).toEqual({ type: 'video', src: 'https://youtu.be/dQw4w9WgXcQ' })
  })

  it('reads a table', () => {
    const [table] = parseMarkdown('| A | B |\n|---|---|\n| 1 | **2** |\n| 3 | 4 |')
    expect(table.type).toBe('table')
    if (table.type === 'table') {
      expect(table.header.map(plainText)).toEqual(['A', 'B'])
      expect(table.rows).toHaveLength(2)
      expect(plainText(table.rows[0][1])).toBe('2')
    }
  })

  it('treats a lone pipe line without a separator as a paragraph, not a table', () => {
    expect(parseMarkdown('a | b')[0].type).toBe('paragraph')
  })

  it('handles Windows line endings', () => {
    expect(parseMarkdown('# T\r\n\r\ntext\r\n')).toHaveLength(2)
  })

  it('returns nothing for empty input and never hangs on odd input', () => {
    expect(parseMarkdown('')).toEqual([])
    expect(parseMarkdown('   \n\n  ')).toEqual([])
    expect(parseMarkdown('```not a fence``` but text')[0].type).toBe('paragraph')
    expect(() => parseMarkdown('|\n|\n```\n- \n>\n![](')).not.toThrow()
  })
})

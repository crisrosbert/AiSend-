import { describe, expect, it } from 'vitest'
import { parseInline } from './inline-markup'

describe('parseInline', () => {
  it('returns plain text as a single token', () => {
    expect(parseInline('Just words.')).toEqual([{ type: 'text', text: 'Just words.' }])
  })

  it('reads **bold** spans', () => {
    expect(parseInline('Use **dark on light** codes')).toEqual([
      { type: 'text', text: 'Use ' },
      { type: 'bold', text: 'dark on light' },
      { type: 'text', text: ' codes' },
    ])
  })

  it('reads `code` spans', () => {
    expect(parseInline('Add `?text=` to the link')).toEqual([
      { type: 'text', text: 'Add ' },
      { type: 'code', text: '?text=' },
      { type: 'text', text: ' to the link' },
    ])
  })

  it('reads links to pages on this site', () => {
    expect(parseInline('Try the [link generator](/tools/whatsapp-link-generator) first')).toEqual([
      { type: 'text', text: 'Try the ' },
      { type: 'link', text: 'link generator', href: '/tools/whatsapp-link-generator' },
      { type: 'text', text: ' first' },
    ])
  })

  it('reads https links', () => {
    expect(parseInline('See [Meta](https://developers.facebook.com/docs).')).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'link', text: 'Meta', href: 'https://developers.facebook.com/docs' },
      { type: 'text', text: '.' },
    ])
  })

  it('never turns a javascript: or protocol-relative address into a link', () => {
    expect(parseInline('[x](javascript:alert(1))')).toEqual([{ type: 'text', text: '[x](javascript:alert(1))' }])
    expect(parseInline('[x](//evil.example)')).toEqual([{ type: 'text', text: '[x](//evil.example)' }])
    expect(parseInline('[x](http://plain.example)')).toEqual([{ type: 'text', text: '[x](http://plain.example)' }])
  })

  it('leaves unmatched markers as text', () => {
    expect(parseInline('5 ** 2 and a [lonely bracket')).toEqual([
      { type: 'text', text: '5 ** 2 and a [lonely bracket' },
    ])
  })

  it('handles several kinds in a row', () => {
    const tokens = parseInline('**One** then [two](/a) then `three`')
    expect(tokens.map((t) => t.type)).toEqual(['bold', 'text', 'link', 'text', 'code'])
  })
})

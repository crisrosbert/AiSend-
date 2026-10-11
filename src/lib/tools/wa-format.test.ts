import { describe, expect, it } from 'vitest'
import { formatWhatsApp, type Run } from './wa-format'

const plain = (text: string): Run => ({ text })

describe('formatWhatsApp', () => {
  it('leaves ordinary text alone', () => {
    expect(formatWhatsApp('Hello there')).toEqual([plain('Hello there')])
  })

  it('makes *words* bold', () => {
    expect(formatWhatsApp('Your order *A123* is packed')).toEqual([
      plain('Your order '),
      { text: 'A123', bold: true },
      plain(' is packed'),
    ])
  })

  it('handles italic, strikethrough and monospace', () => {
    expect(formatWhatsApp('_soft_ ~old~ ```code```')).toEqual([
      { text: 'soft', italic: true },
      plain(' '),
      { text: 'old', strike: true },
      plain(' '),
      { text: 'code', mono: true },
    ])
  })

  it('allows one style inside another', () => {
    expect(formatWhatsApp('*bold _and italic_*')).toEqual([
      { text: 'bold ', bold: true },
      { text: 'and italic', bold: true, italic: true },
    ])
  })

  it('does not format when the marker is followed by a space', () => {
    expect(formatWhatsApp('5 * 3 * 2')).toEqual([plain('5 * 3 * 2')])
  })

  it('does not turn underscores inside a word into italics', () => {
    expect(formatWhatsApp('order_shipped_v1 is the name')).toEqual([plain('order_shipped_v1 is the name')])
  })

  it('keeps an unclosed marker as plain text', () => {
    expect(formatWhatsApp('Save *big today')).toEqual([plain('Save *big today')])
  })

  it('does not reach across a new line', () => {
    expect(formatWhatsApp('*one\ntwo*')).toEqual([plain('*one\ntwo*')])
  })

  it('does not format an empty pair', () => {
    expect(formatWhatsApp('a ** b')).toEqual([plain('a ** b')])
  })

  it('does not format inside monospace', () => {
    expect(formatWhatsApp('```*not bold*```')).toEqual([{ text: '*not bold*', mono: true }])
  })

  it('returns nothing for an empty string', () => {
    expect(formatWhatsApp('')).toEqual([])
  })
})

// Tests for the optional auto-open of the chat window: cleaning, the config
// gate, the missing-column retry, and the plain-JavaScript copy inside
// public/widget.js (cut out between AUTO-OPEN-HELPERS-START / -END and run here).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  autoOpenView,
  cleanAutoOpenSeconds,
  cleanExcludeText,
  isMissingAutoOpenColumnError,
  isPathExcluded,
  parseExcludeList,
  withoutAutoOpenColumns,
} from './auto-open'

const src = readFileSync(join(process.cwd(), 'public', 'widget.js'), 'utf8')
const a = src.indexOf('// AUTO-OPEN-HELPERS-START')
const b = src.indexOf('// AUTO-OPEN-HELPERS-END')
const w = new Function(
  src.slice(a, b) + '\nreturn { parseExcludeList: parseExcludeList, isPathExcluded: isPathExcluded };',
)() as {
  parseExcludeList: (v: unknown) => string[]
  isPathExcluded: (p: string, l: string[]) => boolean
}

describe('auto-open settings', () => {
  it('clamps seconds to 1-120 and defaults to 5', () => {
    expect(cleanAutoOpenSeconds(5)).toBe(5)
    expect(cleanAutoOpenSeconds(0)).toBe(1)
    expect(cleanAutoOpenSeconds(999)).toBe(120)
    expect(cleanAutoOpenSeconds('abc')).toBe(5)
    expect(cleanAutoOpenSeconds(undefined)).toBe(5)
  })
  it('parses and cleans the exclude list', () => {
    expect(parseExcludeList('/Checkout\n /contact , form,/checkout')).toEqual(['/checkout', '/contact', 'form'])
    expect(parseExcludeList(null)).toEqual([])
    expect(cleanExcludeText('A\n\nB')).toBe('a\nb')
    expect(parseExcludeList(Array.from({ length: 50 }, (_, i) => 'p' + i).join('\n'))).toHaveLength(20)
  })
  it('config gate: off unless explicitly true, bad values cleaned', () => {
    expect(autoOpenView({})).toEqual({ auto_open_enabled: false, auto_open_seconds: 5, auto_open_exclude: '' })
    expect(autoOpenView({ auto_open_enabled: 'true' }).auto_open_enabled).toBe(false)
    expect(autoOpenView({ auto_open_enabled: true, auto_open_seconds: 8, auto_open_exclude: '/x' })).toEqual({
      auto_open_enabled: true, auto_open_seconds: 8, auto_open_exclude: '/x',
    })
  })
  it('detects missing-column errors and strips the columns', () => {
    expect(isMissingAutoOpenColumnError({ code: '42703', message: 'column "auto_open_enabled" does not exist' })).toBe(true)
    expect(isMissingAutoOpenColumnError({ code: 'PGRST204', message: "Could not find the 'auto_open_seconds' column" })).toBe(true)
    expect(isMissingAutoOpenColumnError({ code: '42703', message: 'column "bot_name" does not exist' })).toBe(false)
    expect(isMissingAutoOpenColumnError(null)).toBe(false)
    expect(withoutAutoOpenColumns({ a: 1, auto_open_enabled: true, auto_open_seconds: 5, auto_open_exclude: '' })).toEqual({ a: 1 })
  })
})

describe('path matching (server copy and widget.js copy agree)', () => {
  const cases: Array<[string, string[], boolean]> = [
    ['/checkout', ['/checkout'], true],
    ['/checkout/step-2', ['/checkout'], true],
    ['/Checkout', ['/checkout'], true],
    ['/shop/checkout', ['/checkout'], false],
    ['/shop/checkout', ['checkout'], true],
    ['/book-appointment', ['/book*'], true],
    ['/', ['/checkout'], false],
    ['/anything', [], false],
    ['/x', ['*'], false],
  ]
  for (const [path, list, expected] of cases) {
    it(`${path} vs ${JSON.stringify(list)} -> ${expected}`, () => {
      expect(isPathExcluded(path, list)).toBe(expected)
      expect(w.isPathExcluded(path, list)).toBe(expected)
    })
  }
  it('widget.js parser matches the server parser', () => {
    for (const v of ['/a\n/b', 'x, y ,x', '', null, ' /Z ']) {
      expect(w.parseExcludeList(v)).toEqual(parseExcludeList(v))
    }
  })
})

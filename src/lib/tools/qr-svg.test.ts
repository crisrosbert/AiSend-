import { describe, expect, it } from 'vitest'
import { alignmentCenters, buildMatrix, clearZone, eccForOptions, escapeXml, renderQrSvg, type QrRenderOptions } from './qr-svg'

const LINK = 'https://wa.me/919876543210?text=Hi%20there'
const BASE: QrRenderOptions = { fg: '#0c1f17', bg: '#ffffff', dots: 'square', logo: { kind: 'none' } }

function darkCount(size: number, isDark: (r: number, c: number) => boolean): number {
  let n = 0
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (isDark(r, c)) n++
  return n
}

/** Every dark square the "square" style draws, read back out of the path. */
function squareModules(svg: string): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const m of svg.matchAll(/M(-?[\d.]+) (-?[\d.]+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(m[3]); i++) out.push([Number(m[1]) + i, Number(m[2])])
  }
  return out
}

describe('buildMatrix', () => {
  it('makes a square matrix with the three finder corners dark', () => {
    const m = buildMatrix(LINK, 'M')
    expect(m.size).toBeGreaterThanOrEqual(21)
    expect((m.size - 17) % 4).toBe(0)
    expect(m.isDark(0, 0)).toBe(true)
    expect(m.isDark(0, m.size - 1)).toBe(true)
    expect(m.isDark(m.size - 1, 0)).toBe(true)
  })

  it('gets bigger when the text gets longer', () => {
    expect(buildMatrix(LINK + 'x'.repeat(120), 'M').size).toBeGreaterThan(buildMatrix(LINK, 'M').size)
  })
})

describe('renderQrSvg: square dots', () => {
  const m = buildMatrix(LINK, 'M')
  const svg = renderQrSvg(m, BASE)

  it('draws one square for every dark module and no others', () => {
    expect(squareModules(svg)).toHaveLength(darkCount(m.size, m.isDark))
  })

  it('puts the 4-module quiet zone around the code', () => {
    const w = m.size + 8
    expect(svg).toContain(`viewBox="0 0 ${w} ${w}"`)
    const xs = squareModules(svg).map(([x]) => x)
    expect(Math.min(...xs)).toBe(4)
    expect(Math.max(...xs)).toBe(4 + m.size - 1)
  })

  it('uses the chosen colours', () => {
    const custom = renderQrSvg(m, { ...BASE, fg: '#1b6b4a', bg: '#f0faf3' })
    expect(custom).toContain('fill="#1b6b4a"')
    expect(custom).toContain('fill="#f0faf3"')
  })

  it('never writes NaN or Infinity into the picture', () => {
    expect(svg).not.toMatch(/NaN|Infinity/)
  })

  it('declares a size, so it opens at a usable size on its own', () => {
    expect(svg).toMatch(/<svg[^>]*\swidth="\d+"[^>]*\sheight="\d+"/)
  })
})

describe('renderQrSvg: rounded and dotted styles', () => {
  const m = buildMatrix(LINK, 'M')
  const inFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= m.size - 7) || (r >= m.size - 7 && c < 7)
  const outsideFinders = darkCount(m.size, (r, c) => m.isDark(r, c) && !inFinder(r, c))

  it('rounded: draws each data module as a rounded square and the corners as shaped eyes', () => {
    const svg = renderQrSvg(m, { ...BASE, dots: 'rounded' })
    expect(svg.match(/<rect [^>]*width="1" height="1" rx="[\d.]+"/g) ?? []).toHaveLength(outsideFinders)
    expect(svg).toContain('fill-rule="evenodd"')
  })

  it('dots: draws data modules as circles, but keeps the small alignment target square', () => {
    const svg = renderQrSvg(m, { ...BASE, dots: 'dots' })
    const circles = (svg.match(/<circle [^>]*data-m/g) ?? []).length
    const squares = (svg.match(/<rect [^>]*width="1" height="1"/g) ?? []).length
    expect(circles + squares).toBe(outsideFinders)
    expect(circles).toBeGreaterThan(squares)
    expect(squares).toBeGreaterThan(0)
  })

  it('writes attributes the way XML needs them, so the file opens outside a browser too', () => {
    expect(renderQrSvg(m, { ...BASE, dots: 'dots' })).not.toMatch(/<circle data-m\s/)
  })
})

describe('renderQrSvg: logo', () => {
  const m = buildMatrix(LINK, 'H')
  const zone = clearZone(m.size)

  it('keeps a centred clear zone that is small and odd-sized', () => {
    const side = zone.end - zone.start
    expect(side % 2).toBe(1)
    expect(side / m.size).toBeLessThanOrEqual(0.25)
    expect(zone.start).toBe(m.size - zone.end)
  })

  it('draws no dark module inside the clear zone', () => {
    const svg = renderQrSvg(m, { ...BASE, logo: { kind: 'chat', color: '#1b6b4a' } })
    const inside = squareModules(svg).filter(([x, y]) => {
      const col = x - 4
      const row = y - 4
      return col >= zone.start && col < zone.end && row >= zone.start && row < zone.end
    })
    expect(inside).toEqual([])
    expect(svg).toContain('data-logo="chat"')
  })

  it('embeds an uploaded image logo only when it is a real image data URL', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo='
    const ok = renderQrSvg(m, { ...BASE, logo: { kind: 'image', dataUrl: png } })
    expect(ok).toContain(`href="${png}"`)

    const bad = renderQrSvg(m, { ...BASE, logo: { kind: 'image', dataUrl: 'javascript:alert(1)' } })
    expect(bad).not.toContain('<image')
    expect(bad).not.toContain('javascript')
    const html = renderQrSvg(m, { ...BASE, logo: { kind: 'image', dataUrl: 'data:text/html;base64,PHNjcmlwdD4=' } })
    expect(html).not.toContain('<image')
  })

  it('asks for the strongest error correction when a logo covers the middle', () => {
    expect(eccForOptions(BASE)).toBe('M')
    expect(eccForOptions({ ...BASE, logo: { kind: 'chat', color: '#1b6b4a' } })).toBe('H')
    expect(eccForOptions({ ...BASE, logo: { kind: 'image', dataUrl: 'data:image/png;base64,AAAA' } })).toBe('H')
  })
})

describe('renderQrSvg: frame label', () => {
  const m = buildMatrix(LINK, 'M')

  it('adds a band under the code with the label in it', () => {
    const plain = renderQrSvg(m, BASE)
    const framed = renderQrSvg(m, { ...BASE, frameLabel: 'Scan to chat' })
    const height = (s: string) => Number(s.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)![1])
    expect(height(framed)).toBeGreaterThan(height(plain))
    expect(framed).toContain('>Scan to chat</text>')
  })

  it('escapes the label so it cannot break out of the picture', () => {
    const framed = renderQrSvg(m, { ...BASE, frameLabel: '</text><script>x</script> & "q"' })
    expect(framed).not.toContain('<script>')
    expect(framed).toContain('&lt;/text&gt;&lt;script&gt;')
    expect(framed).toContain('&amp;')
  })

  it('treats an empty label as no frame', () => {
    expect(renderQrSvg(m, { ...BASE, frameLabel: '   ' })).toBe(renderQrSvg(m, BASE))
  })
})

describe('alignmentCenters', () => {
  it('has none for the smallest code', () => {
    expect(alignmentCenters(21)).toEqual([])
  })

  it('has one near the bottom-right corner for versions 2 to 6', () => {
    expect(alignmentCenters(25)).toEqual([[18, 18]])
    expect(alignmentCenters(29)).toEqual([[22, 22]])
  })

  it('has six for version 7, leaving out the three corners taken by the eyes', () => {
    const centers = alignmentCenters(45)
    expect(centers).toHaveLength(6)
    expect(centers).not.toContainEqual([6, 6])
    expect(centers).toContainEqual([38, 38])
  })
})

describe('escapeXml', () => {
  it('escapes the five XML characters', () => {
    expect(escapeXml(`<a href="x">Tom & 'Jerry'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;')
  })
})

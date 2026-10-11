// src/lib/tools/qr-svg.ts
//
// Draws a QR code as an SVG string, so the picture on screen, the downloaded
// SVG and the downloaded PNG are all the same drawing. The squares come from
// the `qrcode` package; everything about how they look (rounded squares,
// dots, a chat badge or your own logo in the middle, a "Scan to chat" frame)
// is decided here and is covered by tests.
//
// A logo or a frame must never make the code unreadable, so:
//  - the middle is cleared for the logo and error correction is raised to the
//    highest level whenever a logo is used,
//  - the quiet zone around the code stays 4 modules wide,
//  - the three corner "eyes" are always drawn, only their corners are rounded.

import QRCode from 'qrcode'

export type DotStyle = 'square' | 'rounded' | 'dots'
export type Ecc = 'L' | 'M' | 'Q' | 'H'

export type QrLogo =
  | { kind: 'none' }
  | { kind: 'chat'; color: string }
  | { kind: 'image'; dataUrl: string }

export interface QrRenderOptions {
  fg: string
  bg: string
  dots: DotStyle
  logo: QrLogo
  /** Text in a band under the code, e.g. "Scan to chat". Blank means no frame. */
  frameLabel?: string
}

export interface QrMatrix {
  size: number
  isDark(row: number, col: number): boolean
}

const QUIET = 4
/** Pixels per module in the width/height written on the SVG itself. */
const DEFAULT_SCALE = 10

export function buildMatrix(text: string, ecc: Ecc): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: ecc })
  const { modules } = qr
  return {
    size: modules.size,
    isDark: (row, col) => modules.get(row, col) === 1,
  }
}

export function eccForOptions(opts: QrRenderOptions): Ecc {
  return opts.logo.kind === 'none' ? 'M' : 'H'
}

/**
 * Centres of the small square "alignment" targets a code of this size has.
 * (Same layout rules as the QR standard; version 1 has none.)
 */
export function alignmentCenters(size: number): Array<[number, number]> {
  const version = (size - 17) / 4
  if (version < 2) return []
  const count = Math.floor(version / 7) + 2
  const step = size === 145 ? 26 : Math.ceil((size - 13) / (2 * count - 2)) * 2
  const coords = [size - 7]
  for (let i = 1; i < count - 1; i++) coords[i] = coords[i - 1] - step
  coords.push(6)
  coords.reverse()
  const last = count - 1
  const out: Array<[number, number]> = []
  for (let i = 0; i < count; i++) {
    for (let j = 0; j < count; j++) {
      // The three corners are taken by the eyes.
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue
      out.push([coords[i], coords[j]])
    }
  }
  return out
}

/** The square in the middle (in modules, end exclusive) that a logo covers. */
export function clearZone(size: number): { start: number; end: number } {
  // About a fifth of the width, and odd, so it sits exactly in the middle.
  let side = Math.round(size * 0.2)
  if (side % 2 === 0) side += 1
  const start = (size - side) / 2
  return { start, end: start + side }
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/

const num = (v: number) => String(Number(v.toFixed(3)))

/** A rounded rectangle as path data (clockwise). */
function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const k = Math.min(r, w / 2, h / 2)
  return [
    `M${num(x + k)} ${num(y)}`,
    `H${num(x + w - k)}`,
    `A${num(k)} ${num(k)} 0 0 1 ${num(x + w)} ${num(y + k)}`,
    `V${num(y + h - k)}`,
    `A${num(k)} ${num(k)} 0 0 1 ${num(x + w - k)} ${num(y + h)}`,
    `H${num(x + k)}`,
    `A${num(k)} ${num(k)} 0 0 1 ${num(x)} ${num(y + h - k)}`,
    `V${num(y + k)}`,
    `A${num(k)} ${num(k)} 0 0 1 ${num(x + k)} ${num(y)}`,
    'Z',
  ].join('')
}

const CHAT_BUBBLE = 'M20 11.5a7.5 7.5 0 0 1-11 6.6L4 19.5l1.4-4.4A7.5 7.5 0 1 1 20 11.5Z'

export function renderQrSvg(matrix: QrMatrix, opts: QrRenderOptions): string {
  const n = matrix.size
  const label = (opts.frameLabel ?? '').trim()
  const framed = label.length > 0
  const width = n + QUIET * 2
  const band = framed ? Math.max(6, Math.round(width * 0.2)) : 0
  const height = width + band

  const hasLogo = opts.logo.kind !== 'none'
  const zone = hasLogo ? clearZone(n) : null
  const inZone = (r: number, c: number) =>
    zone !== null && r >= zone.start && r < zone.end && c >= zone.start && c < zone.end
  const inFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)
  const drawn = (r: number, c: number) => matrix.isDark(r, c) && !inZone(r, c)
  // Dots are hard for some scanners to lock onto in the small alignment
  // targets, so those stay as squares even in the dotted style.
  const targets = alignmentCenters(n)
  const inTarget = (r: number, c: number) => targets.some(([tr, tc]) => Math.abs(r - tr) <= 2 && Math.abs(c - tc) <= 2)

  const parts: string[] = []

  // Background (and the frame, when there is one).
  if (framed) {
    parts.push(
      `<rect x="0.5" y="0.5" width="${num(width - 1)}" height="${num(height - 1)}" rx="3" fill="${opts.bg}" stroke="${opts.fg}" stroke-width="1"/>`,
    )
  } else {
    parts.push(`<rect width="${width}" height="${height}" fill="${opts.bg}"/>`)
  }

  // The squares.
  if (opts.dots === 'square') {
    const runs: string[] = []
    for (let r = 0; r < n; r++) {
      let c = 0
      while (c < n) {
        if (!drawn(r, c)) { c++; continue }
        const from = c
        while (c < n && drawn(r, c)) c++
        const len = c - from
        runs.push(`M${from + QUIET} ${r + QUIET}h${len}v1h-${len}z`)
      }
    }
    parts.push(`<path fill="${opts.fg}" shape-rendering="crispEdges" d="${runs.join('')}"/>`)
  } else {
    const shapes: string[] = []
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!drawn(r, c) || inFinder(r, c)) continue
        const x = c + QUIET
        const y = r + QUIET
        shapes.push(
          opts.dots === 'dots' && !inTarget(r, c)
            ? `<circle data-m="1" cx="${num(x + 0.5)}" cy="${num(y + 0.5)}" r="0.5"/>`
            : `<rect x="${x}" y="${y}" width="1" height="1" rx="0.32"/>`,
        )
      }
    }
    parts.push(`<g fill="${opts.fg}">${shapes.join('')}</g>`)

    // The three eyes, drawn as shapes so their corners can be round.
    const [outer, hole, eye] = opts.dots === 'dots' ? [1.4, 0.8, 1.0] : [1.8, 1.0, 0.9]
    const corners: Array<[number, number]> = [[0, 0], [0, n - 7], [n - 7, 0]]
    const d = corners
      .map(([r, c]) => {
        const x = c + QUIET
        const y = r + QUIET
        return roundedRect(x, y, 7, 7, outer) + roundedRect(x + 1, y + 1, 5, 5, hole) + roundedRect(x + 2, y + 2, 3, 3, eye)
      })
      .join('')
    parts.push(`<path fill="${opts.fg}" fill-rule="evenodd" d="${d}"/>`)
  }

  // Logo in the middle.
  if (zone) {
    const side = zone.end - zone.start
    const x = zone.start + QUIET
    const y = zone.start + QUIET
    if (opts.logo.kind === 'chat') {
      const cx = x + side / 2
      const cy = y + side / 2
      const k = (side * 0.5) / 24
      parts.push(
        `<g data-logo="chat">` +
          `<rect x="${x}" y="${y}" width="${side}" height="${side}" rx="${num(side * 0.22)}" fill="${opts.bg}"/>` +
          `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(side * 0.4)}" fill="${opts.logo.color}"/>` +
          `<path transform="translate(${num(cx - 12 * k)} ${num(cy - 12 * k)}) scale(${num(k)})" d="${CHAT_BUBBLE}" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
        `</g>`,
      )
    } else if (opts.logo.kind === 'image' && IMAGE_DATA_URL.test(opts.logo.dataUrl)) {
      const pad = side * 0.1
      parts.push(
        `<g data-logo="image">` +
          `<rect x="${x}" y="${y}" width="${side}" height="${side}" rx="${num(side * 0.18)}" fill="${opts.bg}"/>` +
          `<image href="${opts.logo.dataUrl}" x="${num(x + pad)}" y="${num(y + pad)}" width="${num(side - pad * 2)}" height="${num(side - pad * 2)}" preserveAspectRatio="xMidYMid meet"/>` +
        `</g>`,
      )
    }
  }

  // The label band.
  if (framed) {
    const fontSize = Math.min(band * 0.46, (width * 0.86) / (label.length * 0.58))
    parts.push(
      `<path d="M${num(width * 0.1)} ${num(width)}H${num(width * 0.9)}" stroke="${opts.fg}" stroke-opacity="0.25" stroke-width="0.4"/>`,
      `<text x="${num(width / 2)}" y="${num(width + band * 0.64)}" font-family="DM Sans, Inter, Arial, sans-serif" font-weight="700" font-size="${num(fontSize)}" text-anchor="middle" fill="${opts.fg}">${escapeXml(label)}</text>`,
    )
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(width)} ${num(height)}" ` +
    `width="${Math.round(width * DEFAULT_SCALE)}" height="${Math.round(height * DEFAULT_SCALE)}" role="img" aria-label="QR code">` +
    parts.join('') +
    `</svg>`
  )
}

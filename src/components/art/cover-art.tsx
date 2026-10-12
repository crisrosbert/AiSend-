// Generated artwork used whenever a post has no `cover` picture, and for the
// cards on the free-tools page. Pure SVG: no files to host, same on every
// device, and each post keeps its own colours and symbol.

import type { ReactNode } from 'react'

export type Motif = 'chat' | 'link' | 'qr' | 'template' | 'chart' | 'widget' | 'rupee' | 'bulk' | 'text' | 'catalog'

const PALETTES = [
  ['#14523A', '#1B6B4A', '#7ED3A8'],
  ['#0F3D4A', '#1B6B7A', '#8EDCE0'],
  ['#1F3B2D', '#2E7D5B', '#C6F0D6'],
] as const

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

const WORDS: ReadonlyArray<[RegExp, Motif]> = [
  [/pric|rupee|cost|api-pricing/, 'rupee'],
  [/qr/, 'qr'],
  [/roi|vs-|compare|calculat/, 'chart'],
  [/template|reject|approval/, 'template'],
  [/widget|button|website|popup/, 'widget'],
  [/link|wa-me|prefill/, 'link'],
]

export function motifFor(text: string): Motif {
  const t = text.toLowerCase()
  for (const [re, m] of WORDS) if (re.test(t)) return m
  return 'chat'
}

function Glyph({ motif }: { motif: Motif }): ReactNode {
  const w = { fill: '#fff' }
  switch (motif) {
    case 'rupee':
      return (
        <g {...w}>
          <rect x="250" y="95" width="140" height="170" rx="22" opacity=".95" />
          <path d="M285 135h70M285 160h70M300 135c30 0 30 45 0 45h-8l42 40" stroke="#14523A" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    case 'qr':
      return (
        <g {...w}>
          <rect x="245" y="90" width="150" height="150" rx="18" />
          {[[262, 107], [338, 107], [262, 183]].map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <rect x={x} y={y} width="40" height="40" rx="6" fill="#14523A" />
              <rect x={x + 11} y={y + 11} width="18" height="18" rx="3" />
            </g>
          ))}
          <rect x="330" y="180" width="14" height="14" fill="#14523A" />
          <rect x="356" y="180" width="14" height="14" fill="#14523A" />
          <rect x="343" y="206" width="14" height="14" fill="#14523A" />
          <rect x="369" y="206" width="14" height="14" fill="#14523A" />
        </g>
      )
    case 'chart':
      return (
        <g {...w}>
          <rect x="235" y="90" width="170" height="160" rx="18" opacity=".95" />
          <rect x="255" y="190" width="26" height="40" rx="5" fill="#7ED3A8" />
          <rect x="295" y="160" width="26" height="70" rx="5" fill="#1B6B4A" />
          <rect x="335" y="125" width="26" height="105" rx="5" fill="#14523A" />
          <rect x="375" y="105" width="0" height="0" />
        </g>
      )
    case 'template':
      return (
        <g {...w}>
          <rect x="225" y="85" width="190" height="115" rx="18" />
          <rect x="245" y="105" width="90" height="10" rx="5" fill="#14523A" />
          <rect x="245" y="127" width="150" height="8" rx="4" fill="#9CCFB4" />
          <rect x="245" y="145" width="130" height="8" rx="4" fill="#9CCFB4" />
          <rect x="225" y="212" width="190" height="34" rx="17" opacity=".9" />
          <rect x="285" y="225" width="70" height="8" rx="4" fill="#14523A" />
        </g>
      )
    case 'widget':
      return (
        <g {...w}>
          <rect x="215" y="85" width="210" height="150" rx="14" opacity=".95" />
          <rect x="215" y="85" width="210" height="24" rx="14" fill="#9CCFB4" />
          <circle cx="395" cy="225" r="34" fill="#25D366" stroke="#fff" strokeWidth="6" />
          <path d="M383 224l8 8 14-17" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    case 'link':
      return (
        <g fill="none" stroke="#fff" strokeWidth="18" strokeLinecap="round">
          <path d="M290 195l-18 18a34 34 0 0 1-48-48l34-34a34 34 0 0 1 48 0" />
          <path d="M350 165l18-18a34 34 0 0 1 48 48l-34 34a34 34 0 0 1-48 0" />
          <path d="M300 195l40-40" />
        </g>
      )
    case 'bulk':
      return (
        <g {...w}>
          <rect x="215" y="85" width="150" height="62" rx="16" opacity=".6" />
          <rect x="245" y="125" width="150" height="62" rx="16" opacity=".8" />
          <rect x="275" y="165" width="150" height="62" rx="16" />
          <rect x="295" y="188" width="80" height="9" rx="4" fill="#1B6B4A" />
          <circle cx="410" cy="232" r="14" fill="#25D366" />
        </g>
      )
    case 'text':
      return (
        <g {...w}>
          <rect x="215" y="100" width="210" height="140" rx="18" />
          <text x="240" y="170" fontSize="58" fontWeight="800" fill="#14523A" fontFamily="Inter, Arial, sans-serif">B</text>
          <text x="290" y="170" fontSize="58" fontStyle="italic" fontWeight="700" fill="#2E7D5B" fontFamily="Inter, Arial, sans-serif">I</text>
          <text x="325" y="170" fontSize="58" fontWeight="700" fill="#2E7D5B" textDecoration="line-through" fontFamily="Inter, Arial, sans-serif">S</text>
          <rect x="240" y="195" width="160" height="9" rx="4" fill="#9CCFB4" />
          <rect x="240" y="213" width="110" height="9" rx="4" fill="#9CCFB4" />
        </g>
      )
    case 'catalog':
      return (
        <g {...w}>
          {[[225, 95], [325, 95], [225, 175], [325, 175]].map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <rect x={x} y={y} width="90" height="70" rx="14" />
              <rect x={x + 14} y={y + 14} width="62" height="26" rx="8" fill="#9CCFB4" />
              <rect x={x + 14} y={y + 48} width="40" height="8" rx="4" fill="#1B6B4A" />
            </g>
          ))}
        </g>
      )
    default:
      return (
        <g {...w}>
          <path d="M235 100h170a22 22 0 0 1 22 22v76a22 22 0 0 1-22 22h-95l-38 32v-32h-37a22 22 0 0 1-22-22v-76a22 22 0 0 1 22-22z" opacity=".96" />
          <circle cx="285" cy="160" r="9" fill="#1B6B4A" />
          <circle cx="320" cy="160" r="9" fill="#1B6B4A" />
          <circle cx="355" cy="160" r="9" fill="#1B6B4A" />
        </g>
      )
  }
}

export function CoverArt({ seed, hint, motif: forced, className }: { seed: string; hint?: string; motif?: Motif; className?: string }) {
  const [a, b, c] = PALETTES[hash(seed) % PALETTES.length]
  const id = `ca-${hash(seed)}`
  const motif = forced ?? motifFor(`${seed} ${hint ?? ''}`)
  const r = hash(seed + 'x')
  return (
    <svg className={className} viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill={`url(#${id})`} />
      <circle cx={80 + (r % 120)} cy="40" r="120" fill={c} opacity=".12" />
      <circle cx={520 - (r % 90)} cy="330" r="150" fill={c} opacity=".14" />
      <circle cx="560" cy={60 + (r % 60)} r="46" fill="#fff" opacity=".08" />
      <Glyph motif={motif} />
    </svg>
  )
}

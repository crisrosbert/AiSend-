// src/lib/tools/chat-widget.ts
//
// Builds the floating "chat on WhatsApp" button that people paste into their
// website. The result is one self-contained block: a <style>, the markup and a
// small <script>. It loads nothing from any other site.
//
// Safety rules the builder keeps, because the output goes onto other
// people's websites:
//  - every piece of text typed into the tool is HTML-escaped, and none of it
//    is ever written into the script (the script reads settings from data-
//    attributes), so no text can close the script or run as code;
//  - the link must be a https WhatsApp address, otherwise a safe stand-in is
//    used;
//  - colours are checked, so a value cannot break out of the stylesheet;
//  - every class starts with "aswa" and every rule is scoped to #aswa, so the
//    widget cannot be restyled by the site it sits on, or restyle it.

import { SITE_URL } from '../seo/site'
import { contrastRatio, normalizeHex } from './qr-style'

export type WidgetSide = 'left' | 'right'
export type WidgetSize = 'small' | 'medium' | 'large'
export type WidgetScreens = 'all' | 'desktop' | 'mobile'

export interface WidgetPopup {
  enabled: boolean
  /** Seconds before the popup opens by itself. 0 to 120. */
  delaySeconds: number
  agentName: string
  agentRole: string
  message: string
  /** Text of the green button inside the popup. */
  cta: string
}

export interface WidgetConfig {
  /** The wa.me link the chat opens. */
  link: string
  position: WidgetSide
  color: string
  size: WidgetSize
  /** Distance from the side edge, in pixels. 0 to 120. */
  offsetX: number
  /** Distance from the bottom edge, in pixels. 0 to 120. */
  offsetY: number
  /** Optional words next to the icon. Empty means icon only. */
  label: string
  showOn: WidgetScreens
  pulse: boolean
  /** A small "Made with AiSend" link at the bottom of the popup. */
  poweredBy: boolean
  popup: WidgetPopup
}

export const DEFAULT_WIDGET: WidgetConfig = {
  link: '',
  position: 'right',
  color: '#1b6b4a',
  size: 'medium',
  offsetX: 20,
  offsetY: 20,
  label: '',
  showOn: 'all',
  pulse: true,
  poweredBy: true,
  popup: {
    enabled: true,
    delaySeconds: 5,
    agentName: 'Support team',
    agentRole: 'Ask us anything',
    message: 'Hi there! How can we help you today?',
    cta: 'Start chat',
  },
}

const DARK_TEXT = '#0c1f17'
const LIGHT_TEXT = '#ffffff'
const SIZES: Record<WidgetSize, number> = { small: 52, medium: 60, large: 68 }
const FALLBACK_LINK = 'https://wa.me/'
const MAX = { label: 28, agentName: 30, agentRole: 50, message: 220, cta: 28 } as const

/** Only https WhatsApp click-to-chat addresses are allowed on the button. */
export function isSafeWhatsAppLink(link: string): boolean {
  return /^https:\/\/wa\.me\/[^\s]*$/i.test(link) || /^https:\/\/api\.whatsapp\.com\/send(\?[^\s]*)?$/i.test(link)
}

/** The icon colour that stays readable on the button colour: dark or white. */
export function readableTextColor(background: string): string {
  const bg = normalizeHex(background)
  if (!bg) return LIGHT_TEXT
  return contrastRatio(bg, DARK_TEXT) >= contrastRatio(bg, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** One line, trimmed and cut to length, ready to be shown as text. */
function text(value: string, max: number): string {
  return escapeHtml(value.replace(/\s+/g, ' ').trim().slice(0, max))
}

function whole(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

// A plain speech bubble. It is not a brand logo.
const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4 19.5l1.4-4.4A7.5 7.5 0 1 1 20 11.5Z"/><path d="M9 11.5h.01M12 11.5h.01M15 11.5h.01"/></svg>'

function styles(c: { color: string; ink: string; size: number; x: number; y: number; side: WidgetSide; pulse: boolean; showOn: WidgetScreens; breakpoint: number }): string {
  const rules = [
    `#aswa{--aswa-c:${c.color};--aswa-t:${c.ink};--aswa-s:${c.size}px;--aswa-x:${c.x}px;--aswa-y:${c.y}px;position:fixed;bottom:var(--aswa-y);z-index:99999;display:flex;flex-direction:column;font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}`,
    '#aswa,#aswa *{box-sizing:border-box}',
    '#aswa.aswa--right{right:var(--aswa-x);align-items:flex-end}',
    '#aswa.aswa--left{left:var(--aswa-x);align-items:flex-start}',
    '#aswa .aswa__btn{position:relative;display:flex;align-items:center;justify-content:center;gap:10px;height:var(--aswa-s);min-width:var(--aswa-s);margin:0;padding:0 calc(var(--aswa-s)*.27);border:0;border-radius:999px;background:var(--aswa-c);color:var(--aswa-t);box-shadow:0 8px 24px rgba(0,0,0,.22);cursor:pointer;font:inherit;font-weight:600;line-height:1;text-decoration:none;transition:transform .15s ease}',
    '#aswa .aswa__btn:hover{transform:translateY(-2px)}',
    '#aswa .aswa__btn:focus-visible{outline:3px solid var(--aswa-c);outline-offset:3px}',
    '#aswa .aswa__btn svg{display:block;flex:none;width:calc(var(--aswa-s)*.46);height:calc(var(--aswa-s)*.46)}',
    '#aswa .aswa__label{white-space:nowrap;font-size:15px}',
    '#aswa .aswa__card{position:relative;width:min(320px,calc(100vw - 32px));margin:0 0 14px;padding:16px;border-radius:16px;background:#fff;color:#1f2937;box-shadow:0 18px 48px rgba(0,0,0,.25)}',
    '#aswa .aswa__card[hidden]{display:none}',
    '#aswa .aswa__x{position:absolute;top:8px;right:8px;width:28px;height:28px;margin:0;padding:0;border:0;border-radius:50%;background:transparent;color:#6b7280;font:inherit;font-size:20px;line-height:1;cursor:pointer}',
    '#aswa .aswa__x:hover{background:#f3f4f6}',
    '#aswa .aswa__head{display:flex;align-items:center;gap:10px;margin:0 0 12px;padding-right:24px}',
    '#aswa .aswa__avatar{flex:none;display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:var(--aswa-c);color:var(--aswa-t);font-weight:700}',
    '#aswa .aswa__who strong{display:block;font-size:15px;line-height:1.2}',
    '#aswa .aswa__who span{display:block;margin-top:2px;font-size:12.5px;color:#6b7280}',
    '#aswa .aswa__msg{margin:0 0 14px;padding:10px 12px;border-radius:4px 14px 14px 14px;background:#f3f4f6;font-size:14px}',
    '#aswa .aswa__cta{display:block;padding:11px 14px;border-radius:999px;background:var(--aswa-c);color:var(--aswa-t);text-align:center;font-weight:600;text-decoration:none}',
    '#aswa .aswa__by{display:block;margin-top:10px;font-size:11.5px;text-align:center;color:#9ca3af;text-decoration:none}',
  ]

  if (c.pulse) {
    rules.push(
      '@media (prefers-reduced-motion: no-preference){@keyframes aswa-pulse{0%{transform:scale(1);opacity:.5}100%{transform:scale(1.55);opacity:0}}#aswa.aswa--pulse .aswa__btn::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--aswa-c);pointer-events:none;animation:aswa-pulse 2.2s ease-out infinite}}',
    )
  }
  if (c.showOn === 'desktop') rules.push(`@media (max-width: ${c.breakpoint - 1}px){#aswa{display:none!important}}`)
  if (c.showOn === 'mobile') rules.push(`@media (min-width: ${c.breakpoint}px){#aswa{display:none!important}}`)

  return rules.join('\n')
}

const SCRIPT = `(function(){
var root=document.getElementById('aswa');
var card=document.getElementById('aswa-card');
var btn=document.getElementById('aswa-btn');
if(!root||!card||!btn||root.getAttribute('data-popup')!=='1')return;
var KEY='aswa-closed';
function seen(){try{return window.sessionStorage.getItem(KEY)==='1'}catch(e){return false}}
function remember(){try{window.sessionStorage.setItem(KEY,'1')}catch(e){}}
function show(){card.hidden=false;btn.setAttribute('aria-expanded','true')}
function hide(){card.hidden=true;btn.setAttribute('aria-expanded','false');remember()}
btn.addEventListener('click',function(){if(card.hidden){show()}else{hide()}});
var close=card.querySelector('.aswa__x');
if(close)close.addEventListener('click',function(){hide();btn.focus()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!card.hidden){hide();btn.focus()}});
var delay=parseInt(root.getAttribute('data-delay'),10)||0;
if(!seen())setTimeout(show,delay*1000);
})();`

/** Screens narrower than this count as a phone. Matches the usual tablet line. */
const DEFAULT_BREAKPOINT = 768

export interface SnippetOptions {
  /**
   * Width in pixels where "phone" ends and "computer" starts. The code you copy
   * always uses the default; the narrow preview frame passes a smaller one so
   * it can show both layouts.
   */
  breakpoint?: number
}

/** The block to paste just before </body> on the website. */
export function buildWidgetSnippet(config: WidgetConfig, options: SnippetOptions = {}): string {
  const bp = options.breakpoint
  const breakpoint = typeof bp === 'number' && Number.isFinite(bp) && bp >= 2 ? Math.round(bp) : DEFAULT_BREAKPOINT
  const color = normalizeHex(config.color) ?? normalizeHex(DEFAULT_WIDGET.color)!
  const link = escapeHtml(isSafeWhatsAppLink(config.link) ? config.link : FALLBACK_LINK)
  const size = SIZES[config.size] ?? SIZES.medium
  const label = text(config.label, MAX.label)
  const popup = config.popup
  const side: WidgetSide = config.position === 'left' ? 'left' : 'right'
  const showOn: WidgetScreens = config.showOn === 'desktop' || config.showOn === 'mobile' ? config.showOn : 'all'

  const css = styles({
    color,
    ink: readableTextColor(color),
    size,
    x: whole(config.offsetX, 0, 120),
    y: whole(config.offsetY, 0, 120),
    side,
    pulse: config.pulse,
    showOn,
    breakpoint,
  })

  const classes = ['aswa', `aswa--${side}`, config.pulse ? 'aswa--pulse' : ''].filter(Boolean).join(' ')
  const labelHtml = label ? `<span class="aswa__label">${label}</span>` : ''
  const nameAttr = label ? '' : ' aria-label="Chat on WhatsApp"'

  let inner: string
  let attrs: string
  if (popup.enabled) {
    const agent = text(popup.agentName, MAX.agentName)
    const initial = escapeHtml((popup.agentName.trim().charAt(0) || 'W').toUpperCase())
    const role = text(popup.agentRole, MAX.agentRole)
    const message = text(popup.message, MAX.message)
    const cta = text(popup.cta, MAX.cta) || 'Start chat'
    const byHtml = config.poweredBy
      ? `\n    <a class="aswa__by" href="${escapeHtml(`${SITE_URL}/?utm_source=chat-widget&utm_medium=widget&utm_campaign=made-with`)}" target="_blank" rel="nofollow noopener noreferrer">Made with AiSend</a>`
      : ''
    inner = `
  <div id="aswa-card" class="aswa__card" role="dialog" aria-label="Chat on WhatsApp" hidden>
    <button type="button" class="aswa__x" aria-label="Close">&times;</button>
    <div class="aswa__head">
      <span class="aswa__avatar" aria-hidden="true">${initial}</span>
      <div class="aswa__who"><strong>${agent}</strong>${role ? `<span>${role}</span>` : ''}</div>
    </div>
    <p class="aswa__msg">${message}</p>
    <a class="aswa__cta" href="${link}" target="_blank" rel="noopener noreferrer">${cta}</a>${byHtml}
  </div>
  <button type="button" id="aswa-btn" class="aswa__btn" aria-expanded="false" aria-controls="aswa-card"${nameAttr}>${ICON}${labelHtml}</button>
`
    attrs = ` data-popup="1" data-delay="${whole(popup.delaySeconds, 0, 120)}"`
  } else {
    inner = `
  <a id="aswa-btn" class="aswa__btn" href="${link}" target="_blank" rel="noopener noreferrer"${nameAttr}>${ICON}${labelHtml}</a>
`
    attrs = ' data-popup="0"'
  }

  return [
    '<!-- WhatsApp chat button. Paste this block just before </body>. -->',
    `<style>\n${css}\n</style>`,
    `<div id="aswa" class="${classes}"${attrs}>${inner}</div>`,
    popup.enabled ? `<script>${SCRIPT}</script>` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** A neutral stand-in for a website, with the widget on top, for the preview. */
export function buildPreviewDocument(snippet: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preview</title>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#334155;background:#f8fafc}
.bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;background:#fff;border-bottom:1px solid #e2e8f0}
.logo{width:92px;height:18px;border-radius:4px;background:#cbd5e1}
.nav{display:flex;gap:10px}.nav i{display:block;width:44px;height:10px;border-radius:4px;background:#e2e8f0}
.hero{padding:44px 20px 28px;max-width:760px;margin:0 auto}
.hero b{display:block;width:70%;height:26px;border-radius:6px;background:#cbd5e1;margin-bottom:12px}
.hero b+b{width:48%}
.hero p{margin:16px 0 0;font-size:14px;line-height:1.6;color:#64748b}
.btn{display:inline-block;margin-top:18px;padding:11px 22px;border-radius:8px;background:#94a3b8;color:#fff;font-size:14px;font-weight:600}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;max-width:760px;margin:12px auto 0;padding:0 20px 80px}
.card{height:120px;border-radius:12px;background:#fff;border:1px solid #e2e8f0}
</style>
</head>
<body>
<div class="bar"><span class="logo"></span><span class="nav"><i></i><i></i><i></i></span></div>
<div class="hero"><b></b><b></b><p>Your website content appears here. The chat button floats above it, just as it will on your real pages.</p><span class="btn">Get started</span></div>
<div class="cards"><div class="card"></div><div class="card"></div><div class="card"></div></div>
${snippet}
</body>
</html>`
}

'use client'

// src/app/tools/whatsapp-text-formatter/formatter-tool.tsx
//
// Zero-dependency, same as every other /tools page: everything happens
// in this component, nothing is saved or sent anywhere.
//
// The interaction that makes this feel like a real editor rather than
// a "type then click a button that wraps the whole box" gadget: select
// a WORD or PHRASE inside the textarea, then click a format button —
// only the selection gets wrapped, the cursor lands back where it was,
// and the live preview updates instantly.

import { useRef, useState } from 'react'
import { Bold, Italic, Strikethrough, Code2, List, ListOrdered, Quote, Copy } from 'lucide-react'

type WrapFormat = 'bold' | 'italic' | 'strike' | 'mono'
type LineFormat = 'bullet' | 'number' | 'quote'

const WRAP_CHARS: Record<WrapFormat, string> = {
  bold: '*',
  italic: '_',
  strike: '~',
  mono: '```',
}

const SAMPLE = `Hey! Just confirming your *order #4521* is on the way 🚚

_Delivery window:_ Today, 4–7 PM

What's inside:
- 2x Cotton T-Shirt (M)
- 1x Canvas Tote Bag

Track it here: ~old link removed~ tracking.example.com/4521

> Reply to this message anytime — a real person reads it.`

export function FormatterTool() {
  const [text, setText] = useState(SAMPLE)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function applyWrap(format: WrapFormat) {
    const el = textareaRef.current
    if (!el) return
    const marker = WRAP_CHARS[format]
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = text.slice(start, end)
    const placeholder = selected || 'text'

    const next = text.slice(0, start) + marker + placeholder + marker + text.slice(end)
    setText(next)

    const cursorStart = start + marker.length
    const cursorEnd = cursorStart + placeholder.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursorStart, cursorEnd)
    })
  }

  function applyLinePrefix(format: LineFormat) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd

    // Expand the selection to cover whole lines, so prefixing works
    // correctly even when the cursor is mid-line.
    const lineStart = text.lastIndexOf('\n', start - 1) + 1
    let lineEnd = text.indexOf('\n', end)
    if (lineEnd === -1) lineEnd = text.length

    const block = text.slice(lineStart, lineEnd)
    const lines = block.split('\n')
    let counter = 1
    const prefixed = lines
      .map((line) => {
        if (!line.trim()) return line
        if (format === 'bullet') return `- ${line.replace(/^-\s*/, '')}`
        if (format === 'quote') return `> ${line.replace(/^>\s*/, '')}`
        return `${counter++}. ${line.replace(/^\d+\.\s*/, '')}`
      })
      .join('\n')

    const next = text.slice(0, lineStart) + prefixed + text.slice(lineEnd)
    setText(next)
    requestAnimationFrame(() => el.focus())
  }

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <div className="wtf-wrap">
      <style>{`
        .wtf-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
        @media (max-width: 860px) { .wtf-wrap { grid-template-columns: 1fr; } }

        .wtf-panel { min-width: 0; background: #fff; border: 1px solid #e6ece9; border-radius: 18px; overflow: hidden; box-shadow: 0 8px 24px -14px rgba(11,35,26,.12); }
        .wtf-panel-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #eef2f0; background: #fafcfb; }
        .wtf-panel-title { font-size: 12.5px; font-weight: 700; color: #5b6b63; text-transform: uppercase; letter-spacing: .04em; }

        .wtf-toolbar { display: flex; gap: 4px; padding: 10px 12px; border-bottom: 1px solid #eef2f0; flex-wrap: wrap; }
        .wtf-tbtn {
          display: flex; align-items: center; gap: 5px; border: 1px solid #e2e8e4; background: #fbfdfc;
          color: #46584f; font-size: 12px; font-weight: 600; padding: 7px 10px; border-radius: 8px;
          cursor: pointer; font-family: inherit;
        }
        .wtf-tbtn:hover { background: #eefaf3; border-color: #bfe8d5; color: #0f6e37; }

        .wtf-textarea {
          width: 100%; min-height: 260px; border: none; outline: none; resize: vertical;
          padding: 16px; font-size: 14px; line-height: 1.6; font-family: 'JetBrains Mono', monospace;
          color: #0c1f17; background: #fff;
        }

        .wtf-copybtn {
          display: flex; align-items: center; gap: 6px; border: none; background: none; color: #0f6e37;
          font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit;
        }

        .wtf-preview-body {
          min-height: 292px; padding: 16px;
          background-color: #E9FBEF;
          background-image: radial-gradient(rgba(37,211,102,.16) 1px, transparent 1.5px), radial-gradient(rgba(37,211,102,.10) 1px, transparent 1.5px);
          background-size: 26px 26px, 26px 26px; background-position: 0 0, 13px 13px;
        }
        .wtf-bubble { max-width: 92%; background: #fff; border-radius: 4px 12px 12px 12px; padding: 10px 13px; font-size: 13.5px; color: #0c1f17; box-shadow: 0 1px 2px rgba(0,0,0,.08); white-space: pre-wrap; word-break: break-word; line-height: 1.55; }
        .wtf-bubble :where(strong,em,s,code) { }
        .wtf-bubble code { background: #f1f5f3; padding: 1px 5px; border-radius: 5px; font-family: 'JetBrains Mono', monospace; font-size: 12.5px; }
        .wtf-bubble .wtf-quote { display: block; border-left: 3px solid #cdeee5; padding-left: 10px; color: #5b6b63; margin: 2px 0; }
        .wtf-bubble .wtf-bullet { display: block; padding-left: 4px; }
      `}</style>

      <div className="wtf-panel">
        <div className="wtf-panel-head">
          <span className="wtf-panel-title">Your message</span>
          <button className="wtf-copybtn" onClick={handleCopy}>
            <Copy size={13} /> {copied ? 'Copied ✓' : 'Copy formatted text'}
          </button>
        </div>
        <div className="wtf-toolbar">
          <button className="wtf-tbtn" onClick={() => applyWrap('bold')}><Bold size={13} /> Bold</button>
          <button className="wtf-tbtn" onClick={() => applyWrap('italic')}><Italic size={13} /> Italic</button>
          <button className="wtf-tbtn" onClick={() => applyWrap('strike')}><Strikethrough size={13} /> Strike</button>
          <button className="wtf-tbtn" onClick={() => applyWrap('mono')}><Code2 size={13} /> Mono</button>
          <button className="wtf-tbtn" onClick={() => applyLinePrefix('bullet')}><List size={13} /> Bullets</button>
          <button className="wtf-tbtn" onClick={() => applyLinePrefix('number')}><ListOrdered size={13} /> Numbered</button>
          <button className="wtf-tbtn" onClick={() => applyLinePrefix('quote')}><Quote size={13} /> Quote</button>
        </div>
        <textarea
          ref={textareaRef}
          className="wtf-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your message, then select a word and click a format button…"
        />
      </div>

      <div className="wtf-panel">
        <div className="wtf-panel-head">
          <span className="wtf-panel-title">Live preview</span>
        </div>
        <div className="wtf-preview-body">
          <div className="wtf-bubble">{renderWhatsAppMarkup(text)}</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Turns WhatsApp's own formatting syntax into React nodes for the
 * preview bubble — the same syntax WhatsApp itself renders, so what's
 * shown here is what the recipient actually sees, not an approximation.
 */
function renderWhatsAppMarkup(input: string) {
  const lines = input.split('\n')
  return lines.map((line, i) => {
    const key = `l${i}`
    if (/^>\s?/.test(line)) {
      return (
        <span key={key} className="wtf-quote">
          {inline(line.replace(/^>\s?/, ''))}
          {'\n'}
        </span>
      )
    }
    if (/^-\s?/.test(line)) {
      return (
        <span key={key} className="wtf-bullet">
          {'• '}{inline(line.replace(/^-\s?/, ''))}
          {'\n'}
        </span>
      )
    }
    return (
      <span key={key}>
        {inline(line)}
        {i < lines.length - 1 ? '\n' : ''}
      </span>
    )
  })
}

function inline(line: string) {
  // Split on the four inline markers, alternating plain / matched text.
  const tokens: Array<{ text: string; type: 'plain' | 'bold' | 'italic' | 'strike' | 'mono' }> = []
  const re = /```(.+?)```|\*(.+?)\*|_(.+?)_|~(.+?)~/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) tokens.push({ text: line.slice(last, m.index), type: 'plain' })
    if (m[1] !== undefined) tokens.push({ text: m[1], type: 'mono' })
    else if (m[2] !== undefined) tokens.push({ text: m[2], type: 'bold' })
    else if (m[3] !== undefined) tokens.push({ text: m[3], type: 'italic' })
    else if (m[4] !== undefined) tokens.push({ text: m[4], type: 'strike' })
    last = re.lastIndex
  }
  if (last < line.length) tokens.push({ text: line.slice(last), type: 'plain' })

  return tokens.map((t, i) => {
    const key = `t${i}`
    if (t.type === 'bold') return <strong key={key}>{t.text}</strong>
    if (t.type === 'italic') return <em key={key}>{t.text}</em>
    if (t.type === 'strike') return <s key={key}>{t.text}</s>
    if (t.type === 'mono') return <code key={key}>{t.text}</code>
    return <span key={key}>{t.text}</span>
  })
}

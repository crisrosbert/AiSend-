'use client'

// src/app/tools/whatsapp-text-formatter/formatter-tool.tsx
//
// Zero-dependency, same as every other /tools page: everything happens
// in this component, nothing is saved or sent anywhere.
//
// This is a true WYSIWYG editor rather than a "type markup, read a
// preview" split: bold looks bold while you type, inside the box. The
// WhatsApp markup (*bold*, _italic_, ~strike~) is only generated at the
// moment you copy or send, by walking the editor's DOM.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Quote, Code2, RemoveFormatting, Copy, Check,
} from 'lucide-react'

// Starts with unformatted text on purpose: if it opened with a bold word,
// clearing the box and typing would inherit bold from the deleted caret.
const SAMPLE_HTML =
  '<div>Hi Priya, your order <b>#4521</b> is confirmed ✅</div>' +
  '<div><i>Delivery window:</i> Today, 4–7 PM</div>' +
  '<div><br></div>' +
  '<ul><li>2x Cotton T-Shirt (M)</li><li>1x Canvas Tote Bag</li></ul>' +
  '<blockquote>Reply here anytime — a real person reads it.</blockquote>'

// Static config — the actual editing commands run in the click handler,
// never during render.
const TOOLBAR: Array<{ key: string; label: string; icon: React.ReactNode; divider?: boolean }> = [
  { key: 'bold', label: 'Bold', icon: <Bold size={16} /> },
  { key: 'italic', label: 'Italic', icon: <Italic size={16} /> },
  { key: 'strikeThrough', label: 'Strikethrough', icon: <Strikethrough size={16} /> },
  { key: 'insertOrderedList', label: 'Numbered list', icon: <ListOrdered size={16} />, divider: true },
  { key: 'insertUnorderedList', label: 'Bulleted list', icon: <List size={16} /> },
  { key: 'blockquote', label: 'Quote', icon: <Quote size={16} />, divider: true },
  { key: 'code', label: 'Monospace', icon: <Code2 size={16} /> },
  { key: 'removeFormat', label: 'Clear formatting', icon: <RemoveFormatting size={16} />, divider: true },
]

export function FormatterTool() {
  const editorRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [active, setActive] = useState<Record<string, boolean>>({})
  const [isEmpty, setIsEmpty] = useState(false)

  // A "cleared" contenteditable still contains a <br>, so :empty never
  // matches — emptiness has to be measured from the text itself.
  const syncEmpty = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    setIsEmpty(el.textContent?.trim() === '')
  }, [])

  const syncActive = useCallback(() => {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return

    const state = (cmd: string) => {
      try {
        return document.queryCommandState(cmd)
      } catch {
        return false
      }
    }
    setActive({
      bold: state('bold'),
      italic: state('italic'),
      strikeThrough: state('strikeThrough'),
      insertUnorderedList: state('insertUnorderedList'),
      insertOrderedList: state('insertOrderedList'),
      code: !!closestTag(sel.anchorNode, 'CODE', el),
      blockquote: !!closestTag(sel.anchorNode, 'BLOCKQUOTE', el),
    })
  }, [])

  useEffect(() => {
    // The editor's content is owned by the DOM, never by React. If it were
    // passed as dangerouslySetInnerHTML, every re-render (each keystroke
    // updates the toolbar's active state) would reset the element's
    // children and wipe what the person just typed.
    // The sample always leaves the editor non-empty, so the placeholder
    // state starts out correct and needs no sync here.
    const el = editorRef.current
    if (el && el.innerHTML.trim() === '') el.innerHTML = SAMPLE_HTML

    // Emit <b>/<i>/<s> tags instead of styled spans, so the markup
    // serializer below has simple, predictable elements to walk.
    try {
      document.execCommand('styleWithCSS', false, 'false')
    } catch {
      /* not supported — the serializer also reads inline styles as a fallback */
    }
    document.addEventListener('selectionchange', syncActive)
    return () => document.removeEventListener('selectionchange', syncActive)
  }, [syncActive])

  function exec(command: string, value?: string) {
    editorRef.current?.focus()
    try {
      document.execCommand(command, false, value)
    } catch {
      /* ignore — nothing to do if the browser refuses the command */
    }
    syncActive()
    syncEmpty()
  }

  function toggleCode() {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0) return

    const existing = closestTag(sel.anchorNode, 'CODE', el)
    if (existing) {
      unwrap(existing)
      syncActive()
      return
    }

    const range = sel.getRangeAt(0)
    if (range.collapsed) return
    const code = document.createElement('code')
    try {
      range.surroundContents(code)
    } catch {
      // Range crosses element boundaries — extract and re-insert instead.
      code.appendChild(range.extractContents())
      range.insertNode(code)
    }
    sel.removeAllRanges()
    syncActive()
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    // Paste as plain text, so copied web content doesn't drag fonts,
    // colours, and background styles into the message.
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    try {
      document.execCommand('insertText', false, text)
    } catch {
      /* ignore */
    }
  }

  function handleCopy() {
    const el = editorRef.current
    if (!el) return
    navigator.clipboard
      .writeText(toWhatsAppMarkup(el))
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        /* clipboard blocked — nothing useful to show */
      })
  }

  function handleSend() {
    const el = editorRef.current
    if (!el) return
    const markup = toWhatsAppMarkup(el)
    window.open(`https://wa.me/?text=${encodeURIComponent(markup)}`, '_blank', 'noopener,noreferrer')
  }

  // execCommand('removeFormat') only strips inline styling — it leaves
  // lists, quotes, and monospace in place, which isn't what "clear
  // formatting" means to the person clicking it.
  function clearFormatting() {
    const el = editorRef.current
    if (!el) return
    el.focus()

    const run = (cmd: string, value?: string) => {
      try {
        document.execCommand(cmd, false, value)
      } catch {
        /* ignore */
      }
    }
    const state = (cmd: string) => {
      try {
        return document.queryCommandState(cmd)
      } catch {
        return false
      }
    }

    run('removeFormat')
    if (state('insertUnorderedList')) run('insertUnorderedList')
    if (state('insertOrderedList')) run('insertOrderedList')
    run('formatBlock', '<div>')

    const sel = window.getSelection()
    if (sel) {
      el.querySelectorAll('code').forEach((c) => {
        if (sel.containsNode(c, true)) unwrap(c)
      })
    }

    syncActive()
    syncEmpty()
  }

  function runTool(key: string) {
    switch (key) {
      case 'code':
        toggleCode()
        break
      case 'blockquote':
        exec('formatBlock', '<blockquote>')
        break
      case 'removeFormat':
        clearFormatting()
        break
      default:
        exec(key)
    }
  }

  return (
    <div className="wtf-shell">
      <style>{`
        .wtf-shell { max-width: 720px; margin: 0 auto; }

        .wtf-card {
          background: #fff; border: 1px solid #e3eae6; border-radius: 14px; overflow: hidden;
          box-shadow: 0 10px 30px -20px rgba(11,35,26,.35);
        }
        .wtf-toolbar {
          display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 2px;
          padding: 9px 12px; border-bottom: 1px solid #eef2f0; background: #fcfdfd;
        }
        .wtf-tbtn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border: none; border-radius: 8px; cursor: pointer;
          background: transparent; color: #55665e; font-family: inherit; transition: background .12s, color .12s;
        }
        .wtf-tbtn:hover { background: #eef3f1; color: #0b231a; }
        .wtf-tbtn[data-active="true"] { background: #e3f6ea; color: #0f6e37; }
        .wtf-sep { width: 1px; height: 20px; background: #e6ece9; margin: 0 6px; }

        .wtf-editor {
          min-height: 190px; padding: 18px 20px; outline: none; font-size: 15px; line-height: 1.7;
          color: #12241c; overflow-wrap: break-word;
        }
        .wtf-editor[data-empty="true"]::before {
          content: attr(data-placeholder); color: #a3b0a9; pointer-events: none;
        }
        /* the app's global reset strips list markers — put them back here */
        .wtf-editor ul { margin: 6px 0; padding-left: 26px; list-style: disc outside; }
        .wtf-editor ol { margin: 6px 0; padding-left: 26px; list-style: decimal outside; }
        .wtf-editor li { margin: 2px 0; display: list-item; }
        .wtf-editor blockquote {
          margin: 8px 0; padding: 2px 0 2px 12px; border-left: 3px solid #cfe9dc; color: #4d5f57;
        }
        .wtf-editor code {
          background: #f1f5f3; border-radius: 5px; padding: 1px 5px;
          font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13.5px;
        }

        .wtf-actions { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 22px; }
        .wtf-btn {
          display: inline-flex; align-items: center; gap: 9px; border: none; cursor: pointer;
          font-family: inherit; font-size: 14.5px; font-weight: 700; color: #fff;
          padding: 13px 24px; border-radius: 11px; text-decoration: none; transition: filter .12s, transform .12s;
        }
        .wtf-btn:hover { filter: brightness(1.06); transform: translateY(-1px); }
        .wtf-btn--copy { background: #075E54; }
        .wtf-btn--send { background: #25D366; }

        .wtf-steps {
          display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px;
          margin-top: 26px; font-size: 13px; color: #5b6b63;
        }
        .wtf-step { display: inline-flex; align-items: center; gap: 7px; }
        .wtf-stepnum {
          display: inline-flex; align-items: center; justify-content: center;
          width: 21px; height: 21px; border-radius: 50%; background: #1DA851; color: #fff;
          font-size: 11.5px; font-weight: 800;
        }
        .wtf-arrow { color: #b9c6bf; }
        @media (max-width: 430px) { .wtf-arrow { display: none; } }
      `}</style>

      <div className="wtf-card">
        <div className="wtf-toolbar">
          {TOOLBAR.map((t) => (
            <span key={t.key} style={{ display: 'inline-flex', alignItems: 'center' }}>
              {t.divider && <span className="wtf-sep" />}
              <button
                type="button"
                className="wtf-tbtn"
                data-active={active[t.key] ? 'true' : 'false'}
                title={t.label}
                aria-label={t.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runTool(t.key)}
              >
                {t.icon}
              </button>
            </span>
          ))}
        </div>

        <div
          ref={editorRef}
          className="wtf-editor"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Message editor"
          data-placeholder="Type your message here, then use the toolbar to format it…"
          data-empty={isEmpty ? 'true' : 'false'}
          onPaste={handlePaste}
          onInput={syncEmpty}
          onKeyUp={syncActive}
          onMouseUp={syncActive}
        />
      </div>

      <div className="wtf-actions">
        <button type="button" className="wtf-btn wtf-btn--copy" onClick={handleCopy}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied!' : 'Copy message'}
        </button>
        <button type="button" className="wtf-btn wtf-btn--send" onClick={handleSend}>
          <WhatsAppGlyph />
          Send on WhatsApp
        </button>
      </div>

      <div className="wtf-steps">
        <span className="wtf-step"><span className="wtf-stepnum">1</span> Type your message</span>
        <span className="wtf-arrow">→</span>
        <span className="wtf-step"><span className="wtf-stepnum">2</span> Copy or send</span>
        <span className="wtf-arrow">→</span>
        <span className="wtf-step"><span className="wtf-stepnum">3</span> Paste &amp; share</span>
      </div>
    </div>
  )
}

function WhatsAppGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.08-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.21 8.21 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.23 8.23 0 0 1 8.24 8.24c0 4.54-3.7 8.23-8.24 8.23z" />
    </svg>
  )
}

/* ---------- WhatsApp markup serialization ---------- */

/**
 * Walks the editor DOM and produces WhatsApp's own formatting syntax —
 * the text that actually gets pasted into a chat.
 */
export function toWhatsAppMarkup(root: HTMLElement): string {
  return nodeToMarkup(root)
    .replace(/ /g, ' ') // contenteditable inserts &nbsp; — WhatsApp wants real spaces
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function nodeToMarkup(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const el = node as HTMLElement
  const inner = () => Array.from(el.childNodes).map(nodeToMarkup).join('')
  const tag = el.tagName.toLowerCase()

  switch (tag) {
    case 'br':
      return '\n'
    case 'b':
    case 'strong':
      return wrapInline(inner(), '*')
    case 'i':
    case 'em':
      return wrapInline(inner(), '_')
    case 's':
    case 'strike':
    case 'del':
      return wrapInline(inner(), '~')
    case 'code':
    case 'tt':
    case 'pre':
      return wrapInline(inner(), '```')
    case 'ul':
    case 'ol': {
      const items = Array.from(el.children).filter((c) => c.tagName === 'LI')
      const lines = items.map((li, i) => {
        const text = Array.from(li.childNodes).map(nodeToMarkup).join('').trim()
        return `${tag === 'ol' ? `${i + 1}.` : '-'} ${text}`
      })
      return `${lines.join('\n')}\n`
    }
    case 'blockquote': {
      const text = inner().trim()
      if (!text) return ''
      return `${text.split('\n').map((l) => `> ${l}`).join('\n')}\n`
    }
    case 'div':
    case 'p':
      return `${inner()}\n`
    case 'span': {
      // Fallback for browsers that emit styled spans despite styleWithCSS=false.
      let text = inner()
      const style = el.style
      if (style.fontWeight === 'bold' || Number(style.fontWeight) >= 600) text = wrapInline(text, '*')
      if (style.fontStyle === 'italic') text = wrapInline(text, '_')
      if (style.textDecorationLine?.includes('line-through') || style.textDecoration?.includes('line-through')) {
        text = wrapInline(text, '~')
      }
      return text
    }
    default:
      return inner()
  }
}

/**
 * WhatsApp only renders a marker pair when it hugs the text — "* bold *"
 * stays literal. So any leading/trailing whitespace is moved outside.
 */
function wrapInline(text: string, marker: string): string {
  if (!text.trim()) return text
  const lead = /^\s*/.exec(text)?.[0] ?? ''
  const trail = /\s*$/.exec(text)?.[0] ?? ''
  const core = text.slice(lead.length, text.length - trail.length)
  return `${lead}${marker}${core}${marker}${trail}`
}

/** Replaces an element with its own children, keeping the text in place. */
function unwrap(el: Element) {
  const parent = el.parentNode
  if (!parent) return
  while (el.firstChild) parent.insertBefore(el.firstChild, el)
  parent.removeChild(el)
}

function closestTag(node: Node | null, tagName: string, boundary: HTMLElement): HTMLElement | null {
  let current: Node | null = node
  while (current && current !== boundary) {
    if (current.nodeType === Node.ELEMENT_NODE && (current as HTMLElement).tagName === tagName) {
      return current as HTMLElement
    }
    current = current.parentNode
  }
  return null
}

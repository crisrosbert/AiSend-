// src/lib/tools/wa-format.ts
//
// Reads WhatsApp's text formatting so a preview can show it the way a phone
// does:  *bold*  _italic_  ~strikethrough~  ```monospace```
//
// The rules follow what WhatsApp does in practice: the opening mark must have
// a non-space character right after it, the closing mark must have one right
// before it, a mark in the middle of a word (snake_case_name) is left alone,
// a pair never spans a new line, and monospace shows its contents untouched.

export interface Run {
  text: string
  bold?: boolean
  italic?: boolean
  strike?: boolean
  mono?: boolean
}

type Style = Pick<Run, 'bold' | 'italic' | 'strike'>

const MARKS: Record<string, keyof Style> = { '*': 'bold', _: 'italic', '~': 'strike' }

const isWordChar = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}]/u.test(c)
const isSpace = (c: string | undefined): boolean => c === undefined || /\s/.test(c)

function parse(text: string, style: Style): Run[] {
  const out: Run[] = []
  let buffer = ''
  let i = 0

  const flush = () => {
    if (buffer) out.push({ text: buffer, ...style })
    buffer = ''
  }

  while (i < text.length) {
    if (text.startsWith('```', i)) {
      const end = text.indexOf('```', i + 3)
      if (end > i + 3) {
        flush()
        out.push({ text: text.slice(i + 3, end), ...style, mono: true })
        i = end + 3
        continue
      }
    }

    const ch = text[i]
    const kind = MARKS[ch]
    if (kind && !isWordChar(text[i - 1]) && !isSpace(text[i + 1]) && text[i + 1] !== ch) {
      let close = -1
      for (let j = i + 1; j < text.length && text[j] !== '\n'; j++) {
        if (text[j] === ch && !isSpace(text[j - 1]) && !isWordChar(text[j + 1])) {
          close = j
          break
        }
      }
      if (close > i + 1) {
        flush()
        out.push(...parse(text.slice(i + 1, close), { ...style, [kind]: true }))
        i = close + 1
        continue
      }
    }

    buffer += ch
    i++
  }

  flush()
  return out
}

export function formatWhatsApp(text: string): Run[] {
  return parse(text, {})
}

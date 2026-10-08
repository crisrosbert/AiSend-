// src/lib/blog/frontmatter.ts
//
// Reads the small settings block at the top of a blog post:
//
//   ---
//   title: How to Get the WhatsApp Business API
//   tags: [whatsapp, api, setup]
//   ---
//
// One `key: value` per line. A value is text (quotes optional) or a
// [comma, separated, list]. That is the whole format, so it needs no YAML
// library, and anything unexpected is an error with the line number rather
// than a silently misread post.

export type FrontmatterValue = string | string[]

export class FrontmatterError extends Error {}

export function parseFrontmatter(source: string): {
  data: Record<string, FrontmatterValue>
  body: string
} {
  const text = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')

  if (lines[0]?.trim() !== '---') {
    throw new FrontmatterError('the file must start with a "---" line')
  }

  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  if (end === -1) {
    throw new FrontmatterError('the settings block is not closed with a second "---" line')
  }

  const data: Record<string, FrontmatterValue> = {}
  for (let n = 1; n < end; n++) {
    const raw = lines[n]
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue

    const colon = line.indexOf(':')
    if (colon <= 0) {
      throw new FrontmatterError(`line ${n + 1}: expected "key: value", got "${line}"`)
    }

    const key = line.slice(0, colon).trim()
    if (key in data) {
      throw new FrontmatterError(`line ${n + 1}: "${key}" is set twice`)
    }
    data[key] = parseValue(line.slice(colon + 1).trim())
  }

  return { data, body: lines.slice(end + 1).join('\n') }
}

function unquote(value: string): string {
  const v = value.trim()
  if (v.length >= 2 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) {
    return v.slice(1, -1)
  }
  return v
}

function parseValue(value: string): FrontmatterValue {
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map(unquote)
      .filter((item) => item.length > 0)
  }
  return unquote(value)
}

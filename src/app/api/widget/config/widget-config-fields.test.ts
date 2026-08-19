// src/app/api/widget/config/widget-config-fields.test.ts
//
// The config route serves a named field list instead of SELECT *, so a
// column added later cannot leak to every visitor. The cost of that is
// a list that can fall out of step with the widget script that consumes
// it — and when it does, the failure is silent: the field is simply
// absent, `undefined` flows into the UI, and a button quietly stops
// working on every customer site at once.
//
// This test closes that gap by reading widget.js and checking that
// every `config.<field>` it references is actually served.
//
// It caught business_phone (the WhatsApp handoff button), bubble_message
// and trigger_delay_seconds missing from the first version of the list.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PUBLIC_FIELDS, publicView } from './route'

const widgetSource = readFileSync(
  join(process.cwd(), 'public', 'widget.js'),
  'utf8',
)

/** Every `config.<something>` the widget script reads. */
function fieldsReadByWidget(source: string): string[] {
  const found = new Set<string>()
  for (const match of source.matchAll(/\bconfig\.([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
    found.add(match[1])
  }
  return [...found].sort()
}

describe('widget config field list', () => {
  it('serves every field public/widget.js reads', () => {
    const needed = fieldsReadByWidget(widgetSource)
    const served = new Set<string>(PUBLIC_FIELDS)

    // Sanity check on the regex itself: if this file stops finding any
    // fields, the assertion below would pass vacuously and guard nothing.
    expect(needed.length).toBeGreaterThan(3)

    const missing = needed.filter((field) => !served.has(field))
    expect(
      missing,
      `public/widget.js reads config fields the API does not serve: ${missing.join(', ')}. ` +
        'Add them to PUBLIC_FIELDS in src/app/api/widget/config/route.ts.',
    ).toEqual([])
  })

  it('never serves the allowlist itself', () => {
    // The list is read to enforce the origin check, not to publish.
    // Telling a caller which origins pass is telling them what to forge.
    // publicView() skips it explicitly; this guards that skip.
    const view = publicView({ bot_name: 'Kalosa', allowed_domains: ['kalosa.in'] })
    expect(view.allowed_domains).toBeUndefined()
    expect(view.bot_name).toBe('Kalosa')
  })

  it('does not serve obviously private columns even if they exist', () => {
    const served = new Set<string>(PUBLIC_FIELDS)
    for (const field of [
      'api_key', 'secret', 'access_token', 'webhook_secret',
      'created_at', 'updated_at', 'user_id',
    ]) {
      expect(served.has(field), field).toBe(false)
    }
  })
})

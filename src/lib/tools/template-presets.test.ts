import { describe, expect, it } from 'vitest'
import { buildApiPayload, checkTemplate } from './template-checker'
import { TEMPLATE_PRESETS, presetById } from './template-presets'

describe('template presets', () => {
  it('has a handful of ready-made starting points with unique ids', () => {
    expect(TEMPLATE_PRESETS.length).toBeGreaterThanOrEqual(6)
    const ids = TEMPLATE_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('covers all three categories', () => {
    const cats = new Set(TEMPLATE_PRESETS.map((p) => p.template.category))
    expect(cats).toEqual(new Set(['marketing', 'utility', 'authentication']))
  })

  it.each(TEMPLATE_PRESETS.map((p) => [p.id, p] as const))(
    '%s passes the checker with no errors and no warnings',
    (_id, preset) => {
      const result = checkTemplate(preset.template)
      // Tips are advice only. Everything that could block or reclassify it must be clean.
      expect(result.findings.filter((f) => f.severity !== 'tip')).toEqual([])
      expect(result.findings.map((f) => f.id)).not.toContain('marketing-optout')
    },
  )

  it.each(TEMPLATE_PRESETS.map((p) => [p.id, p] as const))('%s builds a request body', (_id, preset) => {
    const payload = buildApiPayload(preset.template) as { name: string; components: unknown[] }
    expect(payload.name).toBe(preset.template.name)
    expect(payload.components.length).toBeGreaterThan(0)
  })

  it('finds a preset by id and returns a copy that can be edited freely', () => {
    const a = presetById('order-update')
    const b = presetById('order-update')
    expect(a).not.toBeNull()
    a!.body = 'changed'
    a!.buttons.push({ type: 'quick_reply', text: 'x', value: '' })
    expect(b!.body).not.toBe('changed')
    expect(presetById('order-update')!.buttons).toHaveLength(b!.buttons.length)
  })

  it('returns null for an unknown id', () => {
    expect(presetById('nope')).toBeNull()
  })
})

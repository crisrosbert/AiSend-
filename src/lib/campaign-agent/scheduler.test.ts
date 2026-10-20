import { describe, expect, it } from 'vitest'
import { campaignOutcome, groupRunAt, pickRetryTemplate, splitVariants, templateVerdict, type Step } from './scheduler'

const step = (o: Partial<Step>): Step => ({
  id: 'x', campaign_id: 'c', grp: 0, variant: 0, label: 'l', body: 'b', kind: 'main', retry_of: null, retry_checked: false, rewrite_count: 0, image_url: null, template_name: 't', template_language: 'en_US',
  wait_hours: 0, rule: null, status: 'ready', broadcast_id: null, run_at: null, completed_at: null, updated_at: '', ...o,
})

describe('rules', () => {
  it('maps template status', () => {
    expect(templateVerdict('Approved')).toBe('ready')
    expect(templateVerdict('REJECTED')).toBe('rejected')
    expect(templateVerdict('Pending')).toBe('wait')
    expect(templateVerdict(null)).toBe('wait')
  })
  it('splits evenly across versions', () => {
    const [a, b] = splitVariants([1, 2, 3, 4, 5], 2)
    expect(a).toEqual([1, 3, 5])
    expect(b).toEqual([2, 4])
    expect(splitVariants([1, 2], 1)).toEqual([[1, 2]])
  })
  it('waits for the whole previous group, then adds the wait', () => {
    const t = '2026-10-20T10:00:00.000Z'
    expect(groupRunAt([step({ status: 'done', completed_at: t }), step({ status: 'sending' })], 48)).toBeNull()
    const at = groupRunAt([step({ status: 'done', completed_at: t })], 48)
    expect(at?.toISOString()).toBe('2026-10-22T10:00:00.000Z')
  })
  it('knows when a campaign is over', () => {
    expect(campaignOutcome([step({ status: 'done' }), step({ grp: 1, status: 'ready' })])).toBe('running')
    expect(campaignOutcome([step({ status: 'done' }), step({ grp: 1, status: 'skipped' })])).toBe('completed')
    expect(campaignOutcome([step({ status: 'failed' }), step({ grp: 1, status: 'skipped' })])).toBe('failed')
  })
})

describe('retry template', () => {
  it('uses another finished version in the same group', () => {
    const a = step({ id: 'a', template_name: 't_a', status: 'done' })
    const b = step({ id: 'b', variant: 1, template_name: 't_b', status: 'done' })
    expect(pickRetryTemplate(a, [a, b]).id).toBe('b')
  })
  it('falls back to the same message when there is no other version', () => {
    const a = step({ id: 'a', status: 'done' })
    const f = step({ id: 'f', grp: 1, template_name: 't_f', status: 'done' })
    expect(pickRetryTemplate(a, [a, f]).id).toBe('a')
  })
})

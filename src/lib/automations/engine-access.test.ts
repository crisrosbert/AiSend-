// src/lib/automations/engine-access.test.ts
// Pure logic only: no database, no network.
import { describe, it, expect } from 'vitest'
import { parseEngineBody, allowedOwnerIds, decideEngineAccess } from './engine-access'

const ME = 'user-me'
const MATE = 'user-teammate'
const OTHER = 'user-other-org'

describe('parseEngineBody', () => {
  it('needs trigger_type', () => {
    expect(parseEngineBody(null)).toMatchObject({ ok: false, status: 400 })
    expect(parseEngineBody({})).toMatchObject({ ok: false, status: 400 })
    expect(parseEngineBody({ trigger_type: 5 })).toMatchObject({ ok: false, status: 400 })
  })
  it('reads ids and context', () => {
    const r = parseEngineBody({ trigger_type: 'tag_added', contact_id: 'c1', context: { conversation_id: 'v1', tag_id: 't' } })
    expect(r).toMatchObject({ ok: true, body: { triggerType: 'tag_added', contactId: 'c1', conversationId: 'v1' } })
  })
  it('no ids is fine (nothing to check)', () => {
    expect(parseEngineBody({ trigger_type: 'x' })).toMatchObject({ ok: true, body: { contactId: null, conversationId: null, context: {} } })
  })
  it('rejects non-string ids', () => {
    expect(parseEngineBody({ trigger_type: 'x', contact_id: { $ne: 1 } })).toMatchObject({ ok: false, status: 400 })
    expect(parseEngineBody({ trigger_type: 'x', context: { conversation_id: 7 } })).toMatchObject({ ok: false, status: 400 })
  })
  it('a non-object context becomes {}', () => {
    expect(parseEngineBody({ trigger_type: 'x', context: 'hi' })).toMatchObject({ ok: true, body: { context: {} } })
  })
})

describe('allowedOwnerIds', () => {
  it('org caller: members plus self, no duplicates', () => {
    expect(allowedOwnerIds(ME, 'org1', [MATE, ME]).sort()).toEqual([MATE, ME].sort())
  })
  it('caller without an org: only self, even if a list is passed', () => {
    expect(allowedOwnerIds(ME, null, [MATE])).toEqual([ME])
  })
})

describe('decideEngineAccess', () => {
  const owners = [ME, MATE]
  const base = { contactId: null, conversationId: null, contact: null, conversation: null, allowedOwners: owners }

  it('no ids referenced: allowed', () => {
    expect(decideEngineAccess(base)).toEqual({ ok: true })
  })
  it('own contact: allowed', () => {
    expect(decideEngineAccess({ ...base, contactId: 'c1', contact: { id: 'c1', user_id: ME } })).toEqual({ ok: true })
  })
  it('teammate contact in same org: allowed', () => {
    expect(decideEngineAccess({ ...base, contactId: 'c1', contact: { id: 'c1', user_id: MATE } })).toEqual({ ok: true })
  })
  it('missing contact and foreign contact give the identical 404', () => {
    const missing = decideEngineAccess({ ...base, contactId: 'c1', contact: null })
    const foreign = decideEngineAccess({ ...base, contactId: 'c1', contact: { id: 'c1', user_id: OTHER } })
    expect(missing).toEqual({ ok: false, status: 404, error: 'Not found' })
    expect(foreign).toEqual(missing)
  })
  it('a returned row with a different id is refused', () => {
    expect(decideEngineAccess({ ...base, contactId: 'c1', contact: { id: 'zzz', user_id: ME } })).toMatchObject({ ok: false, status: 404 })
  })
  it('foreign conversation: 404', () => {
    expect(decideEngineAccess({ ...base, conversationId: 'v1', conversation: { id: 'v1', user_id: OTHER, contact_id: null } })).toMatchObject({ ok: false, status: 404 })
  })
  it('own conversation: allowed', () => {
    expect(decideEngineAccess({ ...base, conversationId: 'v1', conversation: { id: 'v1', user_id: ME, contact_id: 'c1' } })).toEqual({ ok: true })
  })
  it('conversation and contact that do not belong together: 404', () => {
    expect(
      decideEngineAccess({
        ...base,
        contactId: 'c1',
        contact: { id: 'c1', user_id: ME },
        conversationId: 'v1',
        conversation: { id: 'v1', user_id: ME, contact_id: 'c-other' },
      }),
    ).toMatchObject({ ok: false, status: 404 })
  })
  it('own contact but foreign conversation: 404', () => {
    expect(
      decideEngineAccess({
        ...base,
        contactId: 'c1',
        contact: { id: 'c1', user_id: ME },
        conversationId: 'v1',
        conversation: null,
      }),
    ).toMatchObject({ ok: false, status: 404 })
  })
  it('caller with no org cannot reach a teammate-owned row', () => {
    expect(
      decideEngineAccess({ ...base, allowedOwners: [ME], contactId: 'c1', contact: { id: 'c1', user_id: MATE } }),
    ).toMatchObject({ ok: false, status: 404 })
  })
})

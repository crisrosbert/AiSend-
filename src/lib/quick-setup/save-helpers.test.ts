// src/lib/quick-setup/save-helpers.test.ts
import { describe, it, expect } from 'vitest'
import {
  buildAgentUpdate,
  buildNewAgentRow,
  decideWhatsAppAssignment,
  isMissingColumnError,
  OPTIONAL_COLUMNS,
  readBool,
  stripOptionalColumns,
} from './save-helpers'
import { emptyFacts, extractFactsHeuristic, groundFacts } from './facts'
import { SETUP_EXAMPLES } from './examples'

const text = SETUP_EXAMPLES[0].text
const facts = groundFacts(extractFactsHeuristic(text), text)
const input = { userId: 'user-1', businessId: 'biz-1', facts, persona: 'PERSONA', activate: true }

describe('buildNewAgentRow', () => {
  const row = buildNewAgentRow(input)
  it('is scoped to the user and business, with explicit flags', () => {
    expect(row.tenant_id).toBe('user-1')
    expect(row.business_id).toBe('biz-1')
    expect(row.booking_enabled).toBe(true)
    expect(row.lead_form_enabled).toBe(false)
    expect(row.media_enabled).toBe(false)
    expect(row.payment_enabled).toBe(false)
    expect(row.is_active).toBe(true)
    expect(row.persona).toBe('PERSONA')
    expect(row.industry).toBe('Healthcare')
  })
  it('writes the hours the engine will read, and the urgent phone', () => {
    const h = row.business_hours as { days: Array<{ open: string; close: string } | null> }
    expect(h.days[0]).toBeNull()
    expect(h.days[1]).toEqual({ open: '17:00', close: '20:00' })
    expect(row.fallback_contact).toBe('98765 43210')
  })
  it('activate=false creates a paused agent', () => {
    expect(buildNewAgentRow({ ...input, activate: false }).is_active).toBe(false)
  })
  it('without hours or phone those columns are not written at all', () => {
    const r = buildNewAgentRow({ ...input, facts: emptyFacts() })
    expect('business_hours' in r).toBe(false)
    expect('fallback_contact' in r).toBe(false)
  })
})

describe('buildAgentUpdate', () => {
  it('does not touch name, tenant or business', () => {
    const u = buildAgentUpdate(input)
    expect('name' in u).toBe(false)
    expect('tenant_id' in u).toBe(false)
    expect('business_id' in u).toBe(false)
    expect(u.persona).toBe('PERSONA')
  })
  it('keeps hours the owner set elsewhere when the new text has none', () => {
    const u = buildAgentUpdate({ ...input, facts: emptyFacts() })
    expect('business_hours' in u).toBe(false)
    expect('fallback_contact' in u).toBe(false)
  })
})

describe('missing-column degradation', () => {
  it('recognises Postgres and PostgREST column errors', () => {
    expect(isMissingColumnError({ code: '42703', message: 'x' })).toBe(true)
    expect(isMissingColumnError({ code: 'PGRST204', message: 'x' })).toBe(true)
    expect(isMissingColumnError({ message: 'column "business_hours" of relation "agents" does not exist' })).toBe(true)
    expect(isMissingColumnError({ message: "Could not find the 'fallback_contact' column of 'agents' in the schema cache" })).toBe(true)
  })
  it('does not treat other errors as a missing column', () => {
    expect(isMissingColumnError({ code: '23505', message: 'duplicate key' })).toBe(false)
    expect(isMissingColumnError({ message: 'permission denied' })).toBe(false)
    expect(isMissingColumnError(null)).toBe(false)
    expect(isMissingColumnError(undefined)).toBe(false)
  })
  it('strips only the optional columns', () => {
    const stripped = stripOptionalColumns(buildNewAgentRow(input))
    for (const c of OPTIONAL_COLUMNS) expect(c in stripped).toBe(false)
    expect(stripped.persona).toBe('PERSONA')
    expect(stripped.tenant_id).toBe('user-1')
  })
})

describe('decideWhatsAppAssignment', () => {
  const base = { activate: true, assign: true, replace: false, agentId: 'new', config: { whatsapp_agent_id: null as string | null } }
  it('assigns when nothing is set', () => {
    expect(decideWhatsAppAssignment(base)).toEqual({ action: 'update', outcome: 'assigned' })
  })
  it('assigns when it already points at this agent', () => {
    expect(decideWhatsAppAssignment({ ...base, config: { whatsapp_agent_id: 'new' } }).action).toBe('update')
  })
  it('never replaces another agent unless asked', () => {
    expect(decideWhatsAppAssignment({ ...base, config: { whatsapp_agent_id: 'other' } })).toEqual({ action: 'none', outcome: 'kept_other' })
    expect(decideWhatsAppAssignment({ ...base, replace: true, config: { whatsapp_agent_id: 'other' } })).toEqual({ action: 'update', outcome: 'assigned' })
  })
  it('does nothing when WhatsApp is not connected', () => {
    expect(decideWhatsAppAssignment({ ...base, config: null })).toEqual({ action: 'none', outcome: 'not_connected' })
  })
  it('does nothing when not activating or not assigning', () => {
    expect(decideWhatsAppAssignment({ ...base, activate: false }).outcome).toBe('skipped')
    expect(decideWhatsAppAssignment({ ...base, assign: false }).outcome).toBe('skipped')
  })
})

describe('readBool', () => {
  it('only accepts real booleans', () => {
    expect(readBool(true, false)).toBe(true)
    expect(readBool(false, true)).toBe(false)
    expect(readBool('true', false)).toBe(false)
    expect(readBool(undefined, true)).toBe(true)
    expect(readBool(1, true)).toBe(true)
  })
})

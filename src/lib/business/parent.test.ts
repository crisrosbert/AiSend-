import { describe, expect, it, vi } from 'vitest'
import { businessIdForAgent, businessIdForJourney } from './parent'

/**
 * A stand-in for the Supabase query builder, recording what it was asked
 * for so the tests can assert the right table and id were used — the
 * two things that decide whose data a row lands in.
 */
function stubClient(result: { data?: unknown; error?: { message: string } }) {
  const calls: { table: string; column: string; value: unknown }[] = []
  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq(column: string, value: unknown) {
              calls.push({ table, column, value })
              return { maybeSingle: async () => result }
            },
          }
        },
      }
    },
  }
  return { client, calls }
}

describe('businessIdForAgent', () => {
  it('returns the agent’s business', async () => {
    const { client, calls } = stubClient({ data: { business_id: 'biz-1' } })
    expect(await businessIdForAgent(client, 'agent-1')).toBe('biz-1')
    expect(calls).toEqual([{ table: 'agents', column: 'id', value: 'agent-1' }])
  })

  // An untagged agent is a row created before migration 030. Passing the
  // null through is correct; inventing a business is not.
  it('returns null for an untagged agent', async () => {
    const { client } = stubClient({ data: { business_id: null } })
    expect(await businessIdForAgent(client, 'agent-1')).toBeNull()
  })

  it('returns null when the agent does not exist', async () => {
    const { client } = stubClient({ data: null })
    expect(await businessIdForAgent(client, 'nope')).toBeNull()
  })

  it('does not query at all without an id', async () => {
    const { client, calls } = stubClient({ data: { business_id: 'biz-1' } })
    expect(await businessIdForAgent(client, null)).toBeNull()
    expect(await businessIdForAgent(client, undefined)).toBeNull()
    expect(await businessIdForAgent(client, '')).toBeNull()
    expect(calls).toHaveLength(0)
  })

  // A failed lookup must not become a wrong answer. Null leaves the row
  // untagged, which is recoverable; a guess is not.
  it('returns null and logs when the lookup errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = stubClient({ error: { message: 'boom' } })
    expect(await businessIdForAgent(client, 'agent-1')).toBeNull()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('businessIdForJourney', () => {
  it('returns the journey’s business', async () => {
    const { client, calls } = stubClient({ data: { business_id: 'biz-2' } })
    expect(await businessIdForJourney(client, 'journey-1')).toBe('biz-2')
    expect(calls).toEqual([{ table: 'journeys', column: 'id', value: 'journey-1' }])
  })

  // The canvas hands out temp_ ids before the first save. There is no
  // row to read, and querying for one would log a spurious error on a
  // perfectly normal path.
  it('does not query for an unsaved temp_ journey', async () => {
    const { client, calls } = stubClient({ data: { business_id: 'biz-2' } })
    expect(await businessIdForJourney(client, 'temp_1712345678')).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('does not query at all without an id', async () => {
    const { client, calls } = stubClient({ data: { business_id: 'biz-2' } })
    expect(await businessIdForJourney(client, null)).toBeNull()
    expect(calls).toHaveLength(0)
  })
})

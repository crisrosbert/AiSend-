import { describe, it, expect, vi, beforeEach } from 'vitest'

const encryptMock = vi.fn((s: string) => `enc:${s}`)
const decryptMock = vi.fn((s: string) => s.replace(/^enc:/, ''))
vi.mock('@/lib/whatsapp/encryption', () => ({
  encrypt: (s: string) => encryptMock(s),
  decrypt: (s: string) => decryptMock(s),
}))

interface FakeRow {
  [key: string]: unknown
}

function makeAdminMock(deliveryRow: FakeRow, endpointRow: FakeRow) {
  const updates: { table: string; patch: FakeRow }[] = []

  const admin = {
    from(table: string) {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        async single() {
          if (table === 'webhook_deliveries') return { data: deliveryRow, error: null }
          if (table === 'webhook_endpoints') return { data: endpointRow, error: null }
          return { data: null, error: null }
        },
        update(patch: FakeRow) {
          updates.push({ table, patch })
          Object.assign(table === 'webhook_deliveries' ? deliveryRow : endpointRow, patch)
          return this
        },
      }
    },
  }
  return { admin, updates }
}

vi.mock('@/lib/automations/admin-client', () => ({
  supabaseAdmin: () => (globalThis as unknown as { __ADMIN__: unknown }).__ADMIN__,
}))

async function loadDeliver() {
  const mod = await import('./deliver')
  return mod
}

describe('attemptDelivery', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', undefined)
    encryptMock.mockClear()
    decryptMock.mockClear()
  })

  it('marks a delivery succeeded and resets endpoint failure count on 2xx', async () => {
    const delivery: FakeRow = {
      id: 'd1', endpoint_id: 'e1', event_type: 'message.received',
      event_id: 'evt-1', payload: { id: 'evt-1', type: 'message.received', created: 1, data: {} },
      attempt_count: 0,
    }
    const endpoint: FakeRow = {
      id: 'e1', url: 'https://example.com/hook', secret_encrypted: 'enc:secret',
      is_active: true, consecutive_failures: 3,
    }
    const { admin } = makeAdminMock(delivery, endpoint)
    ;(globalThis as unknown as { __ADMIN__: unknown }).__ADMIN__ = admin
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))

    const { attemptDelivery } = await loadDeliver()
    await attemptDelivery('d1')

    expect(delivery.status).toBe('succeeded')
    expect(endpoint.consecutive_failures).toBe(0)
  })

  it('schedules a retry with backoff on a 500 response, without disabling the endpoint', async () => {
    const delivery: FakeRow = {
      id: 'd1', endpoint_id: 'e1', event_type: 'message.received',
      event_id: 'evt-1', payload: { id: 'evt-1', type: 'message.received', created: 1, data: {} },
      attempt_count: 0,
    }
    const endpoint: FakeRow = {
      id: 'e1', url: 'https://example.com/hook', secret_encrypted: 'enc:secret',
      is_active: true, consecutive_failures: 0,
    }
    const { admin } = makeAdminMock(delivery, endpoint)
    ;(globalThis as unknown as { __ADMIN__: unknown }).__ADMIN__ = admin
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    const { attemptDelivery } = await loadDeliver()
    const before = Date.now()
    await attemptDelivery('d1')

    expect(delivery.status).toBe('pending')
    expect(delivery.attempt_count).toBe(1)
    const nextAt = new Date(delivery.next_attempt_at as string).getTime()
    expect(nextAt - before).toBeGreaterThanOrEqual(9000)
    expect(endpoint.is_active).toBe(true)
  })

  it('does not retry a 4xx — abandons immediately', async () => {
    const delivery: FakeRow = {
      id: 'd1', endpoint_id: 'e1', event_type: 'message.received',
      event_id: 'evt-1', payload: { id: 'evt-1', type: 'message.received', created: 1, data: {} },
      attempt_count: 0,
    }
    const endpoint: FakeRow = {
      id: 'e1', url: 'https://example.com/hook', secret_encrypted: 'enc:secret',
      is_active: true, consecutive_failures: 0,
    }
    const { admin } = makeAdminMock(delivery, endpoint)
    ;(globalThis as unknown as { __ADMIN__: unknown }).__ADMIN__ = admin
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }))

    const { attemptDelivery } = await loadDeliver()
    await attemptDelivery('d1')

    expect(delivery.status).toBe('abandoned')
    expect(endpoint.consecutive_failures).toBe(1)
  })

  it('auto-disables the endpoint once consecutive failures reach 20', async () => {
    const delivery: FakeRow = {
      id: 'd1', endpoint_id: 'e1', event_type: 'message.received',
      event_id: 'evt-1', payload: { id: 'evt-1', type: 'message.received', created: 1, data: {} },
      attempt_count: 0,
    }
    const endpoint: FakeRow = {
      id: 'e1', url: 'https://example.com/hook', secret_encrypted: 'enc:secret',
      is_active: true, consecutive_failures: 19,
    }
    const { admin } = makeAdminMock(delivery, endpoint)
    ;(globalThis as unknown as { __ADMIN__: unknown }).__ADMIN__ = admin
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }))

    const { attemptDelivery } = await loadDeliver()
    await attemptDelivery('d1')

    expect(endpoint.consecutive_failures).toBe(20)
    expect(endpoint.is_active).toBe(false)
    expect(endpoint.disabled_at).toBeTruthy()
  })

  it('abandons after exhausting all retries on repeated 5xxs', async () => {
    const delivery: FakeRow = {
      id: 'd1', endpoint_id: 'e1', event_type: 'message.received',
      event_id: 'evt-1', payload: { id: 'evt-1', type: 'message.received', created: 1, data: {} },
      attempt_count: 3,
    }
    const endpoint: FakeRow = {
      id: 'e1', url: 'https://example.com/hook', secret_encrypted: 'enc:secret',
      is_active: true, consecutive_failures: 0,
    }
    const { admin } = makeAdminMock(delivery, endpoint)
    ;(globalThis as unknown as { __ADMIN__: unknown }).__ADMIN__ = admin
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))

    const { attemptDelivery } = await loadDeliver()
    await attemptDelivery('d1')

    expect(delivery.status).toBe('abandoned')
    expect(delivery.attempt_count).toBe(4)
    expect(endpoint.consecutive_failures).toBe(1)
  })

  it('does nothing when the endpoint has already been disabled', async () => {
    const delivery: FakeRow = {
      id: 'd1', endpoint_id: 'e1', event_type: 'message.received',
      event_id: 'evt-1', payload: { id: 'evt-1', type: 'message.received', created: 1, data: {} },
      attempt_count: 0,
    }
    const endpoint: FakeRow = {
      id: 'e1', url: 'https://example.com/hook', secret_encrypted: 'enc:secret',
      is_active: false, consecutive_failures: 20,
    }
    const { admin } = makeAdminMock(delivery, endpoint)
    ;(globalThis as unknown as { __ADMIN__: unknown }).__ADMIN__ = admin
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { attemptDelivery } = await loadDeliver()
    await attemptDelivery('d1')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(delivery.status).toBe('abandoned')
  })
})

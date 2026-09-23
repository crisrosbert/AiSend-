// src/lib/webhooks/deliver.ts
//
// Attempts a single webhook_deliveries row against its endpoint, and
// decides what happens next: succeeded, retry later, or abandoned.
//
// ── RETRY POLICY ─────────────────────────────────────────────────────
// 3 retries after the first attempt, exponential backoff 10s / 30s /
// 90s — same numbers Wassist documents for their webhook product.
// Retries only happen on 5xx responses or a network/timeout error; a
// 4xx means the receiver rejected the request on its own terms (bad
// signature, endpoint moved, payload it doesn't want) and retrying
// won't change that, so it's marked abandoned immediately.
//
// ── AUTO-DISABLE ─────────────────────────────────────────────────────
// consecutive_failures on the endpoint increments every time a
// delivery to it is abandoned, and resets to 0 on any success. At 20,
// the endpoint is flipped inactive so a dead URL doesn't get dialled
// forever — the dashboard shows it as disabled and why.

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { decrypt } from '@/lib/whatsapp/encryption'
import { signPayload } from './sign'
import type { WebhookEventEnvelope } from './events'

const RETRY_BACKOFF_SECONDS = [10, 30, 90]
const MAX_ATTEMPTS = RETRY_BACKOFF_SECONDS.length + 1
const REQUEST_TIMEOUT_MS = 10_000
const AUTO_DISABLE_THRESHOLD = 20

interface DeliveryRow {
  id: string
  endpoint_id: string
  event_type: string
  event_id: string
  payload: WebhookEventEnvelope
  attempt_count: number
}

interface EndpointRow {
  id: string
  url: string
  secret_encrypted: string
  is_active: boolean
  consecutive_failures: number
}

export async function attemptDelivery(deliveryId: string): Promise<void> {
  const admin = supabaseAdmin()

  const { data: delivery, error: deliveryError } = await admin
    .from('webhook_deliveries')
    .select('id, endpoint_id, event_type, event_id, payload, attempt_count')
    .eq('id', deliveryId)
    .single()
  if (deliveryError || !delivery) return

  const { data: endpoint, error: endpointError } = await admin
    .from('webhook_endpoints')
    .select('id, url, secret_encrypted, is_active, consecutive_failures')
    .eq('id', (delivery as DeliveryRow).endpoint_id)
    .single()
  if (endpointError || !endpoint) return
  if (!(endpoint as EndpointRow).is_active) {
    // Endpoint was disabled (auto or manual) between enqueue and now.
    await admin
      .from('webhook_deliveries')
      .update({ status: 'abandoned', updated_at: new Date().toISOString() })
      .eq('id', deliveryId)
    return
  }

  const result = await sendOnce(delivery as DeliveryRow, endpoint as EndpointRow)
  await recordOutcome(delivery as DeliveryRow, endpoint as EndpointRow, result)
}

interface SendResult {
  ok: boolean
  statusCode: number | null
  error: string | null
  retryable: boolean
  /** Seconds the receiver asked us to wait, from a Retry-After header.
   *  Overrides our own backoff schedule when present — respecting it
   *  is what keeps a rate-limited receiver from being hit again before
   *  it's ready. */
  retryAfterSeconds: number | null
}

/** Retry-After is either delta-seconds ("120") or an HTTP-date. Returns
 *  null for anything else, including a date that's already past. */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null
  const asSeconds = Number(header)
  if (Number.isFinite(asSeconds) && asSeconds >= 0) return Math.min(asSeconds, 3600)
  const asDate = Date.parse(header)
  if (Number.isNaN(asDate)) return null
  const deltaMs = asDate - Date.now()
  return deltaMs > 0 ? Math.min(Math.ceil(deltaMs / 1000), 3600) : null
}

/** Status codes worth retrying, beyond plain 5xx — matches the set
 *  Wassist documents: 429 (rate limited), 408 (request timeout), 425
 *  (too early). Any other 4xx means the receiver rejected this exact
 *  request on purpose, and retrying won't change that. */
const RETRYABLE_4XX = new Set([408, 425, 429])

async function sendOnce(delivery: DeliveryRow, endpoint: EndpointRow): Promise<SendResult> {
  let secret: string
  try {
    secret = decrypt(endpoint.secret_encrypted)
  } catch (err) {
    return { ok: false, statusCode: null, error: `secret decrypt failed: ${err}`, retryable: false, retryAfterSeconds: null }
  }

  const rawBody = JSON.stringify(delivery.payload)
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = signPayload(secret, rawBody, timestamp)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AiSend-Signature': signature,
        'X-AiSend-Event': delivery.event_type,
        'X-AiSend-Delivery': delivery.event_id,
      },
      body: rawBody,
      signal: controller.signal,
    })
    if (res.ok) {
      return { ok: true, statusCode: res.status, error: null, retryable: false, retryAfterSeconds: null }
    }
    // Server errors, and the specific 4xx codes above, are worth
    // retrying. Any other 4xx is the receiver telling us, deliberately,
    // that this exact request is wrong — retrying won't change that.
    const retryable = res.status >= 500 || RETRYABLE_4XX.has(res.status)
    return {
      ok: false,
      statusCode: res.status,
      error: `HTTP ${res.status}`,
      retryable,
      retryAfterSeconds: retryable ? parseRetryAfter(res.headers.get('retry-after')) : null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, statusCode: null, error: message, retryable: true, retryAfterSeconds: null }
  } finally {
    clearTimeout(timeout)
  }
}

async function recordOutcome(
  delivery: DeliveryRow,
  endpoint: EndpointRow,
  result: SendResult,
): Promise<void> {
  const admin = supabaseAdmin()
  const now = new Date().toISOString()
  const attemptCount = delivery.attempt_count + 1

  if (result.ok) {
    await admin
      .from('webhook_deliveries')
      .update({
        status: 'succeeded',
        attempt_count: attemptCount,
        last_attempt_at: now,
        last_status_code: result.statusCode,
        last_error: null,
        updated_at: now,
      })
      .eq('id', delivery.id)

    if (endpoint.consecutive_failures !== 0) {
      await admin
        .from('webhook_endpoints')
        .update({ consecutive_failures: 0, updated_at: now })
        .eq('id', endpoint.id)
    }
    return
  }

  const exhausted = !result.retryable || attemptCount >= MAX_ATTEMPTS

  if (!exhausted) {
    const ourBackoff = RETRY_BACKOFF_SECONDS[attemptCount - 1] ?? RETRY_BACKOFF_SECONDS.at(-1)!
    // A receiver-supplied Retry-After wins over our own schedule — it's
    // the receiver telling us specifically when it'll be ready again.
    const backoffSeconds = result.retryAfterSeconds ?? ourBackoff
    const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000).toISOString()
    await admin
      .from('webhook_deliveries')
      .update({
        status: 'pending',
        attempt_count: attemptCount,
        next_attempt_at: nextAttemptAt,
        last_attempt_at: now,
        last_status_code: result.statusCode,
        last_error: result.error,
        updated_at: now,
      })
      .eq('id', delivery.id)
    return
  }

  await admin
    .from('webhook_deliveries')
    .update({
      status: 'abandoned',
      attempt_count: attemptCount,
      last_attempt_at: now,
      last_status_code: result.statusCode,
      last_error: result.error,
      updated_at: now,
    })
    .eq('id', delivery.id)

  const consecutiveFailures = endpoint.consecutive_failures + 1
  const patch: Record<string, unknown> = {
    consecutive_failures: consecutiveFailures,
    updated_at: now,
  }
  if (consecutiveFailures >= AUTO_DISABLE_THRESHOLD) {
    patch.is_active = false
    patch.disabled_at = now
  }
  await admin.from('webhook_endpoints').update(patch).eq('id', endpoint.id)
}

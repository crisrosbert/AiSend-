-- ============================================================
-- Outbound webhooks — the "activation" layer.
--
-- What this is for: once a merchant connects WhatsApp, third-party
-- systems (their own backend, an e-commerce platform, a CRM, an
-- automation tool like Make/Zapier) need to hear about what happens
-- on that number in near-real-time — a message arrived, a Click-to-
-- WhatsApp ad lead landed, a template got approved. This is that
-- notification system: signed, retried, idempotent HTTP callbacks,
-- the same shape competitors' "enterprise SDK" webhook products use
-- (Stripe-style `t=…,v1=…` signature header, outbox + retry table,
-- auto-disable after sustained failure).
--
-- Named by date, not a sequence number, to avoid colliding with the
-- untracked-but-already-applied migrations referenced elsewhere in
-- code comments (same reasoning as 2026_09_23_kb_chunk_embeddings.sql).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- 1. webhook_endpoints — where a tenant wants events delivered
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  description TEXT,
  -- AES-256-GCM ciphertext (src/lib/whatsapp/encryption.ts format) —
  -- the plaintext signing secret is shown to the user exactly once,
  -- at creation/rotation time, and never again.
  secret_encrypted TEXT NOT NULL,
  -- Empty array = subscribed to every event type. Non-empty = only
  -- those. Validated against the known event catalog in application
  -- code (src/lib/webhooks/events.ts), not a DB enum, so adding a new
  -- event type never needs a migration.
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Auto-disable counter. Reset to 0 on any successful delivery;
  -- incremented when a delivery to this endpoint is abandoned after
  -- exhausting retries. At 20, is_active flips to false so a dead
  -- endpoint stops being dialled forever.
  consecutive_failures INT NOT NULL DEFAULT 0,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_user ON webhook_endpoints(user_id);

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own webhook endpoints" ON webhook_endpoints;
CREATE POLICY "Users manage own webhook endpoints" ON webhook_endpoints FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. webhook_deliveries — the outbox + attempt log, one row per
--    (endpoint, event) pair
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  -- Denormalised so RLS can scope SELECT without a join, and so a
  -- deleted endpoint's history stays attributable if ever needed.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  -- Stable id generated once when the event is emitted (not per
  -- delivery attempt). Sent to the receiver as the X-AiSend-Delivery
  -- header so THEY can dedupe retries; the UNIQUE constraint below is
  -- what lets US dedupe if emitWebhookEvent is ever called twice for
  -- the same underlying event (e.g. an at-least-once queue retry).
  -- TEXT, not UUID: callers may key this on an upstream id that isn't
  -- one — e.g. Meta's WhatsApp message id ("wamid.HBg...") for
  -- message.received, so a Meta webhook retry can't double-enqueue.
  event_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed', 'abandoned')),
  attempt_count INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ,
  last_status_code INT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (endpoint_id, event_id)
);

-- Drives the retry sweep: "give me due work" without a table scan.
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_due
  ON webhook_deliveries(status, next_attempt_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint
  ON webhook_deliveries(endpoint_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_user
  ON webhook_deliveries(user_id, created_at DESC);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own webhook deliveries" ON webhook_deliveries;
CREATE POLICY "Users view own webhook deliveries" ON webhook_deliveries FOR SELECT
  USING (auth.uid() = user_id);
-- No user-facing INSERT/UPDATE/DELETE policy: rows are written only by
-- the service-role dispatcher/sweep. A "replay" is a service-role
-- update triggered through /api/webhooks/deliveries/[id]/replay, which
-- checks ownership itself before touching the row.

-- ============================================================
-- BYOA routing override for webhooks.
--
-- Wassist's model: a conversation can be "subscribed" to a webhook,
-- which bypasses their built-in AI agent entirely and hands that one
-- conversation to your own backend — useful for human handoff or a
-- custom bot/model. This is the AiSend equivalent: when a conversation
-- is routed to a webhook endpoint, the inbound-message pipeline in
-- src/app/api/whatsapp/webhook/route.ts skips the ads agent, journeys,
-- the WhatsApp AI agent, and reply-sending automations for it, and
-- instead emits a single subscription.message.received event to the
-- assigned endpoint only (not the normal fan-out).
--
-- Depends on 2026_09_23_webhooks.sql (webhook_endpoints). Separate
-- file rather than editing that one, since it may already be applied.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS routing_mode TEXT NOT NULL DEFAULT 'agent'
    CHECK (routing_mode IN ('agent', 'webhook'));

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS routing_endpoint_id UUID
    REFERENCES webhook_endpoints(id) ON DELETE SET NULL;

-- A conversation with a routing_endpoint_id but routing_mode='agent'
-- would be ambiguous (which wins?), so keep them consistent: clearing
-- the endpoint always clears the mode too.
CREATE OR REPLACE FUNCTION conversations_clear_routing_mode()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.routing_endpoint_id IS NULL THEN
    NEW.routing_mode := 'agent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_conversations_clear_routing_mode ON conversations;
CREATE TRIGGER trg_conversations_clear_routing_mode
  BEFORE UPDATE OF routing_endpoint_id ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION conversations_clear_routing_mode();

-- Fast lookup for "which conversations are currently handed off" (the
-- settings UI's subscribed-conversations panel).
CREATE INDEX IF NOT EXISTS idx_conversations_routing_webhook
  ON conversations(user_id, routing_endpoint_id)
  WHERE routing_mode = 'webhook';

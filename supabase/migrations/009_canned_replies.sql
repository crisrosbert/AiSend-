-- ============================================================
-- CANNED REPLIES
-- Saved message shortcuts for the inbox composer.
-- Agents type "/" to trigger the picker, then search by
-- shortcode or content and insert with one click.
-- ============================================================

CREATE TABLE IF NOT EXISTS canned_replies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shortcode   TEXT NOT NULL,          -- e.g. "hello", "hours", "delivery"
  title       TEXT NOT NULL,          -- display label: "Welcome greeting"
  content     TEXT NOT NULL,          -- full message text
  category    TEXT NOT NULL DEFAULT 'General',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, shortcode)
);

CREATE INDEX IF NOT EXISTS idx_canned_replies_user ON canned_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_canned_replies_shortcode ON canned_replies(user_id, shortcode);

ALTER TABLE canned_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own canned replies" ON canned_replies;
CREATE POLICY "Users manage own canned replies" ON canned_replies
  FOR ALL USING (auth.uid() = user_id);

-- Seed a handful of useful defaults so new users see something
-- immediately. These are inserted only when the user row doesn't
-- exist yet; the ON CONFLICT is a no-op for existing installs.
-- (Seeding is skipped here — done at app level on first settings visit.)

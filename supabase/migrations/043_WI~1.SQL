-- 043_widget_whatsapp_button.sql
-- Optional "WhatsApp strip" in the website chat widget. OFF for everyone.
-- Additive and safe to run more than once. Nothing is changed or deleted.
-- The app code works whether or not these columns exist: while they are
-- missing the strip is simply off and saving widget settings still works.
--
-- The WhatsApp number is NOT a new column. The strip uses the existing
-- widget_configs.business_phone (the same number the AI hand-off button uses).
--
-- ABOUT THE NUMBER 043: the repo's supabase/migrations folder at GitHub HEAD
-- only lists 001-009. Other deliveries already use 039 (wallet), 040
-- (opted_out_at), 041 (voice notes) and 042 (broadcast guard), so 043 is the
-- next free number. CONFIRM the order with your own Supabase history and
-- rename the file if needed. The file is independent of the others.

alter table public.widget_configs
  add column if not exists whatsapp_button_enabled boolean not null default false;

alter table public.widget_configs
  add column if not exists whatsapp_button_text text;

comment on column public.widget_configs.whatsapp_button_enabled is
  'When true AND business_phone is a valid number, the website chat widget shows a slim WhatsApp strip under its header. Default false.';
comment on column public.widget_configs.whatsapp_button_text is
  'Text on the WhatsApp strip (plain text, max 50 characters). NULL or empty = the default "Talk to the clinic team directly".';

-- ROLLBACK (only if you want to remove the feature; the dashboard and widget
-- keep working without the columns, the strip just goes off):
--   alter table public.widget_configs drop column if exists whatsapp_button_enabled;
--   alter table public.widget_configs drop column if exists whatsapp_button_text;

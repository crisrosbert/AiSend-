"use client";

// src/app/(dashboard)/widget/page.tsx
//
// Website Chat Widget — clients configure appearance and behaviour here and
// copy their embed snippet. Laid out as a two-column workspace: settings on
// the left, a live phone-style preview on the right, so changes are visible
// before they ever reach a customer's website.

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Globe, Loader2, Save, Copy, Check, MessageCircle, Clock, Phone,
  Bot, Power, Code2, ExternalLink, Sparkles, Send, UserRound,
} from "lucide-react";
import { useScopedBusinessId } from "@/hooks/use-business";
import { ChatbotDraftBanner } from "@/components/widget/chatbot-draft-banner";
import {
  WA_BUTTON_TEXT_DEFAULT,
  WA_BUTTON_TEXT_MAX,
  buttonTextOrDefault,
  checkWhatsappSettings,
  isMissingWhatsappColumnError,
  withoutWhatsappColumns,
} from "@/lib/widget/whatsapp-strip";
import {
  AUTO_OPEN_SECONDS_DEFAULT,
  AUTO_OPEN_SECONDS_MAX,
  AUTO_OPEN_SECONDS_MIN,
  cleanAutoOpenSeconds,
  cleanExcludeText,
  isMissingAutoOpenColumnError,
  withoutAutoOpenColumns,
} from "@/lib/widget/auto-open";

interface WidgetConfig {
  bot_name: string;
  welcome_message: string;
  bubble_message: string;
  primary_color: string;
  trigger_delay_seconds: number;
  business_phone: string | null;
  is_active: boolean;
  /** Optional WhatsApp strip under the chat header. Off by default. */
  whatsapp_button_enabled: boolean;
  /** "" = use the default text. */
  whatsapp_button_text: string;
  /** Chat window opens by itself after N seconds, once per visit. Off by default. */
  auto_open_enabled: boolean;
  auto_open_seconds: number;
  /** Pages where it must not open, one per line. */
  auto_open_exclude: string;
}

/** The agents a website can be wired to. The embed code carries the chosen one. */
interface AgentOption {
  id: string;
  name: string;
  is_active: boolean | null;
  business_id: string | null;
}

const DEFAULTS: WidgetConfig = {
  bot_name: "Assistant",
  welcome_message: "Hello! How can I help you today?",
  bubble_message: "Hi! 👋 Have a question? I'm here to help.",
  primary_color: "#25D366",
  trigger_delay_seconds: 10,
  business_phone: "",
  is_active: true,
  whatsapp_button_enabled: false,
  whatsapp_button_text: "",
  auto_open_enabled: false,
  auto_open_seconds: AUTO_OPEN_SECONDS_DEFAULT,
  auto_open_exclude: "",
};

const COLOR_PRESETS = [
  "#25D366", "#0ea5e9", "#8b5cf6", "#f43f5e",
  "#f59e0b", "#10b981", "#6366f1", "#0c1f17",
];

export default function WidgetSettingsPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState("");
  // This row is the tenant's org-wide widget config — it is being
  // created here, so the selected business is the right owner.
  const businessId = useScopedBusinessId();
  const [config, setConfig] = useState<WidgetConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentId, setAgentId] = useState("");

  // The embed snippet must point at THIS deployment. Hardcoding a domain
  // silently breaks the widget on every other environment.
  useEffect(() => setOrigin(window.location.origin), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      // The agents this website can use. Default: ?agent= from the Agents page,
      // else a LIVE agent of the selected business, else any live agent.
      const { data: agentRows } = await supabase
        .from("agents")
        .select("id, name, is_active, business_id")
        .eq("tenant_id", user.id);
      const list = (agentRows ?? []) as AgentOption[];
      setAgents(list);
      const wanted = new URLSearchParams(window.location.search).get("agent");
      setAgentId((current) => {
        if (current && list.some((a) => a.id === current)) return current;
        if (wanted && list.some((a) => a.id === wanted)) return wanted;
        const pick =
          list.find((a) => a.is_active !== false && (!businessId || a.business_id === businessId)) ??
          list.find((a) => a.is_active !== false) ??
          list[0];
        return pick ? pick.id : "";
      });

      // Each business gets its own org-wide widget config. Without this
      // filter a second business would load — and then overwrite — the
      // first one's greeting, colours and allowed domains.
      if (!businessId) { setLoading(false); return; }

      const { data } = await supabase
        .from("widget_configs")
        .select("*")
        .eq("org_user_id", user.id)
        .eq("business_id", businessId)
        .is("agent_id", null)
        .maybeSingle();

      if (data) {
        setConfig({
          bot_name: data.bot_name ?? DEFAULTS.bot_name,
          welcome_message: data.welcome_message ?? DEFAULTS.welcome_message,
          bubble_message: data.bubble_message ?? DEFAULTS.bubble_message,
          primary_color: data.primary_color ?? DEFAULTS.primary_color,
          trigger_delay_seconds: data.trigger_delay_seconds ?? DEFAULTS.trigger_delay_seconds,
          business_phone: data.business_phone ?? "",
          is_active: data.is_active ?? true,
          // Columns from migration 043. Before it is run they are simply
          // absent from the row: off, default text.
          whatsapp_button_enabled: data.whatsapp_button_enabled === true,
          whatsapp_button_text:
            typeof data.whatsapp_button_text === "string" ? data.whatsapp_button_text : "",
          // Columns from migration 044 (absent until it is run: off).
          auto_open_enabled: data.auto_open_enabled === true,
          auto_open_seconds: cleanAutoOpenSeconds(data.auto_open_seconds),
          auto_open_exclude: typeof data.auto_open_exclude === "string" ? data.auto_open_exclude : "",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, businessId]);

  useEffect(() => { load(); }, [load]);

    async function save() {
    if (!userId) { toast.error("Please sign in again"); return; }

    // The WhatsApp number is checked BEFORE anything is written. With the
    // button ON a bad number blocks saving (the error also shows under the
    // field). With the button OFF the number is only the hand-off number, so
    // an odd one is kept and only warned about.
    const wa = checkWhatsappSettings({
      enabled: config.whatsapp_button_enabled,
      phone: config.business_phone,
      text: config.whatsapp_button_text,
    });
    if (!wa.ok) { toast.error(wa.message); return; }

    setSaving(true);
    try {
      // widget_configs stores one row per agent PLUS a legacy row with
      // agent_id IS NULL for org-wide embeds, so org_user_id is not
      // unique and there is nothing for ON CONFLICT to match — Postgres
      // rejects an upsert here with 42P10. A composite (org_user_id,
      // agent_id) key would not help either: NULL never equals NULL, so
      // the org-wide row would never conflict and every save would
      // silently insert a duplicate. Read the row, then update or insert.
      const { data: existing, error: readError } = await supabase
        .from("widget_configs")
        .select("id")
        .eq("org_user_id", userId)
        .is("agent_id", null)
        .maybeSingle();
      if (readError) throw readError;

      // business_phone is stored as digits only (no plus), the same value the
      // AI hand-off button uses. An empty button text is stored as NULL = default.
      const payload = {
        ...config,
        business_phone: wa.phone,
        whatsapp_button_text: wa.text,
        auto_open_seconds: cleanAutoOpenSeconds(config.auto_open_seconds),
        auto_open_exclude: cleanExcludeText(config.auto_open_exclude),
        updated_at: new Date().toISOString(),
      };

      const write = (row: Record<string, unknown>) =>
        existing
          ? supabase.from("widget_configs").update(row).eq("id", existing.id)
          : supabase
              .from("widget_configs")
              .insert({ ...row, org_user_id: userId, agent_id: null, business_id: businessId });

      let { error } = await write(payload);

      // Migration 043 not run yet: the two new columns do not exist and the
      // database refuses the row. Save everything else without them, so
      // widget settings never stop saving because of this feature.
      let columnsMissing = false;
      let autoOpenMissing = false;
      // A missing column (migration 043 or 044 not run yet) must never stop the
      // other settings from saving: drop only the missing family and retry.
      let row: Record<string, unknown> = payload;
      for (let attempt = 0; attempt < 2 && error; attempt++) {
        if (isMissingWhatsappColumnError(error) && !columnsMissing) {
          columnsMissing = true;
          row = withoutWhatsappColumns(row);
        } else if (isMissingAutoOpenColumnError(error) && !autoOpenMissing) {
          autoOpenMissing = true;
          row = withoutAutoOpenColumns(row);
        } else break;
        ({ error } = await write(row));
      }
      if (error) throw error;

      // Show what was really stored (digits only, cleaned text).
      setConfig((c) => ({
        ...c,
        business_phone: wa.phone,
        whatsapp_button_text: wa.text ?? "",
        whatsapp_button_enabled: columnsMissing ? false : c.whatsapp_button_enabled,
        auto_open_seconds: cleanAutoOpenSeconds(c.auto_open_seconds),
        auto_open_exclude: cleanExcludeText(c.auto_open_exclude),
        auto_open_enabled: autoOpenMissing ? false : c.auto_open_enabled,
      }));

      if (autoOpenMissing && config.auto_open_enabled) {
        toast.warning(
          "Saved, but Auto-open is still OFF: your database needs one small update first (migration 044). Ask your developer or support.",
        );
        return;
      }

      if (columnsMissing && config.whatsapp_button_enabled) {
        toast.warning(
          "Saved, but the WhatsApp button is still OFF: your database needs one small update first (migration 043). Ask your developer or support.",
        );
      } else {
        toast.success("Widget settings saved");
        if (wa.warning) toast.warning(wa.warning);
      }
    } catch (err) {
      toast.error("Couldn't save: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setSaving(false);
    }
  }
  const selectedAgent = agents.find((a) => a.id === agentId) ?? null;

  // data-agent makes the chat run THAT agent (its persona, knowledge, booking
  // and opening hours). Without it the chat runs with no agent at all.
  const embedCode = useMemo(
    () =>
      `<script src="${origin}/widget.js" data-org="${userId}"` +
      (agentId ? ` data-agent="${agentId}"` : "") +
      `></script>`,
    [origin, userId, agentId],
  );

  // Live check of the WhatsApp settings: drives the inline error and the
  // preview. (A hook, so it sits above the loading early-return below.)
  const waCheck = useMemo(
    () =>
      checkWhatsappSettings({
        enabled: config.whatsapp_button_enabled,
        phone: config.business_phone,
        text: config.whatsapp_button_text,
      }),
    [config.whatsapp_button_enabled, config.business_phone, config.whatsapp_button_text],
  );
  const phoneError = config.whatsapp_button_enabled && !waCheck.ok ? waCheck.message : null;
  const phoneWarning = !config.whatsapp_button_enabled && waCheck.ok ? waCheck.warning ?? null : null;
  // The strip shows only with BOTH: switch on AND a valid number (same as the real widget).
  const stripVisible = config.whatsapp_button_enabled && waCheck.ok;

  function copyEmbed() {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast.success("Embed code copied");
    setTimeout(() => setCopied(false), 2000);
  }

  function update<K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ChatbotDraftBanner onApply={(look) => setConfig((c) => ({ ...c, ...look }))} />
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50">
            <Globe className="size-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0c1f17]">Website Chat Widget</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Put your AI sales agent on any website. It answers questions and captures leads
              straight into your inbox.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => update("is_active", !config.is_active)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
              config.is_active
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-[#e7ece9] bg-white text-slate-400"
            }`}
          >
            <Power className="size-3.5" />
            {config.is_active ? "LIVE" : "PAUSED"}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save changes
          </button>
        </div>
      </div>

      {!config.is_active && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          This widget is paused — it will not appear on your website. Switch it to LIVE and save.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* ── Settings ── */}
        <div className="space-y-5">
          <Section icon={Bot} title="Identity" subtitle="How the assistant introduces itself.">
            {selectedAgent && (
              <p className="rounded-lg bg-[#f4f6f5] px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                The chat on your website uses <strong>{selectedAgent.name}</strong>. Its name, greeting
                and logo come from the agent (change them on the{" "}
                <Link href="/agents" className="font-semibold text-emerald-700 hover:underline">Agents</Link>{" "}
                page). The colour, teaser, delay and WhatsApp number below are set here.
              </p>
            )}
            <Field label="Bot name">
              <input
                value={config.bot_name}
                onChange={(e) => update("bot_name", e.target.value)}
                maxLength={40}
                className={INPUT}
              />
            </Field>
            <Field label="Welcome message" hint="Shown as soon as the visitor opens the chat.">
              <textarea
                value={config.welcome_message}
                onChange={(e) => update("welcome_message", e.target.value)}
                rows={2}
                maxLength={300}
                className={`${INPUT} resize-none`}
              />
            </Field>
            <Field label="Bubble teaser" hint="The small popup that appears before they click.">
              <input
                value={config.bubble_message}
                onChange={(e) => update("bubble_message", e.target.value)}
                maxLength={120}
                className={INPUT}
              />
            </Field>
          </Section>

          <Section icon={Sparkles} title="Appearance" subtitle="Match your brand colour.">
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  onClick={() => update("primary_color", color)}
                  aria-label={`Use colour ${color}`}
                  className={`size-8 rounded-lg transition-transform hover:scale-110 ${
                    config.primary_color === color ? "ring-2 ring-slate-900 ring-offset-2" : ""
                  }`}
                  style={{ background: color }}
                />
              ))}
              <label className="flex items-center gap-2 rounded-lg border border-[#e7ece9] px-2 py-1.5">
                <input
                  type="color"
                  value={config.primary_color}
                  onChange={(e) => update("primary_color", e.target.value)}
                  className="size-6 cursor-pointer border-0 bg-transparent p-0"
                />
                <span className="font-mono text-xs text-slate-500">{config.primary_color}</span>
              </label>
            </div>
          </Section>

          <Section icon={Clock} title="Behaviour" subtitle="When the widget invites the visitor.">
            <Field
              label="Show teaser after"
              hint="Seconds on the page before the bubble appears. 0 shows it immediately."
            >
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={60}
                  value={config.trigger_delay_seconds}
                  onChange={(e) => update("trigger_delay_seconds", Number(e.target.value))}
                  className="flex-1 accent-emerald-500"
                />
                <span className="w-16 shrink-0 text-sm font-semibold text-[#0c1f17]">
                  {config.trigger_delay_seconds}s
                </span>
              </div>
            </Field>

            {/* Optional auto-open. OFF by default. */}
            <div className="flex items-start justify-between gap-3 rounded-lg border border-[#e7ece9] px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold text-slate-700">Auto-open chat window</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Opens the chat by itself on desktop and phone, once per visit. It replaces the
                  teaser bubble and never reopens after the visitor closes it. Off by default.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config.auto_open_enabled}
                aria-label="Auto-open chat window"
                onClick={() => update("auto_open_enabled", !config.auto_open_enabled)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  config.auto_open_enabled ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-[#fff] shadow transition-transform ${
                    config.auto_open_enabled ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            {config.auto_open_enabled && (
              <>
                <Field label="Open after" hint="Seconds after the page loads.">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={AUTO_OPEN_SECONDS_MIN}
                      max={AUTO_OPEN_SECONDS_MAX}
                      value={config.auto_open_seconds}
                      onChange={(e) => update("auto_open_seconds", Number(e.target.value))}
                      className="flex-1 accent-emerald-500"
                    />
                    <span className="w-16 shrink-0 text-sm font-semibold text-[#0c1f17]">
                      {config.auto_open_seconds}s
                    </span>
                  </div>
                </Field>
                <Field
                  label="Do not auto-open on these pages"
                  hint="One per line. /checkout = any page starting with /checkout. contact = any page with contact in its address. Visitors can still open the chat themselves."
                >
                  <textarea
                    value={config.auto_open_exclude}
                    onChange={(e) => update("auto_open_exclude", e.target.value)}
                    rows={3}
                    placeholder={"/checkout\n/book-appointment\ncontact"}
                    className={INPUT}
                  />
                </Field>
              </>
            )}

            {/* Optional WhatsApp strip. OFF by default. */}
            <div className="flex items-start justify-between gap-3 rounded-lg border border-[#e7ece9] px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold text-slate-700">Add WhatsApp button</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Adds a small green line under the chat header. Visitors tap it to message you on
                  WhatsApp. Off by default.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config.whatsapp_button_enabled}
                aria-label="Add WhatsApp button"
                onClick={() => update("whatsapp_button_enabled", !config.whatsapp_button_enabled)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  config.whatsapp_button_enabled ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-[#fff] shadow transition-transform ${
                    config.whatsapp_button_enabled ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            {/* One number, one place: this is business_phone, used by the button AND by AI hand-offs. */}
            <Field
              label="WhatsApp number for the button and for hand-offs"
              hint="Country code first, for example 919820123987 (India) or +447911123456. Saved as digits only. The same number is used for the green button and for the Continue on WhatsApp button when the AI hands a chat to your team. Optional when the button is off."
            >
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={config.business_phone ?? ""}
                  onChange={(e) => update("business_phone", e.target.value)}
                  placeholder="919820123987"
                  inputMode="tel"
                  aria-invalid={phoneError ? true : undefined}
                  className={`${INPUT} pl-9 ${phoneError ? "border-red-400 focus:border-red-500" : ""}`}
                />
              </div>
              {phoneError && (
                <p role="alert" className="mt-1 text-[11px] font-semibold text-red-600">
                  {phoneError} Saving is blocked until this is fixed or the button is switched off.
                </p>
              )}
              {phoneWarning && (
                <p className="mt-1 text-[11px] text-amber-700">{phoneWarning}</p>
              )}
            </Field>

            {config.whatsapp_button_enabled && (
              <Field
                label="Button text"
                hint="Plain text. Leave empty to use the default."
              >
                <input
                  value={config.whatsapp_button_text}
                  onChange={(e) => update("whatsapp_button_text", e.target.value)}
                  maxLength={WA_BUTTON_TEXT_MAX}
                  placeholder={WA_BUTTON_TEXT_DEFAULT}
                  className={INPUT}
                />
                <p className="mt-1 text-right text-[11px] text-slate-400">
                  {config.whatsapp_button_text.length}/{WA_BUTTON_TEXT_MAX}
                </p>
              </Field>
            )}
          </Section>

          <Section icon={Code2} title="Install" subtitle="Paste this before the closing </body> tag.">
            <p className="text-xs text-slate-600">
              This is the <strong>only</strong> place to copy your website code. Pick the agent that
              should answer, then copy.
            </p>

            {agents.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                You have no agent yet, so this code would run a chat with no persona or knowledge.{" "}
                <Link href="/agents" className="font-semibold underline">Create an agent first</Link>.
              </div>
            ) : (
              <Field
                label="Which agent answers on your website?"
                hint={
                  agents.length > 1
                    ? `You have ${agents.length} agents. The code below includes the one you pick here.`
                    : "The code below includes this agent."
                }
              >
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className={INPUT}
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.is_active === false ? " (paused)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {selectedAgent && selectedAgent.is_active === false && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <strong>{selectedAgent.name}</strong> is paused, so visitors will not get answers. Open{" "}
                <Link href="/agents" className="font-semibold underline">Agents</Link>, press Configure
                and switch it to Live.
              </div>
            )}

            <div className="overflow-x-auto rounded-lg bg-[#0c1f17] p-3">
              <code className="whitespace-pre text-xs text-emerald-300">{embedCode}</code>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={copyEmbed}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-600"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy embed code"}
              </button>
              <Link
                href="/agents"
                className="flex items-center gap-1.5 rounded-lg border border-[#e7ece9] px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Manage agents <ExternalLink className="size-3" />
              </Link>
            </div>
            <p className="text-xs text-slate-500">
              Works on any site — WordPress, Shopify, Webflow, or plain HTML. Leads land in{" "}
              <Link href="/leads" className="font-semibold text-emerald-700 hover:underline">Leads</Link>{" "}
              and the chat appears in your{" "}
              <Link href="/inbox" className="font-semibold text-emerald-700 hover:underline">Inbox</Link>.
            </p>
          </Section>
        </div>

        {/* ── Live preview ── */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            Live preview
          </p>
          <WidgetPreview config={config} stripVisible={stripVisible} />
        </div>
      </div>
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-sm text-[#0c1f17] " +
  "placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none";

function Section({
  icon: Icon, title, subtitle, children,
}: {
  icon: typeof Bot; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e7ece9] bg-white p-5">
      <div className="mb-4 flex items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <div>
          <h2 className="text-sm font-bold text-[#0c1f17]">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label, hint, children,
}: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

/** A faithful mock of what widget.js renders, so settings can be judged before publishing. */
function WidgetPreview({ config, stripVisible }: { config: WidgetConfig; stripVisible: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e7ece9] bg-[#f4f6f5] p-4">
      <div className="mx-auto w-full max-w-[300px]">
        <div className="overflow-hidden rounded-xl bg-white shadow-lg">
          {/* Header */}
          <div
            className="flex items-center gap-2.5 px-3.5 py-3"
            style={{ background: config.primary_color }}
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-white/25">
              <Bot className="size-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                {config.bot_name || "Assistant"}
              </p>
              <p className="text-[10px] text-white/85">● Online</p>
            </div>
          </div>

          {/* WhatsApp strip (same look as widget.js): only with the switch on AND a valid number */}
          {stripVisible && (
            <div
              data-testid="preview-wa-strip"
              className="flex h-7 items-center gap-1.5 border-b border-[#bfe5cd] bg-[#e8f7ee] px-3.5 text-[11.5px] font-medium leading-none text-[#0f6a37]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
                <path d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5z" fill="#0f6a37" />
                <path d="M8.6 7.8c-.4 0-.9.3-1 1.1-.2 1.9 1.2 4.1 2.8 5.5 1.5 1.3 3.4 2.1 4.7 1.7.7-.2 1.1-.9 1.1-1.5 0-.2-.1-.3-.3-.4l-1.8-.9c-.2-.1-.4 0-.5.1l-.6.7c-.1.1-.3.2-.5.1-1-.4-2-1.2-2.6-2.2-.1-.2-.1-.3 0-.5l.5-.6c.1-.1.1-.3.1-.4l-.8-1.8c-.1-.2-.3-.3-.5-.3z" fill="#e8f7ee" />
              </svg>
              <span className="min-w-0 flex-1 truncate">{buttonTextOrDefault(config.whatsapp_button_text)}</span>
              <span aria-hidden="true">→</span>
            </div>
          )}

          {/* Transcript */}
          <div className="space-y-2.5 bg-[#f7faf8] px-3 py-3.5" style={{ minHeight: 190 }}>
            <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
              <p className="text-xs leading-relaxed text-slate-700">
                {config.welcome_message || "Hello! How can I help you today?"}
              </p>
            </div>

            <div className="ml-auto max-w-[80%] rounded-xl rounded-tr-sm px-3 py-2"
              style={{ background: config.primary_color }}>
              <p className="text-xs text-white">What are your prices?</p>
            </div>

            {/* The lead form the AI can trigger. */}
            <div className="rounded-xl border border-[#e7ece9] bg-white p-2.5 shadow-sm">
              <p className="text-[11px] font-bold text-[#0c1f17]">Share your details</p>
              <p className="mb-1.5 text-[10px] text-slate-400">
                Our team will get back to you shortly.
              </p>
              <div className="space-y-1">
                {["First Name", "Mobile Number"].map((placeholder) => (
                  <div key={placeholder}
                    className="rounded-md border border-[#e7ece9] px-2 py-1 text-[10px] text-slate-300">
                    {placeholder}
                  </div>
                ))}
              </div>
              <div className="mt-1.5 rounded-md py-1 text-center text-[10px] font-bold text-white"
                style={{ background: config.primary_color }}>
                Submit
              </div>
            </div>
          </div>

          {/* Composer */}
          <div className="flex items-center gap-2 border-t border-[#e7ece9] bg-white px-3 py-2">
            <span className="flex-1 text-[11px] text-slate-300">Type your message…</span>
            <div className="flex size-6 items-center justify-center rounded-full"
              style={{ background: config.primary_color }}>
              <Send className="size-3 text-white" />
            </div>
          </div>
        </div>

        {/* Teaser bubble + launcher */}
        <div className="mt-3 flex items-end justify-end gap-2">
          <div className="max-w-[190px] rounded-xl rounded-br-sm bg-white px-3 py-2 shadow-md">
            <p className="text-[11px] leading-snug text-slate-600">
              {config.bubble_message || "Hi! 👋 Have a question?"}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[9px] text-slate-400">
              <Clock className="size-2.5" /> after {config.trigger_delay_seconds}s
            </p>
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full shadow-lg"
            style={{ background: config.primary_color }}>
            <MessageCircle className="size-5 text-white" />
          </div>
        </div>

        {config.business_phone && (
          <p className="mt-3 flex items-center justify-center gap-1 text-[10px] text-slate-400">
            <UserRound className="size-3" />
            Handoff to WhatsApp: {config.business_phone}
          </p>
        )}
      </div>
    </div>
  );
}

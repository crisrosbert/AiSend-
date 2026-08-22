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

interface WidgetConfig {
  bot_name: string;
  welcome_message: string;
  bubble_message: string;
  primary_color: string;
  trigger_delay_seconds: number;
  business_phone: string | null;
  is_active: boolean;
}

const DEFAULTS: WidgetConfig = {
  bot_name: "Assistant",
  welcome_message: "Hello! How can I help you today?",
  bubble_message: "Hi! 👋 Have a question? I'm here to help.",
  primary_color: "#25D366",
  trigger_delay_seconds: 10,
  business_phone: "",
  is_active: true,
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

  // The embed snippet must point at THIS deployment. Hardcoding a domain
  // silently breaks the widget on every other environment.
  useEffect(() => setOrigin(window.location.origin), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from("widget_configs")
        .select("*")
        .eq("org_user_id", user.id)
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
        });
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

    async function save() {
    if (!userId) { toast.error("Please sign in again"); return; }
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

      const payload = { ...config, updated_at: new Date().toISOString() };

      const { error } = existing
        ? await supabase.from("widget_configs").update(payload).eq("id", existing.id)
        : await supabase
            .from("widget_configs")
            .insert({ ...payload, org_user_id: userId, agent_id: null, business_id: businessId });
      if (error) throw error;

      toast.success("Widget settings saved");
    } catch (err) {
      toast.error("Couldn't save: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setSaving(false);
    }
  }
  const embedCode = useMemo(
    () => `<script src="${origin}/widget.js" data-org="${userId}"></script>`,
    [origin, userId],
  );

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
            <Field
              label="WhatsApp handoff number"
              hint="Optional. When the AI hands off, visitors get a button to continue on WhatsApp."
            >
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={config.business_phone ?? ""}
                  onChange={(e) => update("business_phone", e.target.value)}
                  placeholder="919876543210"
                  className={`${INPUT} pl-9`}
                />
              </div>
            </Field>
          </Section>

          <Section icon={Code2} title="Install" subtitle="Paste this before the closing </body> tag.">
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
                Per-agent embed codes <ExternalLink className="size-3" />
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
          <WidgetPreview config={config} />
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
function WidgetPreview({ config }: { config: WidgetConfig }) {
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

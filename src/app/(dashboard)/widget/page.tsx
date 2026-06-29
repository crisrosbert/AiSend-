"use client";

// src/app/(dashboard)/widget/page.tsx
//
// Widget Settings — clients configure their website chat widget here
// (bot name, greeting, color, trigger timing, phone) and copy their
// embed code. No database editing required — this makes the product
// self-serve for every client.

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Globe, Loader2, Save, Copy, Check, MessageCircle,
  Palette, Clock, Phone, Bot, Eye, Power,
} from "lucide-react";

interface WidgetConfig {
  org_user_id: string;
  bot_name: string;
  welcome_message: string;
  bubble_message: string;
  primary_color: string;
  trigger_delay_seconds: number;
  business_phone: string | null;
  is_active: boolean;
}

const DEFAULTS: Omit<WidgetConfig, "org_user_id"> = {
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
  const [userId, setUserId] = useState<string>("");
  const [config, setConfig] = useState<Omit<WidgetConfig, "org_user_id">>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

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
    setSaving(true);
    try {
      const { error } = await supabase
        .from("widget_configs")
        .upsert(
          { org_user_id: userId, ...config, updated_at: new Date().toISOString() },
          { onConflict: "org_user_id" }
        );
      if (error) {
        toast.error("Couldn't save: " + error.message);
      } else {
        toast.success("Widget settings saved");
      }
    } finally {
      setSaving(false);
    }
  }

  const embedCode = `<script src="https://app.performancemktg.net/widget.js" data-org="${userId}"></script>`;

  function copyEmbed() {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast.success("Embed code copied");
    setTimeout(() => setCopied(false), 2000);
  }

  function update<K extends keyof typeof config>(key: K, value: (typeof config)[K]) {
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
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="rounded-2xl border border-[#d1fae5] bg-gradient-to-br from-white to-emerald-50 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
              <Globe className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
                Website Widget
              </h1>
              <p className="mt-1 text-xs text-slate-500 max-w-xl">
                Customize your AI chat widget and add it to your website. Changes apply instantly
                once saved.
              </p>
            </div>
          </div>
          <button
            onClick={() => update("is_active", !config.is_active)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
              config.is_active
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            <Power className="size-3.5" />
            {config.is_active ? "Active" : "Inactive"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEFT: settings form */}
        <div className="space-y-4">
          {/* Embed code — most important, at top */}
          <Card title="Embed code" icon={<Copy className="size-4" />} accent="#10b981">
            <p className="text-xs text-slate-500 mb-2">
              Paste this into your website's HTML, just before the closing &lt;/body&gt; tag.
            </p>
            <div className="relative">
              <code className="block rounded-lg bg-[#0c1f17] p-3 pr-12 text-[11px] text-emerald-300 font-mono break-all">
                {embedCode}
              </code>
              <button
                onClick={copyEmbed}
                className="absolute right-2 top-2 rounded-md bg-emerald-500 p-1.5 text-white hover:bg-emerald-600"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </button>
            </div>
          </Card>

          <Card title="Assistant" icon={<Bot className="size-4" />} accent="#8b5cf6">
            <Field label="Bot name">
              <input
                value={config.bot_name}
                onChange={(e) => update("bot_name", e.target.value)}
                className={inputCls}
                placeholder="e.g. Riya"
              />
            </Field>
            <Field label="Welcome message (shown when chat opens)">
              <textarea
                value={config.welcome_message}
                onChange={(e) => update("welcome_message", e.target.value)}
                rows={2}
                className={inputCls}
              />
            </Field>
            <Field label="Notification bubble (pops up after a delay)">
              <textarea
                value={config.bubble_message}
                onChange={(e) => update("bubble_message", e.target.value)}
                rows={2}
                className={inputCls}
              />
            </Field>
          </Card>

          <Card title="Appearance" icon={<Palette className="size-4" />} accent="#f59e0b">
            <Field label="Primary color">
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => update("primary_color", c)}
                    className={`size-8 rounded-full transition-transform hover:scale-110 ${
                      config.primary_color === c ? "ring-2 ring-offset-2 ring-slate-400" : ""
                    }`}
                    style={{ background: c }}
                  />
                ))}
                <input
                  type="color"
                  value={config.primary_color}
                  onChange={(e) => update("primary_color", e.target.value)}
                  className="size-8 rounded cursor-pointer border border-slate-200"
                />
              </div>
            </Field>
          </Card>

          <Card title="Behavior" icon={<Clock className="size-4" />} accent="#0ea5e9">
            <Field label={`Notification delay: ${config.trigger_delay_seconds} seconds`}>
              <input
                type="range"
                min={0}
                max={60}
                value={config.trigger_delay_seconds}
                onChange={(e) => update("trigger_delay_seconds", Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </Field>
            <Field label="WhatsApp number (for 'Continue on WhatsApp')">
              <input
                value={config.business_phone ?? ""}
                onChange={(e) => update("business_phone", e.target.value)}
                className={inputCls}
                placeholder="e.g. 919818816485"
              />
            </Field>
          </Card>

          <button
            onClick={save}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 4px 12px rgba(16,185,129,.3)" }}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save settings
          </button>
        </div>

        {/* RIGHT: live preview */}
        <div className="lg:sticky lg:top-4 self-start">
          <Card title="Live preview" icon={<Eye className="size-4" />} accent="#6366f1">
            <div className="relative rounded-xl bg-slate-100 h-[420px] overflow-hidden border border-slate-200">
              <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-xs">
                Your website
              </div>

              {/* Mini widget preview */}
              <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
                {/* Bubble */}
                <div className="max-w-[200px] rounded-2xl bg-white p-3 shadow-lg text-xs text-slate-700">
                  {config.bubble_message}
                </div>
                {/* Button */}
                <div
                  className="flex size-14 items-center justify-center rounded-full shadow-lg"
                  style={{ background: config.primary_color }}
                >
                  <MessageCircle className="size-6 text-white" />
                </div>
              </div>
            </div>

            {/* Open-state preview */}
            <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-3 flex items-center gap-2" style={{ background: config.primary_color }}>
                <div className="size-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="size-4 text-white" />
                </div>
                <div>
                  <div className="text-white font-bold text-xs">{config.bot_name}</div>
                  <div className="text-white/80 text-[10px]">● Online</div>
                </div>
              </div>
              <div className="bg-[#f7f9fb] p-3">
                <div className="inline-block rounded-2xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-700 shadow-sm">
                  {config.welcome_message}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[#e7ece9] bg-white p-2.5 text-sm text-[#0c1f17] placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 mb-3 last:mb-0">
      <label className="text-xs font-bold text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function Card({
  title, icon, accent, children,
}: {
  title: string; icon: React.ReactNode; accent: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#e7ece9] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex size-7 items-center justify-center rounded-lg text-white" style={{ background: accent }}>
          {icon}
        </div>
        <h3 className="text-sm font-bold text-[#0c1f17]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

"use client";

// src/app/(dashboard)/leads/sources/page.tsx
//
// LEAD SOURCES — where a merchant connects every door leads come through.
// The goal is that a non-technical client never sees an API key unless
// they chose a developer-style source:
//
//   • Meta Lead Ads        → one button, Facebook login, done.
//   • Click-to-WhatsApp    → nothing to set up; already automatic.
//   • Website form / Google Ads → a key + webhook URL for whoever builds
//                                  the form (or Zapier/Make).

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Copy, Check, Trash2, Loader2, AlertCircle, CheckCircle2, MessageCircle, Globe, Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { LeadsTabs } from "@/components/leads/leads-tabs";

interface LeadSource {
  id: string;
  name: string;
  source_type: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  meta_page_id: string | null;
}

const KEY_SOURCE_TYPES = [
  { value: "website_form", label: "Website form" },
  { value: "google_ads", label: "Google Ads lead form" },
  { value: "other", label: "Other (Zapier / Make / custom)" },
];

const META_ERRORS: Record<string, string> = {
  not_configured: "Meta connection isn't switched on for this server yet (META_APP_ID / META_APP_SECRET are not set).",
  cancelled: "Facebook connection was cancelled. Press Connect to try again.",
  invalid_state: "That connection attempt took longer than 10 minutes and expired. Please press Connect again and finish quickly.",
  no_code: "Facebook returned without an authorisation code. If your Meta app uses Facebook Login for Business, set META_LOGIN_CONFIG_ID (a Configuration with the lead permissions) and redeploy.",
  wrong_user: "You were signed in to a different account when you came back from Facebook. Sign in again and press Connect.",
  bad_state: "The connection could not be verified (state mismatch). Check META_APP_SECRET is the same on this deployment, then press Connect again.",
  no_pages: "No Facebook Pages were shared. In the Facebook dialog, tick the Page that runs your lead ads.",
  subscribe_failed: "Meta wouldn't let us subscribe to that Page's leads. You need to be an admin of the Page with lead access.",
  exchange_failed: "Facebook sign-in failed.",
};

export default function LeadSourcesPage() {
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState("website_form");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/lead-sources");
      const json = await res.json();
      setSources(json.lead_sources ?? []);
    } catch {
      toast.error("Could not load lead sources");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Result of the Facebook round trip arrives as query params. Read from
    // window rather than useSearchParams to avoid a Suspense boundary.
    const p = new URLSearchParams(window.location.search);
    const meta = p.get("meta");
    if (meta === "connected") {
      const n = Number(p.get("count") || 1);
      setBanner({ ok: true, text: `Connected ${n} Facebook Page${n === 1 ? "" : "s"}. New leads will appear in All leads automatically.` });
    } else if (meta === "error") {
      const reason = p.get("reason") || "";
      const extra = p.get("page") || p.get("detail");
      setBanner({ ok: false, text: `${META_ERRORS[reason] ?? "Could not connect Facebook."}${extra ? ` (${extra})` : ""}` });
    }
    if (meta) window.history.replaceState(null, "", window.location.pathname);
  }, [load]);

  const metaPages = sources.filter((s) => s.source_type === "meta_leadgen");
  const keySources = sources.filter((s) => s.source_type !== "meta_leadgen");

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Give this source a name, e.g. "Clinic website form"');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/lead-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, source_type: sourceType }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setName("");
      toast.success("API key created");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create key");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (s: LeadSource) => {
    const msg = s.source_type === "meta_leadgen"
      ? `Disconnect ${s.name}? Its Meta lead forms will stop sending leads here.`
      : "Revoke this key? Anything still using it will stop being able to send leads.";
    if (!confirm(msg)) return;
    try {
      const res = await fetch(`/api/lead-sources/${s.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setSources((list) => list.filter((x) => x.id !== s.id));
      toast.success(s.source_type === "meta_leadgen" ? "Page disconnected" : "Key revoked");
    } catch {
      toast.error("Could not remove this source");
    }
  };

  const copy = (id: string, text: string, what: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`${what} copied`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const ingestUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/leads/ingest` : "/api/leads/ingest";

  return (
    <div className="space-y-5">
      <LeadsTabs active="sources" />

      <div>
        <h1 className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
          Lead Sources
        </h1>
        <p className="mt-1 max-w-xl text-xs text-slate-500">
          Connect every place your leads come from. They all land in one list, de-duplicated by phone number.
        </p>
      </div>

      {banner && (
        <div
          className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${
            banner.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {banner.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
          {banner.text}
        </div>
      )}

      {/* ── Meta Lead Ads ── */}
      <section className="rounded-2xl border border-[#e7ece9] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Megaphone className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Meta Lead Ads (Facebook &amp; Instagram)</h2>
              <p className="mt-1 max-w-md text-xs text-slate-500">
                Sign in with Facebook, pick your Page, and every instant-form lead flows in within seconds. No API
                keys, no Zapier.
              </p>
            </div>
          </div>
          <a
            href="/api/meta/leadgen/connect"
            className="rounded-lg bg-[#1877f2] px-4 py-2 text-xs font-bold text-white hover:bg-[#166fe0]"
          >
            {metaPages.length > 0 ? "Connect another Page" : "Connect with Facebook"}
          </a>
        </div>

        {metaPages.length > 0 && (
          <div className="mt-4 divide-y divide-[#e7ece9] rounded-xl border border-[#e7ece9]">
            {metaPages.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-400">
                    Page ID {s.meta_page_id}
                    {s.last_used_at ? ` · last lead ${new Date(s.last_used_at).toLocaleDateString()}` : " · waiting for first lead"}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(s)}
                  className="flex size-8 items-center justify-center rounded-lg border border-[#e7ece9] text-slate-500 hover:border-red-300 hover:text-red-500"
                  title="Disconnect Page"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Click-to-WhatsApp ── */}
      <section className="flex items-start gap-3 rounded-2xl border border-[#e7ece9] bg-white p-5 shadow-sm">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600">
          <MessageCircle className="size-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800">Click-to-WhatsApp ads</h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Automatic</span>
          </div>
          <p className="mt-1 max-w-md text-xs text-slate-500">
            Nothing to set up. When someone taps your Meta ad and messages you on WhatsApp, they are added to All leads
            with the ad they clicked.
          </p>
        </div>
      </section>

      {/* ── Website form / Google Ads ── */}
      <section className="rounded-2xl border border-[#e7ece9] bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Globe className="size-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Website form, Google Ads &amp; other tools</h2>
            <p className="mt-1 max-w-md text-xs text-slate-500">
              For whoever builds your website form or Google Ads lead form: create a key, then add a webhook that
              sends the form to the URL below.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Clinic website contact form"'
              className="w-full rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div className="sm:w-56">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Type</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="w-full rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {KEY_SOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create key
          </button>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            Send the form from your <strong>server</strong> (WordPress/Elementor &quot;Webhook&quot; action, Zapier, Make, or
            Google&apos;s lead-form webhook) to{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5">{ingestUrl}</code> with the key in an{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5">x-api-key</code> header. Never put a key in browser
            JavaScript — anyone viewing the page could copy it.
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-emerald-500" /></div>
        ) : keySources.length > 0 ? (
          <div className="mt-4 divide-y divide-[#e7ece9] rounded-xl border border-[#e7ece9]">
            {keySources.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-400">
                    {KEY_SOURCE_TYPES.find((t) => t.value === s.source_type)?.label ?? s.source_type}
                    {s.last_used_at ? ` · last used ${new Date(s.last_used_at).toLocaleDateString()}` : " · never used yet"}
                  </p>
                  <code className="mt-1 block truncate rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-500">{s.api_key}</code>
                </div>
                <button
                  onClick={() => copy(s.id, s.api_key, "API key")}
                  className="flex size-8 items-center justify-center rounded-lg border border-[#e7ece9] text-slate-500 hover:border-emerald-300 hover:text-emerald-600"
                  title="Copy API key"
                >
                  {copiedId === s.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                </button>
                <button
                  onClick={() => handleDelete(s)}
                  className="flex size-8 items-center justify-center rounded-lg border border-[#e7ece9] text-slate-500 hover:border-red-300 hover:text-red-500"
                  title="Revoke key"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

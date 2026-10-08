"use client";

// src/app/(dashboard)/leads/sources/page.tsx
//
// Lets a merchant generate an API key for each external lead source —
// a website contact form, a Google Ads lead-form webhook, a Zapier/Make
// connection to Meta Lead Ads — so it can POST into
// /api/leads/ingest without touching SQL or asking a developer.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Key, Plus, Copy, Check, Trash2, Loader2, ArrowLeft, Globe, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface LeadSource {
  id: string;
  name: string;
  source_type: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

const SOURCE_TYPES = [
  { value: "website_form", label: "Website form" },
  { value: "google_ads", label: "Google Ads lead form" },
  { value: "meta_leadgen", label: "Meta Lead Ads (via Zapier/Make)" },
  { value: "other", label: "Other" },
];

export default function LeadSourcesPage() {
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState("website_form");
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
  }, [load]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Give this source a name, e.g. \"Clinic website form\"");
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

  const handleDelete = async (id: string) => {
    if (!confirm("Revoke this key? Anything still using it will stop being able to send leads.")) return;
    try {
      const res = await fetch(`/api/lead-sources/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setSources((s) => s.filter((x) => x.id !== id));
      toast.success("Key revoked");
    } catch {
      toast.error("Could not revoke key");
    }
  };

  const copyKey = (source: LeadSource) => {
    navigator.clipboard.writeText(source.api_key);
    setCopiedId(source.id);
    toast.success("API key copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const ingestUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/leads/ingest` : "/api/leads/ingest";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600"
        >
          <ArrowLeft className="size-3.5" /> Back to Leads
        </Link>
        <h1
          className="mt-2 text-base font-bold text-[#0c1f17]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Lead Source API Keys
        </h1>
        <p className="mt-1 max-w-xl text-xs text-slate-500">
          Bring every lead into one place — Meta ads, your website form, Google Ads — so nothing gets
          lost between five different inboxes. Create a key below for each source, then point that
          source&apos;s webhook at the ingest URL shown with it.
        </p>
      </div>

      {/* Create new */}
      <div className="rounded-2xl border border-[#e7ece9] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Source name</label>
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
              {SOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-60"
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create key
          </button>
        </div>
      </div>

      {/* Ingest endpoint */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div>
          Configure each key as a <strong>server-side</strong> webhook action (WordPress/Elementor
          &quot;Webhook&quot; step, Google Ads lead-form webhook, Zapier/Make) pointed at{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5">{ingestUrl}</code> with the key as the{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5">x-api-key</code> header. Never paste a key
          into a browser-side script — anyone who views the page source could read it.
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-[#e7ece9] bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-emerald-500" />
          </div>
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <Key className="size-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No keys yet</p>
            <p className="mt-1 max-w-sm text-xs text-slate-400">
              Create one above for your first lead source.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#e7ece9]">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Globe className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-800">{s.name}</p>
                    {!s.is_active && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {SOURCE_TYPES.find((t) => t.value === s.source_type)?.label ?? s.source_type}
                    {s.last_used_at ? ` · last used ${new Date(s.last_used_at).toLocaleDateString()}` : " · never used yet"}
                  </p>
                  <code className="mt-1 block truncate rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-500">
                    {s.api_key}
                  </code>
                </div>
                <button
                  onClick={() => copyKey(s)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#e7ece9] text-slate-500 hover:border-emerald-300 hover:text-emerald-600"
                  title="Copy API key"
                >
                  {copiedId === s.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#e7ece9] text-slate-500 hover:border-red-300 hover:text-red-500"
                  title="Revoke key"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

// src/app/(dashboard)/leads/whatsapp/page.tsx
//
// ALL LEADS — the one list every lead source lands in: Meta Lead Forms,
// Click-to-WhatsApp ads, website forms, Google Ads, the website chatbot.
// Written by src/lib/leads/ingest.ts, so a person who arrives through two
// channels shows up once, with a touchpoint count, not twice.
//
// The earlier website-chat view (conversations the AI handled on the
// widget) now lives at /leads/website.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useBusiness } from "@/hooks/use-business";
import { LeadsTabs } from "@/components/leads/leads-tabs";
import { Loader2, Search, Download, Flame, Users, Plug, Repeat } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Lead {
  id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  campaign: string | null;
  ad_headline: string | null;
  interest: string | null;
  status: string | null;
  touchpoints: number | null;
  created_at: string;
}

const SOURCE_LABELS: Record<string, { label: string; cls: string }> = {
  meta_leadgen: { label: "Meta Lead Form", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  meta_ads: { label: "Meta Ad → WhatsApp", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  website_form: { label: "Website form", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  google_ads: { label: "Google Ads", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  website_widget: { label: "Website chatbot", cls: "bg-teal-50 text-teal-700 border-teal-200" },
  website_whatsapp: { label: "Website WhatsApp", cls: "bg-lime-50 text-lime-700 border-lime-200" },
  phone_call: { label: "Phone call", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  whatsapp: { label: "WhatsApp Marketing", cls: "bg-green-50 text-green-700 border-green-200" },
};

function sourceInfo(source: string | null) {
  return (
    SOURCE_LABELS[source ?? ""] ?? {
      label: source ? source.replace(/_/g, " ") : "Other",
      cls: "bg-slate-50 text-slate-600 border-slate-200",
    }
  );
}

function displayName(l: Lead): string {
  return l.name || [l.first_name, l.last_name].filter(Boolean).join(" ") || l.phone || l.email || "Unknown";
}

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function WhatsAppMarketingLeadsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { businessId, loading: businessLoading } = useBusiness();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  useEffect(() => {
    if (businessLoading) return;
    // Fetch inside the effect with a cancel flag: a stale response (business
    // switched mid-request) must not overwrite the newer list.
    let cancelled = false;
    (async () => {
      let query = supabase
        .from("leads")
        .select(
          "id, name, first_name, last_name, phone, email, source, campaign, ad_headline, interest, status, touchpoints, created_at",
        )
        .eq("source", "whatsapp")
        .order("created_at", { ascending: false })
        .limit(500);
      // Include rows with no business: leads written before businesses
      // existed, or by a source that doesn't know one, would otherwise vanish.
      if (businessId) query = query.or(`business_id.eq.${businessId},business_id.is.null`);
      const { data } = await query;
      if (cancelled) return;
      setLeads((data as Lead[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, businessId, businessLoading]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of leads) m.set(l.source ?? "other", (m.get(l.source ?? "other") ?? 0) + 1);
    return m;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (sourceFilter !== "all" && (l.source ?? "other") !== sourceFilter) return false;
      if (!q) return true;
      return [displayName(l), l.phone, l.email, l.campaign, l.interest, l.ad_headline]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [leads, search, sourceFilter]);

  const hotCount = leads.filter((l) => l.status === "hot").length;
  const repeatCount = leads.filter((l) => (l.touchpoints ?? 1) > 1).length;

  const exportCsv = () => {
    const header = ["Date", "Name", "Phone", "Email", "Source", "Campaign", "Interest", "Status", "Touchpoints"];
    const rows = filtered.map((l) => [
      new Date(l.created_at).toISOString(),
      displayName(l),
      l.phone,
      l.email,
      sourceInfo(l.source).label,
      l.campaign,
      l.interest,
      l.status,
      l.touchpoints ?? 1,
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `whatsapp-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chips = [
    ["all", "All", leads.length] as const,
    ...Object.keys(SOURCE_LABELS)
      .filter((s) => counts.has(s))
      .map((s) => [s, SOURCE_LABELS[s].label, counts.get(s) ?? 0] as const),
    ...(counts.has("other") ? [["other", "Other", counts.get("other") ?? 0] as const] : []),
  ];

  return (
    <div className="space-y-5">
      <LeadsTabs active="whatsapp" />

      <div className="overflow-hidden rounded-2xl border border-[#d1fae5] bg-gradient-to-br from-white to-emerald-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
              WhatsApp Marketing Leads
            </h1>
            <p className="mt-1 max-w-xl text-xs text-slate-500">
              People who replied to your broadcasts and customers who booked through your WhatsApp AI agent. Anyone who also came from an ad appears once, with a touchpoint count.
            </p>
          </div>
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:border-emerald-400 disabled:opacity-50"
          >
            <Download className="size-3.5" /> Export CSV
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-[#d1fae5] pt-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><Users className="size-4 text-emerald-600" /><b className="text-sm text-slate-800">{leads.length}</b> total</span>
          <span className="flex items-center gap-1.5"><Flame className="size-4 text-orange-500" /><b className="text-sm text-slate-800">{hotCount}</b> hot</span>
          <span className="flex items-center gap-1.5"><Repeat className="size-4 text-indigo-500" /><b className="text-sm text-slate-800">{repeatCount}</b> came back through another channel</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, campaign, interest..."
            className="w-full rounded-lg border border-[#e7ece9] bg-white py-2 pl-10 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chips.map(([val, label, n]) => (
            <button
              key={val}
              onClick={() => setSourceFilter(val)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                sourceFilter === val
                  ? "border-transparent bg-emerald-500 text-white"
                  : "border-[#e7ece9] bg-white text-slate-500 hover:border-emerald-300"
              }`}
            >
              {label} <span className="opacity-70">{n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e7ece9] bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-emerald-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <Plug className="size-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {leads.length === 0 ? "No WhatsApp marketing leads yet" : "No leads match this filter"}
            </p>
            {leads.length === 0 && (
              <>
                <p className="mt-1 max-w-sm text-xs text-slate-400">
                  When someone replies to a broadcast or books through your WhatsApp agent, they will show up here.
                </p>
                <Link
                  href="/broadcasts"
                  className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600"
                >
                  Send a broadcast
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#e7ece9]">
            {filtered.map((l) => {
              const info = sourceInfo(l.source);
              return (
                <div key={l.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
                  >
                    {displayName(l).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">{displayName(l)}</p>
                      {l.status === "hot" && (
                        <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-600">
                          <Flame className="size-3" /> Hot
                        </span>
                      )}
                      {(l.touchpoints ?? 1) > 1 && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
                          {l.touchpoints} touchpoints
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-400">
                      {[l.phone, l.email, l.interest, l.campaign || l.ad_headline].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${info.cls}`}>{info.label}</span>
                  <span className="w-24 text-right text-[11px] text-slate-400">
                    {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

// src/app/(dashboard)/leads/page.tsx
//
// ────────────────────────────────────────────────────────────────────────────
// All Leads — Design System v2 (rebuilt 2026-10-11)
// ────────────────────────────────────────────────────────────────────────────
// Every lead from Meta ads, your website, Google Ads and the WhatsApp inbox
// in one list. Someone who finds you through two channels appears once, with
// a touchpoint count — ingestion logic in src/lib/leads/ingest.ts preserves
// that invariant, and this page just displays what landed there.
//
// LAYOUT CONTRACT (matches the Design System v2 preview artifact)
// ---------------------------------------------------------------
//   [PageHead] title + sub + Export CSV action
//   [LeadsTabs] (All / WhatsApp / Website / Clicks / Sources)
//   [StatCard row — 4 up] Total · Hot · Repeat · Sources connected
//   [Panel "Search & filter"] search input + source filter chips
//   [Panel "Leads"] vertical list of leads with avatar · name · source · time
//
// Every colour, font, radius, shadow references globals.css tokens.
// No hardcoded hex. Business logic (fetch, counts, filter, export) preserved.
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useBusiness } from "@/hooks/use-business";
import { LeadsTabs } from "@/components/leads/leads-tabs";
import { formatDistanceToNow } from "date-fns";

// ── Shared design-system components ──
import { PageHead } from "@/components/ui/page-head";
import { Panel, PanelHead } from "@/components/ui/panel";
import { Pill, type PillTone } from "@/components/ui/pill";
import { StatCard } from "@/components/ui/stat";
import { Button } from "@/components/ui/button";

import {
  Loader2,
  Search,
  Download,
  Flame,
  Users,
  Plug,
  Repeat,
} from "lucide-react";

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

/**
 * Source → Pill tone + label. Instead of raw Tailwind classes with
 * hardcoded colours, each source maps to one of the five design-system
 * Pill tones so the whole app's status language stays consistent.
 */
const SOURCE_META: Record<string, { label: string; tone: PillTone }> = {
  meta_leadgen:     { label: "Meta Lead Form",   tone: "info" },
  meta_ads:         { label: "Meta Ad → WhatsApp", tone: "info" },
  website_form:     { label: "Website form",     tone: "live" },
  google_ads:       { label: "Google Ads",       tone: "sched" },
  website_widget:   { label: "Website chatbot",  tone: "live" },
  website_whatsapp: { label: "Website WhatsApp", tone: "live" },
  phone_call:       { label: "Phone call",       tone: "err" },
  whatsapp:         { label: "WhatsApp Marketing", tone: "live" },
};

function sourceInfo(source: string | null) {
  return (
    SOURCE_META[source ?? ""] ?? {
      label: source ? source.replace(/_/g, " ") : "Other",
      tone: "neutral" as PillTone,
    }
  );
}

function displayName(l: Lead): string {
  return (
    l.name ||
    [l.first_name, l.last_name].filter(Boolean).join(" ") ||
    l.phone ||
    l.email ||
    "Unknown"
  );
}

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function AllLeadsPage() {
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

  // ── Derived aggregates ──
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of leads) {
      m.set(l.source ?? "other", (m.get(l.source ?? "other") ?? 0) + 1);
    }
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
  const sourcesConnected = counts.size;

  // CSV export preserved verbatim from the previous version.
  const exportCsv = () => {
    const header = [
      "Date", "Name", "Phone", "Email", "Source",
      "Campaign", "Interest", "Status", "Touchpoints",
    ];
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
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter chips — "All" plus every source that actually has rows.
  const chips: ReadonlyArray<readonly [string, string, number]> = [
    ["all", "All", leads.length],
    ...Object.keys(SOURCE_META)
      .filter((s) => counts.has(s))
      .map((s): [string, string, number] => [s, SOURCE_META[s].label, counts.get(s) ?? 0]),
    ...(counts.has("other")
      ? [["other", "Other", counts.get("other") ?? 0] as [string, string, number]]
      : []),
  ];

  // ────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full px-5 pb-20 pt-5 sm:px-7 lg:px-10 lg:pb-10">
      {/* Page header */}
      <PageHead
        title="All leads"
        subtitle="Every lead from Meta ads, your website and Google Ads in one place. Someone who finds you through two channels appears once, with a touchpoint count."
        actions={
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download size={14} /> Export CSV
          </Button>
        }
      />

      {/* Legacy LeadsTabs — kept so the sub-page tabs (All / WhatsApp / Website
          / Clicks / Sources) still work. Will get its own token-driven
          restyle in a follow-up pass. */}
      <div className="mb-6">
        <LeadsTabs active="all" />
      </div>

      {/* KPI row — 4 up */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total leads"
          value={leads.length.toLocaleString("en-IN")}
          icon={<Users size={12} aria-hidden />}
        />
        <StatCard
          label="Hot leads"
          value={hotCount.toLocaleString("en-IN")}
          icon={<Flame size={12} aria-hidden />}
        />
        <StatCard
          label="Multi-touch"
          value={repeatCount.toLocaleString("en-IN")}
          icon={<Repeat size={12} aria-hidden />}
        />
        <StatCard
          label="Sources connected"
          value={sourcesConnected.toLocaleString("en-IN")}
          icon={<Plug size={12} aria-hidden />}
        />
      </div>

      {/* Search + filter chips panel */}
      <Panel className="mb-6">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative min-w-[200px] flex-1">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2"
              style={{ color: "var(--ink-3)" }}
              aria-hidden
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, campaign, interest…"
              className="w-full rounded-[9px] border py-2 pl-10 pr-3 text-[13px] outline-none transition-colors"
              style={{
                borderColor: "var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
              }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {chips.map(([val, label, n]) => (
              <FilterChip
                key={val}
                label={label}
                count={n}
                active={sourceFilter === val}
                onClick={() => setSourceFilter(val)}
              />
            ))}
          </div>
        </div>
      </Panel>

      {/* Leads list panel */}
      <Panel>
        <PanelHead
          title={`${filtered.length} lead${filtered.length === 1 ? "" : "s"}`}
          subtitle={
            sourceFilter !== "all"
              ? `Filtered by ${sourceInfo(sourceFilter).label}`
              : undefined
          }
        />
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2
              className="size-6 animate-spin"
              style={{ color: "var(--brand)" }}
              aria-hidden
            />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasAnyLeads={leads.length > 0} />
        ) : (
          <div
            className="divide-y"
            style={{ borderColor: "var(--line)" }}
          >
            {filtered.map((l) => (
              <LeadRow key={l.id} lead={l} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// LOCAL COMPONENTS
// ────────────────────────────────────────────────────────────────────────────

/** Filter chip — dark pill when active, hairline bordered when inactive. */
function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors"
      style={{
        background: active ? "var(--ink)" : "var(--surface)",
        color: active ? "#fff" : "var(--ink-2)",
        border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
      }}
    >
      {label}{" "}
      <span style={{ opacity: 0.7 }}>{count}</span>
    </button>
  );
}

/** Single lead row — avatar + name/meta + source Pill + relative time. */
function LeadRow({ lead }: { lead: Lead }) {
  const info = sourceInfo(lead.source);
  const name = displayName(lead);
  const metaLine =
    [
      lead.phone,
      lead.email,
      lead.interest,
      lead.campaign || lead.ad_headline,
    ]
      .filter(Boolean)
      .join(" · ") || "—";

  return (
    <div
      className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-[color:var(--surface-2)]"
      style={{ borderColor: "var(--line)" }}
    >
      {/* Avatar — brand gradient, matches the sidebar's logo */}
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
        style={{
          background:
            "linear-gradient(135deg,var(--brand),var(--brand-deep))",
        }}
      >
        {name.charAt(0).toUpperCase()}
      </div>

      {/* Name + badges + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className="truncate text-[13.5px] font-semibold"
            style={{ color: "var(--ink)" }}
          >
            {name}
          </p>
          {lead.status === "hot" && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-bold"
              style={{
                background: "var(--rose-50)",
                color: "var(--rose)",
              }}
            >
              <Flame className="size-3" aria-hidden /> Hot
            </span>
          )}
          {(lead.touchpoints ?? 1) > 1 && (
            <span
              className="rounded-full px-2 py-[2px] text-[10px] font-bold"
              style={{
                background: "var(--violet-50)",
                color: "var(--violet)",
              }}
            >
              {lead.touchpoints} touchpoints
            </span>
          )}
        </div>
        <p
          className="mt-0.5 truncate text-[11.5px]"
          style={{ color: "var(--ink-3)" }}
        >
          {metaLine}
        </p>
      </div>

      {/* Source pill */}
      <Pill tone={info.tone}>{info.label}</Pill>

      {/* Relative time */}
      <span
        className="w-24 text-right text-[11px] tabular-nums"
        style={{ color: "var(--ink-3)" }}
      >
        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
      </span>
    </div>
  );
}

/** Empty-state block for both "no leads at all" and "no matches". */
function EmptyState({ hasAnyLeads }: { hasAnyLeads: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <div
        className="mb-1 flex size-14 items-center justify-center rounded-2xl"
        style={{
          background: "var(--brand-50)",
          color: "var(--brand-deep)",
        }}
      >
        <Plug className="size-6" strokeWidth={1.6} aria-hidden />
      </div>
      <p
        className="text-[15px] font-semibold"
        style={{
          fontFamily: "var(--font-display)",
          color: "var(--ink)",
        }}
      >
        {hasAnyLeads ? "No leads match this filter" : "No leads yet"}
      </p>
      {!hasAnyLeads && (
        <>
          <p
            className="max-w-[320px] text-[13px] leading-relaxed"
            style={{ color: "var(--ink-2)" }}
          >
            Connect Meta Lead Ads, your website form or Google Ads and new
            leads will show up here automatically.
          </p>
          <Button
            size="sm"
            render={<Link href="/leads/sources" />}
            className="mt-2"
          >
            <Plug size={14} /> Connect a lead source
          </Button>
        </>
      )}
    </div>
  );
}

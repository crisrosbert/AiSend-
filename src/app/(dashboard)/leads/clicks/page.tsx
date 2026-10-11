"use client";

// src/app/(dashboard)/leads/clicks/page.tsx
//
// ────────────────────────────────────────────────────────────────────────────
// Clicks — Design System v2 (rebuilt 2026-10-11)
// ────────────────────────────────────────────────────────────────────────────
// Every Call-now and WhatsApp button tap the tracking script
// (public/aisend.js) recorded on the merchant's websites.
//
// A tap is NOT a lead: the script knows where the visitor came from, but not
// who they are. A WhatsApp tap becomes a lead only once the customer sends
// the pre-filled message (see src/lib/leads/website-whatsapp.ts); the
// "Became a chat" column shows which taps got that far. Call taps stay
// signals — the dialer takes over after the tap, so the caller never
// reaches us.
//
// Rows come straight from `lead_events` under row-level security
// (auth.uid() = tenant_id), so each merchant only ever sees their own taps.
//
// LAYOUT CONTRACT (matches the Design System v2 preview artifact)
// ---------------------------------------------------------------
//   [PageHead]  title + sub + Export CSV
//   [LeadsTabs] sub-nav
//   [StatCard row — 4 up] Total · Call · WhatsApp · Became chat
//   [Panel]     search + kind chips + site & range selectors
//   [Panel]     table of taps (sticky header on wide, stacked on narrow)
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LeadsTabs } from "@/components/leads/leads-tabs";
import { formatDistanceToNow, format } from "date-fns";

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
  Phone,
  MessageCircle,
  MousePointerClick,
  CheckCircle2,
} from "lucide-react";

type Kind = "call_click" | "whatsapp_click";

interface Attribution {
  gclid?: string | null;
  fbclid?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  referrer?: string | null;
  landing_page?: string | null;
}

interface ClickRow {
  id: string;
  kind: Kind;
  target: string | null;
  token: string | null;
  page_url: string | null;
  attribution: Attribution | null;
  matched_at: string | null;
  created_at: string;
  lead_sources: { name: string | null } | null;
}

const RANGES = [
  { id: 7, label: "7 days" },
  { id: 30, label: "30 days" },
  { id: 90, label: "90 days" },
] as const;

const ROW_LIMIT = 1000;

/**
 * Where did this tap come from? Returns a Pill tone instead of raw
 * Tailwind classes so the status language stays consistent with the
 * rest of the app's design system.
 */
function adSource(a: Attribution | null): { label: string; tone: PillTone } {
  const x = a ?? {};
  const medium = x.utm_medium ?? "";
  const source = x.utm_source ?? "";
  if (x.gclid || (/google/i.test(source) && /cpc|ppc|paid/i.test(medium))) {
    return { label: "Google Ads", tone: "sched" };
  }
  if (x.fbclid || /facebook|instagram|meta|fb|ig/i.test(source)) {
    return { label: "Meta Ads", tone: "info" };
  }
  if (source) {
    return { label: source.slice(0, 24), tone: "neutral" };
  }
  if (x.referrer) {
    return { label: "Referral", tone: "neutral" };
  }
  return { label: "Direct / organic", tone: "neutral" };
}

function siteOf(url: string | null): string {
  if (!url) return "—";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "—";
  }
}

function pathOf(url: string | null): string {
  if (!url) return "—";
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "/" : u.pathname.replace(/\/$/, "");
  } catch {
    return "—";
  }
}

/** "tel:+9198..." / "https://wa.me/9198..." → "+9198..." for display. */
function targetLabel(kind: Kind, target: string | null): string {
  if (!target) return "—";
  if (kind === "call_click") return target.replace(/^tel:/i, "");
  const m = target.match(/(?:wa\.me\/|phone=)\+?(\d{7,15})/i);
  // A chat widget link often carries no number at all (api.whatsapp.com/send).
  return m ? `+${m[1]}` : "WhatsApp widget";
}

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function ClicksPage() {
  const supabase = useMemo(() => createClient(), []);
  const [days, setDays] = useState<number>(30);
  const [kind, setKind] = useState<"all" | Kind>("all");
  const [site, setSite] = useState("all");
  const [search, setSearch] = useState("");
  // `key` records which range the rows belong to, so "loading" is derived
  // instead of set synchronously inside the effect.
  const [result, setResult] = useState<{
    key: number;
    rows: ClickRow[];
    error: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("lead_events")
        .select(
          "id, kind, target, token, page_url, attribution, matched_at, created_at, lead_sources(name)",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT);
      if (cancelled) return;
      setResult({
        key: days,
        rows: (data as unknown as ClickRow[]) ?? [],
        error: !!error,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, days]);

  const loading = !result || result.key !== days;
  const rows = useMemo(
    () => (result && result.key === days ? result.rows : []),
    [result, days],
  );

  const sites = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const s = siteOf(r.page_url);
      if (s !== "—") set.add(s);
    }
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind !== "all" && r.kind !== kind) return false;
      if (site !== "all" && siteOf(r.page_url) !== site) return false;
      if (!q) return true;
      return [
        pathOf(r.page_url),
        siteOf(r.page_url),
        targetLabel(r.kind, r.target),
        r.attribution?.utm_campaign,
        r.attribution?.utm_source,
        r.lead_sources?.name,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, kind, site, search]);

  const callCount = filtered.filter((r) => r.kind === "call_click").length;
  const waRows = filtered.filter((r) => r.kind === "whatsapp_click");
  const waCount = waRows.length;
  const waChats = waRows.filter((r) => r.matched_at).length;
  const waRate = waCount > 0 ? Math.round((waChats / waCount) * 100) : 0;

  const exportCsv = () => {
    const header = [
      "Time", "Type", "Number", "Site", "Page",
      "Source", "Campaign", "Website source", "Became a chat",
    ];
    const out = filtered.map((r) => [
      new Date(r.created_at).toISOString(),
      r.kind === "call_click" ? "Call tap" : "WhatsApp tap",
      targetLabel(r.kind, r.target),
      siteOf(r.page_url),
      pathOf(r.page_url),
      adSource(r.attribution).label,
      r.attribution?.utm_campaign ?? "",
      r.lead_sources?.name ?? "",
      r.kind === "whatsapp_click" ? (r.matched_at ? "Yes" : "No") : "",
    ]);
    const csv = [header, ...out].map((r) => r.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `clicks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full px-5 pb-20 pt-5 sm:px-7 lg:px-10 lg:pb-10">
      <PageHead
        title="Call & WhatsApp clicks"
        subtitle="Every tap on a Call now or WhatsApp button on your websites, with the page it happened on and the ad it came from. A tap shows interest, but we do not know who tapped. A WhatsApp tap turns into a lead once the customer sends the message."
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

      <div className="mb-6">
        <LeadsTabs active="clicks" />
      </div>

      {/* KPI row — 4 up */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total taps"
          value={filtered.length.toLocaleString("en-IN")}
          icon={<MousePointerClick size={12} aria-hidden />}
        />
        <StatCard
          label="Call taps"
          value={callCount.toLocaleString("en-IN")}
          icon={<Phone size={12} aria-hidden />}
        />
        <StatCard
          label="WhatsApp taps"
          value={waCount.toLocaleString("en-IN")}
          icon={<MessageCircle size={12} aria-hidden />}
        />
        <StatCard
          label="Became a chat"
          value={`${waChats} (${waRate}%)`}
          icon={<CheckCircle2 size={12} aria-hidden />}
        />
      </div>

      {/* Search + filter chips + site & range selectors */}
      <Panel className="mb-6">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2"
              style={{ color: "var(--ink-3)" }}
              aria-hidden
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search page, number, campaign…"
              className="w-full rounded-[9px] border py-2 pl-10 pr-3 text-[13px] outline-none transition-colors"
              style={{
                borderColor: "var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
              }}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", "All"],
                ["call_click", "Calls"],
                ["whatsapp_click", "WhatsApp"],
              ] as const
            ).map(([val, label]) => (
              <FilterChip
                key={val}
                label={label}
                active={kind === val}
                onClick={() => setKind(val)}
              />
            ))}
          </div>

          {sites.length > 1 && (
            <SelectControl
              value={site}
              onChange={(v) => setSite(v)}
              aria-label="Filter by website"
            >
              <option value="all">All websites</option>
              {sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectControl>
          )}

          <SelectControl
            value={String(days)}
            onChange={(v) => setDays(Number(v))}
            aria-label="Time range"
          >
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                Last {r.label}
              </option>
            ))}
          </SelectControl>
        </div>
      </Panel>

      {/* Clicks list */}
      <Panel>
        <PanelHead
          title={`${filtered.length} tap${filtered.length === 1 ? "" : "s"}`}
          subtitle={
            kind !== "all"
              ? `Filtered by ${kind === "call_click" ? "Call" : "WhatsApp"}`
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
        ) : result?.error ? (
          <div
            className="px-6 py-16 text-center text-[13px]"
            style={{ color: "var(--ink-3)" }}
          >
            Could not load clicks. Refresh the page, and check that migration 038 has been run.
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasAnyRows={rows.length > 0} />
        ) : (
          <>
            {/* Header row (desktop only) */}
            <div
              className="hidden grid-cols-[130px_110px_1fr_1.2fr_150px_120px] gap-3 border-b px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide md:grid"
              style={{
                borderColor: "var(--line)",
                background: "var(--surface-2)",
                color: "var(--ink-3)",
                letterSpacing: "0.02em",
              }}
            >
              <span>Time</span>
              <span>Type</span>
              <span>Number</span>
              <span>Website &amp; page</span>
              <span>Source</span>
              <span>Became a chat</span>
            </div>

            {/* Rows */}
            <div
              className="divide-y"
              style={{ borderColor: "var(--line)" }}
            >
              {filtered.map((r) => (
                <ClickItem key={r.id} row={r} />
              ))}
            </div>

            {rows.length >= ROW_LIMIT && (
              <p
                className="border-t px-4 py-2.5 text-center text-[11px]"
                style={{
                  borderColor: "var(--line)",
                  color: "var(--ink-3)",
                }}
              >
                Showing the latest {ROW_LIMIT} taps in this range. Narrow the time range to see older ones.
              </p>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// LOCAL COMPONENTS
// ────────────────────────────────────────────────────────────────────────────

/** Dark-pill-when-active filter chip — matches /leads and /leads/whatsapp. */
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
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
      {label}
    </button>
  );
}

/** Token-driven <select> wrapper so site/range selectors match the chips. */
function SelectControl({
  value,
  onChange,
  children,
  ...props
}: {
  value: string;
  onChange: (next: string) => void;
  children: React.ReactNode;
} & React.AriaAttributes) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-[9px] border px-3 py-2 text-[12px] font-semibold outline-none transition-colors"
      style={{
        borderColor: "var(--line)",
        background: "var(--surface)",
        color: "var(--ink-2)",
      }}
      {...props}
    >
      {children}
    </select>
  );
}

/** Single click row — stacks on mobile, 6-col grid on desktop. */
function ClickItem({ row }: { row: ClickRow }) {
  const src = adSource(row.attribution);
  const isCall = row.kind === "call_click";
  return (
    <div
      className="grid grid-cols-2 items-center gap-x-3 gap-y-1.5 px-5 py-3 transition-colors md:grid-cols-[130px_110px_1fr_1.2fr_150px_120px] md:gap-y-0 hover:bg-[color:var(--surface-2)]"
    >
      {/* Time */}
      <div>
        <p
          className="text-[12px] font-semibold tabular-nums"
          style={{ color: "var(--ink)" }}
        >
          {format(new Date(row.created_at), "d MMM, h:mm a")}
        </p>
        <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
          {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
        </p>
      </div>

      {/* Type — call = rose, whatsapp = brand */}
      <span
        className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
        style={{
          background: isCall ? "var(--rose-50)" : "var(--brand-50)",
          color: isCall ? "var(--rose)" : "var(--brand-deep)",
          borderColor: isCall ? "var(--rose-200)" : "var(--brand-200)",
        }}
      >
        {isCall ? (
          <Phone className="size-3" aria-hidden />
        ) : (
          <MessageCircle className="size-3" aria-hidden />
        )}
        {isCall ? "Call" : "WhatsApp"}
      </span>

      {/* Target number */}
      <p
        className="truncate text-[12px]"
        style={{ color: "var(--ink-2)", fontFamily: "var(--font-mono)" }}
      >
        {targetLabel(row.kind, row.target)}
      </p>

      {/* Site + path */}
      <div className="min-w-0">
        <p
          className="truncate text-[12px] font-semibold"
          style={{ color: "var(--ink)" }}
        >
          {siteOf(row.page_url)}
        </p>
        <p
          className="truncate text-[11px]"
          style={{ color: "var(--ink-3)" }}
          title={row.page_url ?? undefined}
        >
          {pathOf(row.page_url)}
        </p>
      </div>

      {/* Ad source + optional campaign */}
      <div className="min-w-0">
        <Pill tone={src.tone}>{src.label}</Pill>
        {row.attribution?.utm_campaign && (
          <p
            className="mt-0.5 truncate text-[11px]"
            style={{ color: "var(--ink-3)" }}
          >
            {row.attribution.utm_campaign}
          </p>
        )}
      </div>

      {/* Became a chat */}
      <div>
        {isCall ? (
          <span
            className="text-[11px]"
            style={{ color: "var(--ink-4)" }}
            title="Calls go through the phone dialer, so we cannot follow them"
          >
            —
          </span>
        ) : row.matched_at ? (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-bold"
            style={{ color: "var(--brand-deep)" }}
          >
            <CheckCircle2 className="size-3.5" aria-hidden /> Yes
          </span>
        ) : (
          <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>
            Not yet
          </span>
        )}
      </div>
    </div>
  );
}

/** Empty-state block — same shape as the other leads sub-pages. */
function EmptyState({ hasAnyRows }: { hasAnyRows: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <div
        className="mb-1 flex size-14 items-center justify-center rounded-2xl"
        style={{
          background: "var(--brand-50)",
          color: "var(--brand-deep)",
        }}
      >
        <MousePointerClick className="size-6" strokeWidth={1.6} aria-hidden />
      </div>
      <p
        className="text-[15px] font-semibold"
        style={{
          fontFamily: "var(--font-display)",
          color: "var(--ink)",
        }}
      >
        {hasAnyRows ? "No clicks match this filter" : "No clicks recorded yet"}
      </p>
      {!hasAnyRows && (
        <p
          className="max-w-[380px] text-[13px] leading-relaxed"
          style={{ color: "var(--ink-2)" }}
        >
          Add the tracking script from Lead sources to your website. Taps on phone and WhatsApp buttons then show up here automatically.
        </p>
      )}
    </div>
  );
}

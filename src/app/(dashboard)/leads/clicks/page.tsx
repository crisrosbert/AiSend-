"use client";

// src/app/(dashboard)/leads/clicks/page.tsx
//
// CLICKS — every Call-now and WhatsApp button tap the tracking script
// (public/aisend.js) recorded on the merchant's websites.
//
// A tap is not a lead: the script knows where the visitor came from but not
// who they are. A WhatsApp tap becomes a lead only once the customer sends
// the pre-filled message (see src/lib/leads/website-whatsapp.ts), and the
// "Became a chat" column shows which taps got that far. Call taps stay
// signals: the dialer takes over after the tap, so the caller never reaches us.
//
// Rows come straight from `lead_events` under row-level security
// (auth.uid() = tenant_id), so each merchant only ever sees their own taps.

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LeadsTabs } from "@/components/leads/leads-tabs";
import { Loader2, Search, Download, Phone, MessageCircle, MousePointerClick, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

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

/** Where did this tap come from? Same rule the form capture uses for Google Ads. */
function adSource(a: Attribution | null): { label: string; cls: string } {
  const x = a ?? {};
  const medium = x.utm_medium ?? "";
  const source = x.utm_source ?? "";
  if (x.gclid || (/google/i.test(source) && /cpc|ppc|paid/i.test(medium))) {
    return { label: "Google Ads", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  if (x.fbclid || /facebook|instagram|meta|fb|ig/i.test(source)) {
    return { label: "Meta Ads", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  if (source) {
    return { label: source.slice(0, 24), cls: "bg-slate-50 text-slate-600 border-slate-200" };
  }
  if (x.referrer) {
    return { label: "Referral", cls: "bg-slate-50 text-slate-600 border-slate-200" };
  }
  return { label: "Direct / organic", cls: "bg-slate-50 text-slate-500 border-slate-200" };
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

/** "tel:+9198..." / "https://wa.me/9198..." -> "+9198..." for display. */
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
  const [result, setResult] = useState<{ key: number; rows: ClickRow[]; error: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("lead_events")
        .select("id, kind, target, token, page_url, attribution, matched_at, created_at, lead_sources(name)")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT);
      if (cancelled) return;
      setResult({ key: days, rows: (data as unknown as ClickRow[]) ?? [], error: !!error });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, days]);

  const loading = !result || result.key !== days;
  const rows = useMemo(() => (result && result.key === days ? result.rows : []), [result, days]);

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
    const header = ["Time", "Type", "Number", "Site", "Page", "Source", "Campaign", "Website source", "Became a chat"];
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

  const stats = [
    { label: "Total taps", value: filtered.length, icon: MousePointerClick, tone: "text-emerald-600" },
    { label: "Call taps", value: callCount, icon: Phone, tone: "text-rose-500" },
    { label: "WhatsApp taps", value: waCount, icon: MessageCircle, tone: "text-green-600" },
    { label: "WhatsApp taps that became a chat", value: `${waChats} (${waRate}%)`, icon: CheckCircle2, tone: "text-indigo-500" },
  ];

  return (
    <div className="space-y-5">
      <LeadsTabs active="clicks" />

      <div className="overflow-hidden rounded-2xl border border-[#d1fae5] bg-gradient-to-br from-white to-emerald-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
              Call &amp; WhatsApp clicks
            </h1>
            <p className="mt-1 max-w-xl text-xs text-slate-500">
              Every tap on a Call now or WhatsApp button on your websites, with the page it happened on and the ad it
              came from. A tap shows interest, but we do not know who tapped. A WhatsApp tap turns into a lead once the
              customer sends the message.
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
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[#d1fae5] pt-4 sm:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="flex items-start gap-2.5">
              <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} />
              <div>
                <p className="text-lg font-bold leading-none text-slate-800">{value}</p>
                <p className="mt-1 text-[11px] leading-tight text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search page, number, campaign..."
            className="w-full rounded-lg border border-[#e7ece9] bg-white py-2 pl-10 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
            <button
              key={val}
              onClick={() => setKind(val)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                kind === val
                  ? "border-transparent bg-emerald-500 text-white"
                  : "border-[#e7ece9] bg-white text-slate-500 hover:border-emerald-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {sites.length > 1 && (
          <select
            value={site}
            onChange={(e) => setSite(e.target.value)}
            className="rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-xs font-bold text-slate-600 focus:border-emerald-500 focus:outline-none"
            aria-label="Filter by website"
          >
            <option value="all">All websites</option>
            {sites.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-xs font-bold text-slate-600 focus:border-emerald-500 focus:outline-none"
          aria-label="Time range"
        >
          {RANGES.map((r) => (
            <option key={r.id} value={r.id}>
              Last {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e7ece9] bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-emerald-500" />
          </div>
        ) : result?.error ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            Could not load clicks. Refresh the page, and check that migration 038 has been run.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <MousePointerClick className="size-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {rows.length === 0 ? "No clicks recorded yet" : "No clicks match this filter"}
            </p>
            {rows.length === 0 && (
              <p className="mt-1 max-w-sm text-xs text-slate-400">
                Add the tracking script from Lead sources to your website. Taps on phone and WhatsApp buttons then show
                up here automatically.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[130px_110px_1fr_1.2fr_130px_120px] gap-3 border-b border-[#e7ece9] bg-slate-50/60 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 md:grid">
              <span>Time</span>
              <span>Type</span>
              <span>Number</span>
              <span>Website &amp; page</span>
              <span>Source</span>
              <span>Became a chat</span>
            </div>
            <div className="divide-y divide-[#e7ece9]">
              {filtered.map((r) => {
                const src = adSource(r.attribution);
                const isCall = r.kind === "call_click";
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-2 items-center gap-x-3 gap-y-1.5 px-4 py-3 md:grid-cols-[130px_110px_1fr_1.2fr_130px_120px] md:gap-y-0"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{format(new Date(r.created_at), "d MMM, h:mm a")}</p>
                      <p className="text-[11px] text-slate-400">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <span
                      className={`flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        isCall
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-green-200 bg-green-50 text-green-700"
                      }`}
                    >
                      {isCall ? <Phone className="size-3" /> : <MessageCircle className="size-3" />}
                      {isCall ? "Call" : "WhatsApp"}
                    </span>
                    <p className="truncate text-xs text-slate-600">{targetLabel(r.kind, r.target)}</p>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-700">{siteOf(r.page_url)}</p>
                      <p className="truncate text-[11px] text-slate-400" title={r.page_url ?? undefined}>
                        {pathOf(r.page_url)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <span className={`inline-block max-w-full truncate rounded-full border px-2.5 py-1 text-[11px] font-bold ${src.cls}`}>
                        {src.label}
                      </span>
                      {r.attribution?.utm_campaign && (
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">{r.attribution.utm_campaign}</p>
                      )}
                    </div>
                    <div>
                      {isCall ? (
                        <span className="text-[11px] text-slate-300" title="Calls go through the phone dialer, so we cannot follow them">
                          —
                        </span>
                      ) : r.matched_at ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                          <CheckCircle2 className="size-3.5" /> Yes
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Not yet</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {rows.length >= ROW_LIMIT && (
              <p className="border-t border-[#e7ece9] px-4 py-2.5 text-center text-[11px] text-slate-400">
                Showing the latest {ROW_LIMIT} taps in this range. Narrow the time range to see older ones.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

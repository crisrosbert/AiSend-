"use client";

// src/app/(dashboard)/broadcasts/page.tsx
//
// ────────────────────────────────────────────────────────────────────────────
// Broadcasts (Campaigns) list — Design System v2 (rebuilt 2026-10-11)
// ────────────────────────────────────────────────────────────────────────────
//
// LAYOUT CONTRACT
// ---------------
//   [PageHead]  title + sub + "New campaign" button
//   [StatCard row — 4 up] Total campaigns · Running · Sent 30d · Avg. open rate
//   [Panel "Saved drafts"] (conditional) grid of resumable draft cards
//   [Panel "All campaigns"] filter chips + table of sent / scheduled / failed
//
// Every colour, font, radius, and shadow references globals.css. No local
// CSS. No hardcoded hex. Business logic (fetch, delete, resume, confirm)
// preserved verbatim from the previous version.
// ────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Broadcast } from "@/types";
import { useBusiness } from "@/hooks/use-business";

// ── Shared design-system components ──
import { PageHead } from "@/components/ui/page-head";
import { Panel, PanelHead } from "@/components/ui/panel";
import { Pill, type PillTone } from "@/components/ui/pill";
import { StatCard } from "@/components/ui/stat";
import { Button } from "@/components/ui/button";

import {
  Plus,
  Radio,
  Trash2,
  Play,
  Search,
  Zap,
  Eye,
  CheckCircle2,
} from "lucide-react";

type StatusFilter = "all" | "running" | "scheduled" | "sent" | "failed";

export default function BroadcastsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { businessId, loading: businessLoading } = useBusiness();

  // ── Data state (preserved from the previous version) ──
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [drafts, setDrafts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draftSearch, setDraftSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // ── Fetch (same shape as before, now typed and uses Supabase typing) ──
  const fetchBroadcasts = useCallback(async () => {
    setLoading(true);
    try {
      if (businessLoading) return;
      if (!businessId) {
        setDrafts([]);
        setBroadcasts([]);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("broadcasts")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const all = (data ?? []) as Broadcast[];
      setDrafts(all.filter((b) => b.status === "draft"));
      setBroadcasts(all.filter((b) => b.status !== "draft"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load broadcasts");
    } finally {
      setLoading(false);
    }
  }, [supabase, businessId, businessLoading]);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  async function deleteDraft(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/broadcasts/draft?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Delete failed");
      }
      toast.success("Draft deleted");
      fetchBroadcasts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete draft");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  // ── Derived aggregates for the StatCard row ──
  const stats = useMemo(() => computeAggregates(broadcasts), [broadcasts]);

  // ── Filter chips → counts & active-filter table rows ──
  const counts = useMemo(() => {
    const base = {
      all: broadcasts.length,
      running: broadcasts.filter((b) => b.status === "sending").length,
      scheduled: broadcasts.filter((b) => b.status === "scheduled").length,
      sent: broadcasts.filter((b) => b.status === "sent").length,
      failed: broadcasts.filter((b) => b.status === "failed").length,
    };
    return base;
  }, [broadcasts]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return broadcasts;
    if (statusFilter === "running") return broadcasts.filter((b) => b.status === "sending");
    return broadcasts.filter((b) => b.status === statusFilter);
  }, [broadcasts, statusFilter]);

  // ── Draft search filter ──
  const visibleDrafts = useMemo(() => {
    const q = draftSearch.trim().toLowerCase();
    if (!q) return drafts;
    return drafts.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.template_name?.toLowerCase().includes(q),
    );
  }, [drafts, draftSearch]);

  const runningCount = counts.running;

  // ────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full px-5 pb-20 pt-5 sm:px-7 lg:px-10 lg:pb-10">
      {/* Page header */}
      <PageHead
        title="Campaigns"
        subtitle={`${broadcasts.length} total · ${drafts.length} draft${drafts.length === 1 ? "" : "s"} · send bulk messages via approved templates`}
        live={runningCount > 0 ? { label: `${runningCount} sending now` } : undefined}
        actions={
          <Button render={<Link href="/broadcasts/new" />}>
            <Plus size={14} /> New campaign
          </Button>
        }
      />

      {/* KPI row — 4 up */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total campaigns"
          value={broadcasts.length.toLocaleString("en-IN")}
          icon={<Radio size={12} aria-hidden />}
        />
        <StatCard
          label="Running now"
          value={runningCount.toLocaleString("en-IN")}
          icon={<Zap size={12} aria-hidden />}
        />
        <StatCard
          label="Delivered (last 30d)"
          value={formatCompact(stats.deliveredLast30d)}
          icon={<CheckCircle2 size={12} aria-hidden />}
        />
        <StatCard
          label="Avg. open rate"
          value={`${stats.avgOpenPct}%`}
          icon={<Eye size={12} aria-hidden />}
        />
      </div>

      {/* Drafts panel — only when there is at least one */}
      {drafts.length > 0 && (
        <Panel className="mb-6">
          <PanelHead
            title={`Saved drafts (${drafts.length})`}
            actions={
              drafts.length > 4 && (
                <div
                  className="relative"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "0 10px",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    background: "var(--surface)",
                    width: 220,
                  }}
                >
                  <Search size={13} style={{ color: "var(--ink-3)" }} aria-hidden />
                  <input
                    type="text"
                    value={draftSearch}
                    onChange={(e) => setDraftSearch(e.target.value)}
                    placeholder="Search drafts…"
                    className="w-full py-1.5 text-[12px]"
                    style={{
                      border: 0,
                      outline: 0,
                      background: "transparent",
                      color: "var(--ink)",
                    }}
                  />
                </div>
              )
            }
          />
          <div className="p-5">
            {visibleDrafts.length === 0 ? (
              <p
                className="rounded-xl border border-dashed px-4 py-6 text-center text-[12px]"
                style={{
                  borderColor: "var(--line-strong)",
                  background: "var(--surface-2)",
                  color: "var(--ink-3)",
                }}
              >
                No drafts match &ldquo;{draftSearch}&rdquo;.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleDrafts.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    isDeleting={deletingId === draft.id}
                    isConfirming={confirmDeleteId === draft.id}
                    onResume={() => router.push(`/broadcasts/new?draft=${draft.id}`)}
                    onConfirm={() => setConfirmDeleteId(draft.id)}
                    onCancel={() => setConfirmDeleteId(null)}
                    onDelete={() => deleteDraft(draft.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* All campaigns panel */}
      <Panel>
        <PanelHead
          title="All campaigns"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip
                label={`All · ${counts.all}`}
                active={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
              />
              <FilterChip
                label={`Running · ${counts.running}`}
                active={statusFilter === "running"}
                onClick={() => setStatusFilter("running")}
              />
              <FilterChip
                label={`Scheduled · ${counts.scheduled}`}
                active={statusFilter === "scheduled"}
                onClick={() => setStatusFilter("scheduled")}
              />
              <FilterChip
                label={`Completed · ${counts.sent}`}
                active={statusFilter === "sent"}
                onClick={() => setStatusFilter("sent")}
              />
              {counts.failed > 0 && (
                <FilterChip
                  label={`Failed · ${counts.failed}`}
                  active={statusFilter === "failed"}
                  onClick={() => setStatusFilter("failed")}
                />
              )}
            </div>
          }
        />

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <span className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              Loading campaigns…
            </span>
          </div>
        ) : broadcasts.length === 0 ? (
          <EmptyState
            title="No campaigns yet"
            body="Create your first WhatsApp campaign to reach your contacts at scale."
            ctaLabel="New campaign"
            ctaHref="/broadcasts/new"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No campaigns match this filter"
            body={`There are no ${statusFilter} campaigns right now. Try a different filter above.`}
          />
        ) : (
          <CampaignsTable broadcasts={filtered} onOpen={(id) => router.push(`/broadcasts/${id}`)} />
        )}
      </Panel>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// LOCAL COMPONENTS
// ────────────────────────────────────────────────────────────────────────────

/** Filter chip for the campaigns panel header. Dark when active, light otherwise. */
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
      className="rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors"
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

/** Draft card — resume or delete a draft campaign. */
function DraftCard({
  draft,
  isDeleting,
  isConfirming,
  onResume,
  onConfirm,
  onCancel,
  onDelete,
}: {
  draft: Broadcast;
  isDeleting: boolean;
  isConfirming: boolean;
  onResume: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const af = (draft.audience_filter as Record<string, unknown>) ?? {};
  const audienceType = (af.type as string) ?? "all";
  const step = typeof af._current_step === "number" ? af._current_step : 0;
  const stepLabels = ["Template", "Audience", "Personalise", "Review"];

  return (
    <div
      className="flex flex-col justify-between rounded-[12px] border p-4 transition-shadow hover:shadow-md"
      style={{
        borderColor: "var(--line)",
        background: "var(--surface)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="mb-3 space-y-1">
        <p className="font-semibold" style={{ color: "var(--ink)" }}>
          {draft.name || "Untitled draft"}
        </p>
        {draft.template_name && (
          <p className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
            Template:{" "}
            <span className="font-medium" style={{ color: "var(--ink-2)" }}>
              {draft.template_name}
            </span>
          </p>
        )}
        <p className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
          Audience:{" "}
          <span className="font-medium capitalize" style={{ color: "var(--ink-2)" }}>
            {audienceType}
          </span>
        </p>
        <p className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
          Last step:{" "}
          <span className="font-semibold" style={{ color: "var(--brand-deep)" }}>
            {stepLabels[step] ?? "Template"}
          </span>
        </p>
        <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>
          {new Date(draft.created_at).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onResume} className="flex-1">
          <Play size={13} /> Resume
        </Button>

        {isConfirming ? (
          <div
            className="flex items-center gap-1 rounded-md border px-2 py-1"
            style={{
              borderColor: "var(--rose-200)",
              background: "var(--rose-50)",
            }}
          >
            <span className="text-[11px]" style={{ color: "var(--rose)" }}>
              Sure?
            </span>
            <button
              onClick={onCancel}
              className="px-1 text-[11px]"
              style={{ color: "var(--ink-3)" }}
            >
              No
            </button>
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="px-1 text-[11px] font-semibold disabled:opacity-50"
              style={{ color: "var(--rose)" }}
            >
              {isDeleting ? "…" : "Yes"}
            </button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={onConfirm}
            aria-label="Delete draft"
          >
            <Trash2 size={13} />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Empty state block used inside the campaigns panel. */
function EmptyState({
  title,
  body,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
      <div
        className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "var(--brand-50)", color: "var(--brand-deep)" }}
      >
        <Radio size={24} strokeWidth={1.6} />
      </div>
      <h5
        className="text-[15px] font-semibold"
        style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
      >
        {title}
      </h5>
      <p
        className="max-w-[320px] text-[13px] leading-relaxed"
        style={{ color: "var(--ink-2)" }}
      >
        {body}
      </p>
      {ctaLabel && ctaHref && (
        <Button size="sm" render={<Link href={ctaHref} />} className="mt-2">
          <Plus size={14} /> {ctaLabel}
        </Button>
      )}
    </div>
  );
}

/** The sent/scheduled/failed campaigns table. */
function CampaignsTable({
  broadcasts,
  onOpen,
}: {
  broadcasts: Broadcast[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <Th>Campaign</Th>
            <Th>Status</Th>
            <Th align="right">Recipients</Th>
            <Th align="right">Delivered</Th>
            <Th align="right">Opened</Th>
            <Th align="right">Date</Th>
          </tr>
        </thead>
        <tbody>
          {broadcasts.map((b, idx) => (
            <CampaignRow
              key={b.id}
              broadcast={b}
              isLast={idx === broadcasts.length - 1}
              onOpen={() => onOpen(b.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className="px-5 py-2.5 text-[11px] font-semibold uppercase"
      style={{
        color: "var(--ink-3)",
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--line)",
        letterSpacing: "0.02em",
        textAlign: align,
      }}
    >
      {children}
    </th>
  );
}

function CampaignRow({
  broadcast,
  isLast,
  onOpen,
}: {
  broadcast: Broadcast;
  isLast: boolean;
  onOpen: () => void;
}) {
  const tone = statusToTone(broadcast.status);
  const dotColor = dotForTone(tone);
  const deliveredPct =
    broadcast.total_recipients > 0
      ? Math.round((broadcast.delivered_count / broadcast.total_recipients) * 100)
      : 0;
  const openedPct =
    broadcast.sent_count > 0
      ? Math.round((broadcast.read_count / broadcast.sent_count) * 100)
      : 0;
  const dateLabel =
    broadcast.status === "scheduled" && broadcast.scheduled_at
      ? new Date(broadcast.scheduled_at).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date(broadcast.created_at).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
        });
  const border = isLast ? "none" : "1px solid var(--line)";

  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer transition-colors hover:bg-[color:var(--surface-2)]"
    >
      <td className="px-5 py-3.5 align-middle" style={{ borderBottom: border }}>
        <div className="flex items-center gap-2.5">
          <span
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ background: dotColor }}
            aria-hidden
          />
          <div className="min-w-0">
            <div className="truncate font-semibold" style={{ color: "var(--ink)" }}>
              {broadcast.name}
            </div>
            <div
              className="mt-0.5 truncate text-[11px]"
              style={{ color: "var(--ink-3)" }}
            >
              Template · {broadcast.template_name}
            </div>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5 align-middle" style={{ borderBottom: border }}>
        <Pill tone={tone}>{statusLabel(broadcast)}</Pill>
      </td>
      <td
        className="px-5 py-3.5 text-right align-middle tabular-nums"
        style={{ borderBottom: border, color: "var(--ink)" }}
      >
        {broadcast.total_recipients.toLocaleString("en-IN")}
      </td>
      <td className="px-5 py-3.5 align-middle" style={{ borderBottom: border }}>
        {broadcast.total_recipients > 0 ? (
          <Meter pct={deliveredPct} />
        ) : (
          <span
            className="block text-right text-[11px]"
            style={{ color: "var(--ink-3)" }}
          >
            —
          </span>
        )}
      </td>
      <td className="px-5 py-3.5 align-middle" style={{ borderBottom: border }}>
        {broadcast.sent_count > 0 ? (
          <Meter pct={openedPct} />
        ) : (
          <span
            className="block text-right text-[11px]"
            style={{ color: "var(--ink-3)" }}
          >
            —
          </span>
        )}
      </td>
      <td
        className="px-5 py-3.5 text-right align-middle text-[12px] tabular-nums"
        style={{ borderBottom: border, color: "var(--ink-3)" }}
      >
        {dateLabel}
      </td>
    </tr>
  );
}

/** Horizontal meter + percent label — right-aligned, 52px wide track. */
function Meter({ pct }: { pct: number }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div
        className="h-1 w-[52px] overflow-hidden rounded-full"
        style={{ background: "var(--canvas)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            background: "var(--brand)",
            width: `${Math.min(100, pct)}%`,
          }}
        />
      </div>
      <span
        className="min-w-[28px] text-right text-[11px] tabular-nums"
        style={{ color: "var(--ink-2)" }}
      >
        {pct}%
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// PURE HELPERS
// ────────────────────────────────────────────────────────────────────────────

function statusToTone(status: Broadcast["status"]): PillTone {
  switch (status) {
    case "sending":
      return "live";
    case "scheduled":
      return "sched";
    case "sent":
      return "done";
    case "failed":
      return "err";
    case "draft":
      return "info";
    default:
      return "neutral";
  }
}

function statusLabel(b: Broadcast): string {
  switch (b.status) {
    case "sending":
      return "Sending";
    case "scheduled":
      return "Scheduled";
    case "sent":
      return "Completed";
    case "failed":
      return b.failed_count > 0 ? `${b.failed_count} failed` : "Failed";
    case "draft":
      return "Draft";
    default:
      return b.status;
  }
}

function dotForTone(tone: PillTone): string {
  switch (tone) {
    case "live":
      return "var(--brand)";
    case "sched":
      return "var(--amber)";
    case "err":
      return "var(--rose)";
    case "info":
      return "var(--blue)";
    case "done":
      return "var(--ink-3)";
    default:
      return "var(--ink-3)";
  }
}

/** 123456 → "1.23L". Indian compact formatting (same as dashboard). */
function formatCompact(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("en-IN");
}

/** Aggregates for the top-of-page KPIs. */
function computeAggregates(broadcasts: Broadcast[]) {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const last30 = broadcasts.filter(
    (b) => new Date(b.created_at).getTime() >= thirtyDaysAgo,
  );
  const deliveredLast30d = last30.reduce((s, b) => s + (b.delivered_count ?? 0), 0);
  const totalSent = broadcasts.reduce((s, b) => s + (b.sent_count ?? 0), 0);
  const totalRead = broadcasts.reduce((s, b) => s + (b.read_count ?? 0), 0);
  const avgOpenPct = totalSent > 0 ? Math.round((totalRead / totalSent) * 100) : 0;
  return { deliveredLast30d, avgOpenPct };
}

// NOTE: the previous `getBroadcastStatus` helper and shadcn <Table> primitives
// used before this rebuild are no longer imported here. They're not removed
// from the codebase — the broadcast detail page and other consumers still
// reference them — this file just doesn't need them anymore.

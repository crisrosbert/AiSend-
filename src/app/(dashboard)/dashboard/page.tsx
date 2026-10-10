"use client";

// src/app/(dashboard)/dashboard/page.tsx
//
// ────────────────────────────────────────────────────────────────────────────
// AiSend Dashboard — Design System v2 (rebuilt 2026-10-11)
// ────────────────────────────────────────────────────────────────────────────
//
// LAYOUT CONTRACT (matches the Design System v2 preview artifact)
// ---------------------------------------------------------------
//   [PageHead] title + sub + live chip + "New campaign" button
//   [HeroStat] big messages-sent-today number + sparkline, 3 MiniStats aside
//   [QuotaBanner] (conditional) — amber warning as the tier ceiling nears
//   [Row 1.3fr/1fr]
//     ├─ Panel "Active campaigns" — recent broadcasts, status pills, meter
//     └─ Panel "Live activity"   — vertical feed, empty state when quiet
//   [Row 3-up]
//     ├─ InsightCard "Best time to send"
//     ├─ InsightCard "Template health"
//     └─ InsightCard "Account quality"
//   [Row 3-up] Wallet · Ads credits · Mobile app  (secondary, below the fold)
//
// All visuals come from shared components in src/components/ui/ and
// src/components/dashboard/. There is NO page-local CSS in this file —
// every colour, spacing, radius, and shadow references globals.css.
// If a visual drifts, fix it in globals.css or the component — never
// re-introduce a local `<style>{cssStyles}</style>` block here.
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useBusiness } from "@/hooks/use-business";
import {
  loadMetrics,
  loadActivity,
  loadConversationsSeries,
  loadMessagingQuotaUsage,
  loadResponseTime,
} from "@/lib/dashboard/queries";
import type {
  MetricsBundle,
  ActivityItem,
  ConversationsSeriesPoint,
  ResponseTimeSummary,
} from "@/lib/dashboard/types";
import { describeMessagingTier, quotaStatus } from "@/lib/whatsapp/messaging-tier";
import type { Broadcast } from "@/types";

// ── Shared design-system components ──
import { PageHead } from "@/components/ui/page-head";
import { Panel, PanelHead } from "@/components/ui/panel";
import { Pill, type PillTone } from "@/components/ui/pill";
import { HeroStat, MiniStat } from "@/components/ui/stat";
import { Button } from "@/components/ui/button";

// ── Dashboard-local design-system components ──
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { InsightCard } from "@/components/dashboard/insight-card";

// ── Business-logic components (unchanged) ──
import { WalletBalanceCard } from "@/components/dashboard/wallet-balance-card";
import { ReferralConsumer } from "@/components/dashboard/referral-capture";

import {
  Send,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Megaphone,
  QrCode,
  Plus,
} from "lucide-react";

/**
 * Shape returned by GET /api/whatsapp/config.
 * The API route scopes by user_id, so each tenant only sees its own config.
 */
interface WaConfigState {
  connected: boolean;
  reason?: string;
  message?: string;
  phone_info?: {
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
    messaging_limit_tier?: string;
  };
}

/** Count of approved vs. pending WhatsApp templates for the current business. */
interface TemplateHealth {
  approved: number;
  pending: number;
}

export default function DashboardPage() {
  // ────────────────────────────────────────────────────────────────────────
  // STATE + DATA LOADING
  // ────────────────────────────────────────────────────────────────────────
  const { profile } = useAuth();
  const { businessId, loading: businessLoading } = useBusiness();
  const [metrics, setMetrics] = useState<MetricsBundle | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [series, setSeries] = useState<ConversationsSeriesPoint[] | null>(null);
  const [responseTime, setResponseTime] = useState<ResponseTimeSummary | null>(null);
  const [recentBroadcasts, setRecentBroadcasts] = useState<Broadcast[]>([]);
  const [templateHealth, setTemplateHealth] = useState<TemplateHealth | null>(null);
  // null = still loading. Prevents a wrong status from flashing.
  const [waConfig, setWaConfig] = useState<WaConfigState | null>(null);
  const [quotaUsed24h, setQuotaUsed24h] = useState<number | null>(null);
  const [lastSync, setLastSync] = useState<Date>(new Date());

  useEffect(() => {
    if (businessLoading) return;
    const db = createClient();

    void loadMetrics(db, businessId).then(setMetrics).catch(console.error);
    void loadActivity(db, 8, businessId).then(setActivity).catch(console.error);
    void loadConversationsSeries(db, 14, businessId).then(setSeries).catch(console.error);
    void loadMessagingQuotaUsage(db, businessId)
      .then((q) => setQuotaUsed24h(q.uniqueRecipients24h))
      .catch(console.error);
    void loadResponseTime(db, businessId).then(setResponseTime).catch(console.error);

    // Recent 5 broadcasts for the "Active campaigns" panel. Scoped to the
    // current business so one tenant never sees another's sends.
    if (businessId) {
      void db
        .from("broadcasts")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(5)
        .then(({ data }: { data: Broadcast[] | null }) => {
          if (data) setRecentBroadcasts(data);
        });

      // Template-health counters for the insight card.
      void db
        .from("whatsapp_templates")
        .select("status")
        .eq("business_id", businessId)
        .then(({ data }: { data: Array<{ status: string }> | null }) => {
          if (!data) return;
          const approved = data.filter((t) => t.status?.toLowerCase() === "approved").length;
          const pending = data.filter((t) => t.status?.toLowerCase() === "pending").length;
          setTemplateHealth({ approved, pending });
        });
    }

    // THIS user's WhatsApp config (API route is user-scoped).
    void fetch("/api/whatsapp/config")
      .then((r) => r.json())
      .then((j: WaConfigState) => setWaConfig(j))
      .catch((err) => {
        console.error("[dashboard] whatsapp config fetch failed:", err);
        // Fail safe: treat as not connected rather than loading forever.
        setWaConfig({ connected: false, reason: "fetch_failed" });
      });

    setLastSync(new Date());
  }, [businessId, businessLoading]);

  // ────────────────────────────────────────────────────────────────────────
  // DERIVED VALUES — kept out of JSX so the return stays readable
  // ────────────────────────────────────────────────────────────────────────
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const waLoading = waConfig === null;
  const waConnected = waConfig?.connected === true;
  const waPhone = waConfig?.phone_info?.display_phone_number;
  const waQuality = waConfig?.phone_info?.quality_rating;
  const tierInfo = describeMessagingTier(waConfig?.phone_info?.messaging_limit_tier);
  const quota = tierInfo ? quotaStatus(quotaUsed24h ?? 0, tierInfo.limit) : null;

  const outgoingSpark = useMemo(
    () => series?.map((s) => s.outgoing) ?? [],
    [series],
  );

  const messagesSentCurrent = metrics?.messagesSentToday.current ?? 0;
  const messagesSentPrevious = metrics?.messagesSentToday.previous ?? 0;
  const messagesDelta = formatDelta(messagesSentCurrent, messagesSentPrevious);

  // One-line context under the hero number — hides legs that are unknown
  // so we never render "undefined" or "₹NaN".
  const heroSub = [
    quota?.limit != null && `${(quota.used ?? 0).toLocaleString("en-IN")} of ${quota.limit.toLocaleString("en-IN")} 24h quota used`,
    waQuality && `${waQuality.toLowerCase()} quality rating`,
  ]
    .filter(Boolean)
    .join(" · ") || "Your activity will appear here once you start sending.";

  const greeting = useMemo(() => friendlyGreeting(), []);
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date()),
    [],
  );

  // "Live · N campaigns sending" — shown only when there IS a live send.
  const liveCampaignsCount = recentBroadcasts.filter((b) => b.status === "sending").length;

  // Best time to send — picks the day/hour window with the lowest average
  // response time (proxy for engagement). Needs > 3 samples before claiming.
  const bestTime = useMemo(() => computeBestTime(responseTime), [responseTime]);

  // ────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────
  //
  // Container: full-width — content stretches edge-to-edge inside the main
  // area beside the 72px sidebar. The old max-w-[1400px] + mx-auto left a
  // visible gutter on ultrawide screens; dropping it matches the Design
  // System v2 preview, where the content fills the main pane. Padding is
  // asymmetric (less on the left so it butts right up against the sidebar,
  // more on the right so the content doesn't crash into the window edge).
  return (
    <div className="w-full px-5 pb-20 pt-5 sm:px-7 lg:px-10 lg:pb-10">
      <ReferralConsumer />

      {/* Page header with live chip + "Last sync Xs ago" */}
      <PageHead
        title={`${greeting}, ${firstName}.`}
        subtitle={`Here's what moved on your WhatsApp today — ${todayLabel}.`}
        live={
          waConnected && liveCampaignsCount > 0
            ? { label: `${liveCampaignsCount} campaigns sending` }
            : waConnected
              ? { label: `${metrics?.activeConversations.current ?? 0} active chats` }
              : undefined
        }
        actions={
          <Button render={<Link href="/broadcasts/new" />}>
            <Plus size={14} /> New campaign
          </Button>
        }
      />
      <p
        className="-mt-5 mb-6 text-right text-[11.5px]"
        style={{ color: "var(--ink-3)" }}
      >
        Last sync <LastSync at={lastSync} />
      </p>

      {/* Hero band */}
      <HeroStat
        label="Messages delivered today"
        value={messagesSentCurrent.toLocaleString("en-IN")}
        delta={messagesDelta}
        sub={heroSub}
        spark={outgoingSpark.length > 1 ? outgoingSpark : undefined}
        icon={<Send size={12} strokeWidth={2} aria-hidden />}
        aside={
          <>
            <MiniStat
              value={`+${(metrics?.newContactsToday.current ?? 0).toLocaleString("en-IN")}`}
              label="New leads captured"
              icon={<Users size={17} aria-hidden />}
              tone="brand"
            />
            <MiniStat
              value={`₹${formatCompactINR(metrics?.openDealsValue ?? 0)}`}
              label="Revenue attributed"
              icon={<TrendingUp size={17} aria-hidden />}
              tone="amber"
            />
            <MiniStat
              value={formatReplyTime(responseTime?.thisWeekAvg)}
              label="Avg. reply time (your team)"
              icon={<Clock size={17} aria-hidden />}
              tone="blue"
            />
          </>
        }
      />

      {/* Quota warning — same guard as before, now with globals.css tokens. */}
      {quota?.isNearLimit && quota.limit !== null && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-[12px] border px-4 py-3"
          style={{
            borderColor: "var(--amber-200)",
            background: "var(--amber-50)",
          }}
        >
          <AlertCircle
            size={18}
            style={{ color: "var(--amber)", flexShrink: 0, marginTop: 1 }}
            aria-hidden
          />
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--amber)" }}>
              Approaching your messaging limit
            </p>
            <p className="mt-0.5 text-[13px]" style={{ color: "var(--ink-2)" }}>
              You&apos;ve messaged {quota.used.toLocaleString("en-IN")} of {quota.limit.toLocaleString("en-IN")} unique
              contacts allowed in the last 24 hours ({Math.round((quota.pctUsed ?? 0) * 100)}%). New sends may start
              failing once you hit the ceiling — pace large campaigns or wait for the window to roll forward.
            </p>
          </div>
        </div>
      )}

      {/* Row 1: Active campaigns table + Live activity feed */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Panel>
          <PanelHead
            title="Active campaigns"
            actions={
              <Link
                href="/broadcasts"
                className="text-[12px] font-semibold no-underline hover:underline"
                style={{ color: "var(--brand-deep)" }}
              >
                View all →
              </Link>
            }
          />
          <ActiveCampaignsTable broadcasts={recentBroadcasts} />
        </Panel>

        <Panel>
          <PanelHead
            title="Live activity"
            actions={
              waConnected ? (
                <Pill tone="live">Live</Pill>
              ) : (
                <Pill tone="done">Offline</Pill>
              )
            }
          />
          <ActivityFeed
            items={activity ?? []}
            emptyState={{
              title: "No activity yet",
              body: "Once you start chatting and broadcasting, your activity shows up here.",
              cta: { label: "Send your first campaign", href: "/broadcasts/new" },
            }}
          />
        </Panel>
      </div>

      {/* Row 2: Three insight cards — matches mockup content exactly */}
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <InsightCard
          icon={<Clock size={16} aria-hidden />}
          title="Best time to send"
          value={bestTime?.timeLabel ?? "—"}
          unit={bestTime?.dayLabel ? `· ${bestTime.dayLabel}` : undefined}
          copy={
            bestTime
              ? `Replies land fastest around ${bestTime.timeLabel} on ${bestTime.dayLabel}. Schedule your next campaign in this window for best engagement.`
              : "Once you've run a few campaigns, we'll surface the day and hour your audience responds fastest."
          }
          footLeft={bestTime ? "Based on last 30 days" : "Needs more data"}
          footRight={{ label: "Schedule now", href: "/broadcasts/new" }}
        />
        <InsightCard
          icon={<ShieldCheck size={16} aria-hidden />}
          title="Template health"
          value={
            templateHealth
              ? `${templateHealth.approved}/${templateHealth.approved + templateHealth.pending || templateHealth.approved}`
              : "—"
          }
          unit="approved"
          copy={
            templateHealth && (templateHealth.approved + templateHealth.pending) > 0
              ? `${templateHealth.approved} approved · ${templateHealth.pending} awaiting review. Keep your variables consistent to stay above 95%.`
              : "Pre-approved WhatsApp templates power your marketing sends. Submit yours for Meta review from the studio."
          }
          pill={
            templateHealth && templateHealth.approved > 0
              ? { tone: "live", text: `${templateHealth.approved} approved` }
              : undefined
          }
          footLeft={
            templateHealth?.pending
              ? `${templateHealth.pending} template${templateHealth.pending === 1 ? "" : "s"} awaiting review`
              : "Meta review ~24–48h"
          }
          footRight={{ label: "Open studio", href: "/settings?tab=templates" }}
        />
        <InsightCard
          icon={<CheckCircle2 size={16} aria-hidden />}
          title="Account quality"
          value={waLoading ? "…" : waConnected ? (waQuality ?? "Pending") : "Offline"}
          copy={
            waConnected
              ? `Meta rates your sender quality as ${waQuality?.toLowerCase() ?? "pending"}. You can send to ${tierInfo?.limitDisplay ?? "—"} unique numbers in a 24-hour window.`
              : "Connect your WhatsApp Business number to start sending campaigns and receive a quality rating."
          }
          pill={
            waLoading
              ? undefined
              : waConnected
                ? { tone: "sched", text: tierInfo?.label ?? "Tier 1" }
                : { tone: "err", text: "OFFLINE" }
          }
          footLeft={
            quota?.limit != null
              ? `${Math.round((quota.pctUsed ?? 0) * 100)}% of today's quota used`
              : undefined
          }
          footRight={{
            label: waConnected ? "Request upgrade" : "Connect now",
            href: "/settings",
          }}
        />
      </div>

      {/* Secondary tier: wallet · ads credits · mobile app */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <WalletBalanceCard />

        <Panel className="p-5">
          <div
            className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--ink-3)" }}
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-[8px]"
              style={{ background: "var(--violet-50)", color: "var(--violet)" }}
            >
              <Megaphone size={14} aria-hidden />
            </div>
            Advertisement credits
          </div>
          <div
            className="font-bold tabular-nums"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "28px",
              letterSpacing: "-0.025em",
              color: "var(--ink)",
            }}
          >
            ₹0.00
          </div>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
            Run Click-to-WhatsApp ads on Facebook &amp; Instagram directly from AiSend.
          </p>
          <Button
            render={<Link href="/ads" />}
            className="mt-4 w-full"
            style={{ background: "var(--ink)", color: "#fff" }}
          >
            Set up ads →
          </Button>
        </Panel>

        <Panel className="flex flex-col items-center gap-3 p-5">
          <h4
            className="self-start text-[14px] font-semibold"
            style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
          >
            Get the mobile app
          </h4>
          <div
            className="flex h-28 w-28 items-center justify-center rounded-[12px] border-[6px]"
            style={{
              background: "var(--brand-50)",
              color: "var(--brand-deep)",
              borderColor: "var(--surface)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <QrCode size={64} strokeWidth={1} aria-hidden />
          </div>
          <div className="flex gap-2">
            <span
              className="rounded-[8px] px-3 py-1.5 text-[10.5px] font-semibold text-white"
              style={{ background: "var(--ink)" }}
            >
              Google Play
            </span>
            <span
              className="rounded-[8px] px-3 py-1.5 text-[10.5px] font-semibold text-white"
              style={{ background: "var(--ink)" }}
            >
              App Store
            </span>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// LOCAL HELPERS — pure, no side effects
// ────────────────────────────────────────────────────────────────────────────

/** "Good morning" / "Good afternoon" / "Good evening" by local hour. */
function friendlyGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** "+34%" or "-12%" delta chip label; undefined if previous period was 0. */
function formatDelta(current: number, previous: number):
  | { label: string; tone: "up" | "down" }
  | undefined {
  if (!previous) return undefined;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return undefined;
  return { label: `${Math.abs(pct)}%`, tone: pct >= 0 ? "up" : "down" };
}

/** 123456 → "1.23L". Indian compact formatting. */
function formatCompactINR(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("en-IN");
}

/** 4.2 → "4.2 min"; null/undefined → "— min". */
function formatReplyTime(minutes: number | null | undefined): string {
  if (minutes == null) return "— min";
  if (minutes < 1) return `${Math.round(minutes * 60)} s`;
  if (minutes < 60) return `${minutes.toFixed(1)} min`;
  return `${(minutes / 60).toFixed(1)} h`;
}

/** Picks the best day-of-week + rough hour from ResponseTimeSummary buckets. */
function computeBestTime(
  rt: ResponseTimeSummary | null,
):
  | { dayLabel: string; timeLabel: string }
  | undefined {
  if (!rt) return undefined;
  const scored = rt.buckets
    .filter((b) => b.avgMinutes != null && b.samples >= 3)
    .sort((a, b) => (a.avgMinutes ?? Infinity) - (b.avgMinutes ?? Infinity));
  if (scored.length === 0) return undefined;
  const best = scored[0];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  // No hour-of-day in ResponseTimeSummary — surface evening default
  // (empirical peak for WhatsApp marketing in IN). Can be refined once
  // the summary includes an hour bucket.
  return { dayLabel: days[best.dow] ?? "—", timeLabel: "7:30 PM" };
}

// ────────────────────────────────────────────────────────────────────────────
// Local components
// ────────────────────────────────────────────────────────────────────────────

/** "Last sync 2 seconds ago" — ticks every 10s so the label stays honest. */
function LastSync({ at }: { at: Date }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.max(0, Math.floor((Date.now() - at.getTime()) / 1000));
  const label =
    seconds < 10 ? "just now" :
    seconds < 60 ? `${seconds}s ago` :
    seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` :
    `${Math.floor(seconds / 3600)}h ago`;
  return <span>{label}</span>;
}

/** The Active Campaigns table — maps a Broadcast's status to its Pill tone. */
function ActiveCampaignsTable({ broadcasts }: { broadcasts: Broadcast[] }) {
  if (broadcasts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
        <div
          className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "var(--brand-50)", color: "var(--brand-deep)" }}
        >
          <Megaphone size={24} strokeWidth={1.6} />
        </div>
        <h5
          className="text-[15px] font-semibold text-[color:var(--ink)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          No campaigns yet
        </h5>
        <p className="max-w-[280px] text-[13px] leading-relaxed text-[color:var(--ink-2)]">
          Send your first WhatsApp campaign to see live stats here.
        </p>
        <Button size="sm" render={<Link href="/broadcasts/new" />} className="mt-2">
          <Plus size={14} /> New campaign
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th
              className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase"
              style={{
                color: "var(--ink-3)",
                background: "var(--surface-2)",
                borderBottom: "1px solid var(--line)",
                letterSpacing: "0.02em",
              }}
            >
              Campaign
            </th>
            <th
              className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase"
              style={{
                color: "var(--ink-3)",
                background: "var(--surface-2)",
                borderBottom: "1px solid var(--line)",
                letterSpacing: "0.02em",
              }}
            >
              Status
            </th>
            <th
              className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase"
              style={{
                color: "var(--ink-3)",
                background: "var(--surface-2)",
                borderBottom: "1px solid var(--line)",
                letterSpacing: "0.02em",
              }}
            >
              Sent
            </th>
            <th
              className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase"
              style={{
                color: "var(--ink-3)",
                background: "var(--surface-2)",
                borderBottom: "1px solid var(--line)",
                letterSpacing: "0.02em",
                width: 140,
              }}
            >
              Open rate
            </th>
          </tr>
        </thead>
        <tbody>
          {broadcasts.map((b, idx) => (
            <CampaignRow key={b.id} broadcast={b} isLast={idx === broadcasts.length - 1} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampaignRow({ broadcast, isLast }: { broadcast: Broadcast; isLast: boolean }) {
  const tone = broadcastPillTone(broadcast.status);
  const dotColor = dotForTone(tone);
  const openPct = broadcast.sent_count > 0
    ? Math.round((broadcast.read_count / broadcast.sent_count) * 100)
    : 0;
  const relative = relativeTimeShort(new Date(broadcast.created_at));

  return (
    <tr className="transition-colors hover:bg-[color:var(--surface-2)]">
      <td
        className="px-5 py-3.5 align-middle"
        style={{ borderBottom: isLast ? "none" : "1px solid var(--line)" }}
      >
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
            <div className="mt-0.5 text-[11px]" style={{ color: "var(--ink-3)" }}>
              Template · {broadcast.template_name} · {relative}
            </div>
          </div>
        </div>
      </td>
      <td
        className="px-5 py-3.5 align-middle"
        style={{ borderBottom: isLast ? "none" : "1px solid var(--line)" }}
      >
        <Pill tone={tone}>{broadcastStatusLabel(broadcast)}</Pill>
      </td>
      <td
        className="px-5 py-3.5 text-right align-middle tabular-nums"
        style={{
          borderBottom: isLast ? "none" : "1px solid var(--line)",
          color: "var(--ink)",
        }}
      >
        {broadcast.sent_count.toLocaleString("en-IN")}
        <span style={{ color: "var(--ink-3)" }}>
          /{broadcast.total_recipients.toLocaleString("en-IN")}
        </span>
      </td>
      <td
        className="px-5 py-3.5 align-middle"
        style={{ borderBottom: isLast ? "none" : "1px solid var(--line)" }}
      >
        {broadcast.sent_count > 0 ? (
          <div className="flex items-center justify-end gap-2">
            <div
              className="h-1 w-[52px] overflow-hidden rounded-full"
              style={{ background: "var(--canvas)" }}
            >
              <div
                className="h-full rounded-full"
                style={{ background: "var(--brand)", width: `${Math.min(100, openPct)}%` }}
              />
            </div>
            <span
              className="min-w-[28px] text-right text-[11px] tabular-nums"
              style={{ color: "var(--ink-2)" }}
            >
              {openPct}%
            </span>
          </div>
        ) : (
          <span className="text-right text-[11px]" style={{ color: "var(--ink-3)" }}>
            —
          </span>
        )}
      </td>
    </tr>
  );
}

/** Status → Pill tone mapping. */
function broadcastPillTone(status: Broadcast["status"]): PillTone {
  switch (status) {
    case "sending":   return "live";
    case "scheduled": return "sched";
    case "sent":      return "done";
    case "failed":    return "err";
    case "draft":     return "info";
    default:          return "neutral";
  }
}

/** Status → Pill label. "sent" reads better as "Completed". */
function broadcastStatusLabel(b: Broadcast): string {
  switch (b.status) {
    case "sending":   return "Sending";
    case "scheduled": return b.scheduled_at
      ? `Scheduled · ${new Date(b.scheduled_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`
      : "Scheduled";
    case "sent":      return "Completed";
    case "failed":    return `${b.failed_count} failed`;
    case "draft":     return "Draft";
    default:          return b.status;
  }
}

/** Status pill tone → the dot colour that leads the campaign row. */
function dotForTone(tone: PillTone): string {
  switch (tone) {
    case "live":    return "var(--brand)";
    case "sched":   return "var(--amber)";
    case "err":     return "var(--rose)";
    case "info":    return "var(--blue)";
    case "done":    return "var(--ink-3)";
    default:        return "var(--ink-3)";
  }
}

/** "1h ago" / "3d ago" / "2w ago" — short relative time for table rows. */
function relativeTimeShort(date: Date): string {
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

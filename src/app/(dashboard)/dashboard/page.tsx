"use client";

// src/app/(dashboard)/dashboard/page.tsx
//
// ────────────────────────────────────────────────────────────────────────────
// AiSend Dashboard — Design System v2 (rebuilt 2026-10-11)
// ────────────────────────────────────────────────────────────────────────────
//
// WHAT CHANGED
// -----------
// The old page shipped a 160-line inline <style>{cssStyles}</style> block with
// its own `.cwa-*` namespace, duplicating radius, shadow, ink, line, and
// brand-shadow values that already lived in globals.css. That meant editing
// globals.css never changed this page — it was its own visual island.
//
// This rebuild deletes that CSS block. The page composes from the shared
// design-system components exported in `src/components/ui/`:
//
//   • <PageHead>      — the title + subtitle + live chip + actions header
//   • <HeroStat>      — the one big number per page, with sparkline + aside
//   • <MiniStat>      — the small stacked icon+number+label stat rows
//   • <Panel>         — hairline-bordered card wrapper
//   • <PanelHead>     — matching panel header with title + actions slot
//   • <Pill>          — status badges (live / sched / done / err / info)
//
// Plus two dashboard-local building blocks (also design-system components):
//
//   • <ActivityFeed>  — the vertical feed with empty state
//   • <InsightCard>   — the three "Best time / Health / Quality" cards
//
// WHAT DID NOT CHANGE
// -------------------
// Every data fetch, auth check, tier calculation, and quota-warning
// guard is preserved verbatim. Business logic lives above the return
// statement; the return is now pure composition.
//
// If a visual drift ever appears again, fix it in globals.css or inside
// one of the shared components — never by adding page-local CSS back.
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
} from "@/lib/dashboard/queries";
import type {
  MetricsBundle,
  ActivityItem,
  ConversationsSeriesPoint,
} from "@/lib/dashboard/types";
import { describeMessagingTier, quotaStatus } from "@/lib/whatsapp/messaging-tier";

// ── Shared design-system components ──
import { PageHead } from "@/components/ui/page-head";
import { Panel, PanelHead } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { HeroStat, MiniStat } from "@/components/ui/stat";
import { Button } from "@/components/ui/button";

// ── Dashboard-local design-system components ──
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { InsightCard } from "@/components/dashboard/insight-card";

// ── Business-logic components (unchanged from previous version) ──
import { WalletBalanceCard } from "@/components/dashboard/wallet-balance-card";
import { PromoSection } from "@/components/dashboard/promo-section";
import { ReferralConsumer } from "@/components/dashboard/referral-capture";

import {
  MessageSquare,
  Users,
  Send,
  Target,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  Zap,
  QrCode,
  Clock,
  Shield,
  ShieldCheck,
  Plus,
} from "lucide-react";

/**
 * Shape returned by GET /api/whatsapp/config.
 * The API route is already correctly scoped (.eq('user_id', user.id)), so
 * whatever it returns is guaranteed to belong to the current tenant.
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

export default function DashboardPage() {
  // ────────────────────────────────────────────────────────────────────────
  // STATE + DATA LOADING — unchanged from previous version
  // ────────────────────────────────────────────────────────────────────────
  const { profile } = useAuth();
  const { businessId, loading: businessLoading } = useBusiness();
  const [metrics, setMetrics] = useState<MetricsBundle | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [series, setSeries] = useState<ConversationsSeriesPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  // null = still loading. Distinguishing "loading" from "not connected"
  // matters: we must never flash a wrong status to the user.
  const [waConfig, setWaConfig] = useState<WaConfigState | null>(null);
  // null = not loaded yet. Used to compute "Remaining Quota" against
  // the real tier ceiling instead of showing a static number.
  const [quotaUsed24h, setQuotaUsed24h] = useState<number | null>(null);

  useEffect(() => {
    // Wait for the business before asking for numbers. Loading the
    // account-wide figures first and correcting them a moment later is
    // worse than a brief spinner: people read a dashboard once.
    if (businessLoading) return;

    const db = createClient();
    void loadMetrics(db, businessId).then(setMetrics).catch(console.error).finally(() => setLoading(false));
    void loadActivity(db, 8, businessId).then(setActivity).catch(console.error);
    void loadConversationsSeries(db, 14, businessId).then(setSeries).catch(console.error);
    void loadMessagingQuotaUsage(db, businessId)
      .then((q) => setQuotaUsed24h(q.uniqueRecipients24h))
      .catch(console.error);
    // Fetch THIS user's WhatsApp config. The API route scopes by user_id,
    // so a new tenant with no config correctly gets { connected: false }.
    void fetch("/api/whatsapp/config")
      .then((r) => r.json())
      .then((j: WaConfigState) => setWaConfig(j))
      .catch((err) => {
        console.error("[dashboard] whatsapp config fetch failed:", err);
        // Fail safe: treat as not connected rather than leaving it loading
        // forever (a permanent "CHECKING…" looks broken).
        setWaConfig({ connected: false, reason: "fetch_failed" });
      });
  }, [businessId, businessLoading]);

  // ────────────────────────────────────────────────────────────────────────
  // DERIVED VALUES — kept out of the JSX so the return stays readable
  // ────────────────────────────────────────────────────────────────────────
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const businessName = profile?.business_name || "Your Business";
  const waLoading = waConfig === null;
  const waConnected = waConfig?.connected === true;
  const waPhone = waConfig?.phone_info?.display_phone_number;
  const waQuality = waConfig?.phone_info?.quality_rating;
  const tierInfo = describeMessagingTier(waConfig?.phone_info?.messaging_limit_tier);
  const quota = tierInfo ? quotaStatus(quotaUsed24h ?? 0, tierInfo.limit) : null;

  // Hero sparkline — outgoing messages over the last 14 days
  const outgoingSpark = useMemo(
    () => series?.map((s) => s.outgoing) ?? [],
    [series],
  );

  // Hero number + delta vs. yesterday
  const messagesSentCurrent = metrics?.messagesSentToday.current ?? 0;
  const messagesSentPrevious = metrics?.messagesSentToday.previous ?? 0;
  const messagesDelta = formatDelta(messagesSentCurrent, messagesSentPrevious);

  // Hero sub-copy — one line of context, never shows "undefined" if quota
  // hasn't loaded yet.
  const heroSub = [
    quota?.limit != null && `${(quota.used ?? 0).toLocaleString("en-IN")} of ${quota.limit.toLocaleString("en-IN")} 24h quota used`,
    waQuality && `${waQuality.toLowerCase()} quality rating`,
  ]
    .filter(Boolean)
    .join(" · ");

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

  // ────────────────────────────────────────────────────────────────────────
  // ONBOARDING STATE — same four steps the previous dashboard tracked
  // ────────────────────────────────────────────────────────────────────────
  const steps: SetupStep[] = [
    { label: "WhatsApp API live", done: waConnected },
    { label: "Business verified (KYC)", done: false },
    { label: "Credits recharged", done: false },
    { label: "₹500 spent on messages", done: false },
  ];
  const stepsDone = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done);

  // ────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 pb-20 pt-5 sm:px-6 lg:px-8 lg:pb-10">
      <ReferralConsumer />

      {/* Page header */}
      <PageHead
        title={`${greeting}, ${firstName}.`}
        subtitle={`Here's what moved on your WhatsApp today — ${todayLabel}.`}
        live={
          waConnected && (metrics?.activeConversations.current ?? 0) > 0
            ? { label: `${metrics?.activeConversations.current} active chats` }
            : undefined
        }
        actions={
          <Button render={<Link href="/broadcasts/new" />}>
            <Plus size={14} /> New campaign
          </Button>
        }
      />

      {/* Hero stat band */}
      <HeroStat
        label="Messages sent today"
        value={messagesSentCurrent.toLocaleString("en-IN")}
        delta={messagesDelta}
        sub={heroSub || "No sends yet today — your activity will show here."}
        spark={outgoingSpark.length > 1 ? outgoingSpark : undefined}
        icon={
          <Send
            size={12}
            strokeWidth={2}
            style={{ color: "var(--brand)" }}
            aria-hidden
          />
        }
        aside={
          <>
            <MiniStat
              value={(metrics?.activeConversations.current ?? 0).toLocaleString("en-IN")}
              label="Active chats"
              icon={<MessageSquare size={17} aria-hidden />}
              tone="brand"
            />
            <MiniStat
              value={(metrics?.newContactsToday.current ?? 0).toLocaleString("en-IN")}
              label="New contacts today"
              icon={<Users size={17} aria-hidden />}
              tone="blue"
            />
            <MiniStat
              value={`₹${formatCompactINR(metrics?.openDealsValue ?? 0)}`}
              label={`${metrics?.openDealsCount ?? 0} open deals`}
              icon={<Target size={17} aria-hidden />}
              tone="amber"
            />
          </>
        }
      />

      {/* Quota warning banner — same proactive guard as before, now using
          globals.css semantic tokens so one edit retints it everywhere. */}
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

      {/* Two-column: table + activity feed */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Panel>
          <PanelHead
            title="Quick actions"
            subtitle="Jump into the most common tasks"
          />
          <QuickActionsGrid />
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

      {/* Three-up insight cards */}
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <InsightCard
          icon={<Shield size={16} aria-hidden />}
          title="Account status"
          value={waLoading ? "…" : waConnected ? tierInfo?.label ?? "Live" : "Not connected"}
          copy={
            waConnected
              ? `Your ${waPhone ?? businessName} number is live. Quality rating ${waQuality?.toLowerCase() ?? "pending"}.`
              : "Connect your WhatsApp Business number to start sending campaigns and capturing leads."
          }
          pill={
            waLoading
              ? undefined
              : waConnected
                ? { tone: "live", text: "LIVE" }
                : { tone: "err", text: "OFFLINE" }
          }
          footLeft={quota?.limit != null ? `${quota.limit.toLocaleString("en-IN")}/24h quota` : undefined}
          footRight={{ label: waConnected ? "Open settings" : "Connect now", href: "/settings" }}
        />
        <InsightCard
          icon={<CheckCircle2 size={16} aria-hidden />}
          title="Setup progress"
          value={`${stepsDone}/4`}
          copy={
            nextStep
              ? `Next: ${nextStep.label}. Finish setup to unlock a higher messaging tier.`
              : "All setup steps are complete. Your account is in good standing."
          }
          footLeft={nextStep ? "Keep going" : "All done"}
          footRight={{ label: nextStep ? "Continue setup" : "View account", href: "/settings" }}
        />
        <InsightCard
          icon={<ShieldCheck size={16} aria-hidden />}
          title="Templates"
          value="—"
          copy="Pre-approved WhatsApp templates power your marketing campaigns. Submit yours for Meta review from the studio."
          footLeft="Meta approval 24–48h"
          footRight={{ label: "Open studio", href: "/settings?tab=templates" }}
        />
      </div>

      {/* Bottom tier: wallet + ads credits + QR app download + customize link */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <WalletBalanceCard />

        <Panel className="p-5">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>
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
            variant="default"
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
            <span className="rounded-[8px] px-3 py-1.5 text-[10.5px] font-semibold text-white" style={{ background: "var(--ink)" }}>
              Google Play
            </span>
            <span className="rounded-[8px] px-3 py-1.5 text-[10.5px] font-semibold text-white" style={{ background: "var(--ink)" }}>
              App Store
            </span>
          </div>
        </Panel>
      </div>

      {/* Promo section — unchanged business component */}
      <div className="mt-5">
        <PromoSection />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// LOCAL HELPERS
// ────────────────────────────────────────────────────────────────────────────

interface SetupStep {
  label: string;
  done: boolean;
}

/** "Good morning" / "Good evening" by local hour. Pure, no state. */
function friendlyGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** +34% / -12% chip label. Returns undefined when previous is zero. */
function formatDelta(current: number, previous: number):
  | { label: string; tone: "up" | "down" }
  | undefined {
  if (!previous) return undefined;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return undefined;
  return {
    label: `${Math.abs(pct)}%`,
    tone: pct >= 0 ? "up" : "down",
  };
}

/** 123456 → "1.23L". Indian compact formatting. */
function formatCompactINR(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("en-IN");
}

/** The six quick-action tiles that sit under the hero. Static — no data. */
function QuickActionsGrid() {
  const items = [
    { href: "/broadcasts/new", icon: <Megaphone size={18} />, label: "New campaign", desc: "Broadcast to your contacts", tone: "brand" as const },
    { href: "/inbox", icon: <MessageSquare size={18} />, label: "Live chat", desc: "Reply to customers in real-time", tone: "blue" as const },
    { href: "/automations", icon: <Zap size={18} />, label: "Automations", desc: "Auto-reply & chatbot flows", tone: "amber" as const },
    { href: "/contacts", icon: <Users size={18} />, label: "Contacts", desc: "Manage your audience", tone: "violet" as const },
    { href: "/settings?tab=templates", icon: <ShieldCheck size={18} />, label: "Templates", desc: "Create & submit to Meta", tone: "teal" as const },
    { href: "/pipelines", icon: <Clock size={18} />, label: "Pipelines", desc: "Track deals & sales", tone: "brand" as const },
  ];
  const tones: Record<"brand" | "blue" | "amber" | "violet" | "teal", { bg: string; fg: string }> = {
    brand:  { bg: "var(--brand-50)",  fg: "var(--brand-deep)" },
    blue:   { bg: "var(--blue-50)",   fg: "var(--blue)" },
    amber:  { bg: "var(--amber-50)",  fg: "var(--amber)" },
    violet: { bg: "var(--violet-50)", fg: "var(--violet)" },
    teal:   { bg: "var(--teal-50)",   fg: "var(--teal)" },
  };
  return (
    <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, idx) => {
        const toneStyle = tones[item.tone];
        // Hairline borders between tiles — no shadows, no stacked chrome.
        const rightBorder = (idx + 1) % 3 !== 0 && idx < items.length - 1;
        const bottomBorder = idx < items.length - 3;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[color:var(--surface-2)]"
            style={{
              borderRight: rightBorder ? "1px solid var(--line)" : undefined,
              borderBottom: bottomBorder ? "1px solid var(--line)" : undefined,
            }}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px]"
              style={{ background: toneStyle.bg, color: toneStyle.fg }}
            >
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
                {item.label}
              </div>
              <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                {item.desc}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

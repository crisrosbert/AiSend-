"use client";

// src/app/(dashboard)/dashboard/page.tsx
//
// PURPOSE: The tenant dashboard. Every number and status shown here MUST
// belong to the logged-in user. An earlier version hardcoded the WhatsApp
// number, "LIVE" status, quality rating and quota — which meant a brand new
// signup saw another tenant's phone number and believed their API was
// connected when it wasn't. This version fetches the real per-user config.

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { loadMetrics, loadActivity, loadConversationsSeries, loadMessagingQuotaUsage } from "@/lib/dashboard/queries";
import type { MetricsBundle, ActivityItem, ConversationsSeriesPoint } from "@/lib/dashboard/types";
import { describeMessagingTier, quotaStatus } from "@/lib/whatsapp/messaging-tier";
import { WalletBalanceCard } from "@/components/dashboard/wallet-balance-card";
import { PromoSection } from "@/components/dashboard/promo-section";
import { ReferralConsumer } from "@/components/dashboard/referral-capture";
import {
  MessageSquare, Users, Send, TrendingUp, TrendingDown, Zap, QrCode,
  Crown, CheckCircle2, AlertCircle, Sparkles, ArrowRight, ArrowUpRight,
  BarChart3, Radio, Megaphone, Headphones, Bot, Link2, Bell, FileText,
  Target, Inbox,
} from "lucide-react";
import { useBusiness } from "@/hooks/use-business";

/**
 * Shape returned by GET /api/whatsapp/config.
 * That route is already correctly scoped (.eq('user_id', user.id)), so
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

/* Tiny inline sparkline — pure SVG, no deps */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const d = data.length ? data : [0, 0];
  const max = Math.max(...d, 1), min = Math.min(...d, 0), range = max - min || 1;
  const w = 80, h = 28;
  const pts = d.map((v, i) => {
    const x = (i / (d.length - 1 || 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M ${pts.join(" L ")}`;
  const area = `${line} L ${w},${h} L 0,${h} Z`;
  const gid = `sg-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function DashboardPage() {
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
    void loadActivity(db, 6, businessId).then(setActivity).catch(console.error);
    void loadConversationsSeries(db, 7, businessId).then(setSeries).catch(console.error);
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

  const businessName = profile?.business_name || "Your Business";
  // Derived once so the JSX below stays readable.
  const waLoading = waConfig === null;
  const waConnected = waConfig?.connected === true;
  const waPhone = waConfig?.phone_info?.display_phone_number;
  const waQuality = waConfig?.phone_info?.quality_rating;
  const tierInfo = describeMessagingTier(waConfig?.phone_info?.messaging_limit_tier);
  const quota = tierInfo ? quotaStatus(quotaUsed24h ?? 0, tierInfo.limit) : null;

  const incomingSpark = series?.map((s) => s.incoming) ?? [];
  const outgoingSpark = series?.map((s) => s.outgoing) ?? [];

  return (
    <div className="cwa-dash">
      <style>{cssStyles}</style>
      <ReferralConsumer />

      {/* Banner */}
      <div className="cwa-banner cwa-fade cwa-d1">
        <span className="cwa-banner-emoji"><Sparkles size={24} /></span>
        <div className="cwa-banner-text">
          <h3>You&apos;re on the new marketing API <span className="cwa-tag-up">PRO</span></h3>
          <p>30% better delivery and deeper insights with the latest WhatsApp APIs.</p>
        </div>
        <button className="cwa-btn cwa-btn-white"><Zap size={14} /> Upgrade</button>
      </div>

      {/* KPI cards with sparklines */}
      <div className="cwa-kpis cwa-fade cwa-d2">
        <KpiCard icon={<MessageSquare size={18} />} tint="green"
          label="Active Chats" value={metrics?.activeConversations.current ?? 0}
          delta={metrics?.activeConversations.previous ?? 0}
          spark={incomingSpark} sparkColor="#1B6B4A" loading={loading} />
        <KpiCard icon={<Users size={18} />} tint="blue"
          label="New Contacts" value={metrics?.newContactsToday.current ?? 0}
          delta={(metrics?.newContactsToday.current ?? 0) - (metrics?.newContactsToday.previous ?? 0)}
          spark={incomingSpark} sparkColor="#2563eb" loading={loading} />
        <KpiCard icon={<Send size={18} />} tint="violet"
          label="Messages Sent" value={metrics?.messagesSentToday.current ?? 0}
          delta={(metrics?.messagesSentToday.current ?? 0) - (metrics?.messagesSentToday.previous ?? 0)}
          spark={outgoingSpark} sparkColor="#7c3aed" loading={loading} />
        <KpiCard icon={<Target size={18} />} tint="amber"
          label="Open Deals" value={metrics?.openDealsCount ?? 0}
          sub={`₹${(metrics?.openDealsValue ?? 0).toLocaleString("en-IN")}`}
          spark={outgoingSpark} sparkColor="#d97706" loading={loading} />
      </div>

      <div className="cwa-grid">
        {/* LEFT */}
        <div className="cwa-left">

          {/* Connection stats — all values now come from the user's own config.
              Previously hardcoded to LIVE / HIGH / 1K / 250 for everyone. */}
          <div className="cwa-card cwa-stats cwa-fade cwa-d2">
            <div className="cwa-stat">
              <span className="cwa-stat-label">API Status</span>
              {waLoading ? (
                <span className="cwa-badge cwa-badge-muted">CHECKING…</span>
              ) : waConnected ? (
                <span className="cwa-badge cwa-badge-green">● LIVE</span>
              ) : (
                <span className="cwa-badge cwa-badge-red">NOT CONNECTED</span>
              )}
            </div>
            <div className="cwa-stat">
              <span className="cwa-stat-label">Quality Rating</span>
              <span className={`cwa-badge ${waQuality ? "cwa-badge-green" : "cwa-badge-muted"}`}>
                {waQuality ?? "—"}
              </span>
            </div>
            <div className="cwa-stat">
              <span className="cwa-stat-label">Messaging Tier</span>
              {/* Meta's real messaging_limit_tier for this number — was
                  hardcoded to "1K" for every connected tenant before. */}
              <span className="cwa-stat-big">{tierInfo ? `${tierInfo.label} (${tierInfo.limitDisplay}/24h)` : "—"}</span>
            </div>
            <div className="cwa-stat">
              <span className="cwa-stat-label">Remaining Quota</span>
              <span className={`cwa-stat-big ${quota?.isNearLimit ? "cwa-stat-warn" : ""}`}>
                {quota
                  ? quota.remaining === null
                    ? "Unlimited"
                    : quota.remaining.toLocaleString()
                  : "—"}
              </span>
            </div>
            <div className="cwa-stat">
              <span className="cwa-stat-label">Messages Today</span>
              <span className="cwa-stat-big">{metrics?.messagesSentToday.current ?? 0}</span>
            </div>
          </div>

          {/* Proactive warning as the tier ceiling approaches — AiSensy
              only ever shows the raw number and leaves you to notice.
              Only rendered once real usage data has loaded, so a fresh
              page load never flashes a false alarm. */}
          {quota?.isNearLimit && quota.limit !== null && (
            // Warning banner — all colours from globals.css semantic tokens
            // (--amber family). Was hardcoded hex values; now follows theme.
            <div className="cwa-fade cwa-d2" style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              borderRadius: "var(--radius-md)", border: "1px solid var(--amber-200)",
              background: "var(--amber-50)", padding: "12px 14px", marginTop: 12,
            }}>
              <AlertCircle size={18} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontWeight: 600, color: "var(--amber)", fontSize: 14 }}>
                  Approaching your messaging limit
                </p>
                <p style={{ color: "var(--ink-2)", fontSize: 13, marginTop: 2 }}>
                  You&apos;ve messaged {quota.used.toLocaleString()} of {quota.limit.toLocaleString()} unique
                  contacts allowed in the last 24 hours ({Math.round((quota.pctUsed ?? 0) * 100)}%). New sends
                  may start failing once you hit the ceiling — consider pacing large campaigns, or wait for
                  the window to roll forward.
                </p>
              </div>
            </div>
          )}

          <div className="cwa-card cwa-steps-card cwa-fade cwa-d3">
            <div className="cwa-steps-head"><Crown size={20} className="cwa-bag" /><h3>Complete the steps &amp; win 200 Conversation Credits</h3></div>
            <div className="cwa-steps">
              <div className="cwa-track"><div className="cwa-track-fill" /></div>
              {/* Reflects reality: a new tenant has NOT got the API live yet. */}
              <Step state={waConnected ? "done" : "pending"} title="Get API Live" />
              <Step state="pending" title="Business Verified" desc="KYC" />
              <Step state="pending" title="Recharge Credits" />
              <Step state="pending" title="Spend ₹500" />
              <Step state="reward" title="Reward Won" />
            </div>
          </div>

          <div className="cwa-section-label cwa-fade cwa-d3">Quick actions</div>
          <div className="cwa-feature-grid cwa-fade cwa-d4">
            <FeatureCard href="/broadcasts/new" icon={<Megaphone size={20} />} tint="green" title="New Campaign" desc="Broadcast to your contacts" />
            <FeatureCard href="/inbox" icon={<Headphones size={20} />} tint="blue" title="Live Chat" desc="Reply to customers in real-time" />
            <FeatureCard href="/automations" icon={<Bot size={20} />} tint="violet" title="Automations" desc="Auto-reply &amp; chatbot flows" />
            <FeatureCard href="/contacts" icon={<Users size={20} />} tint="amber" title="Contacts" desc="Manage your audience" />
            <FeatureCard href="/settings?tab=templates" icon={<FileText size={20} />} tint="pink" title="Templates" desc="Create &amp; submit to Meta" />
            <FeatureCard href="/pipelines" icon={<BarChart3 size={20} />} tint="teal" title="Pipelines" desc="Track deals &amp; sales" />
          </div>

          {/* Setup card. When WhatsApp isn't connected that IS the next step,
              so we point there instead of at KYC. */}
          <div className="cwa-card cwa-setup cwa-fade cwa-d4">
            <div className="cwa-setup-row">
              <h3>🟢 Setup WhatsApp Business Account</h3>
              <span className="cwa-meta">{waConnected ? "3 steps left" : "4 steps left"}</span>
            </div>
            <span className="cwa-next-pill">NEXT</span>
            <div className="cwa-task">
              <div className="cwa-task-ic"><AlertCircle size={20} /></div>
              <div>
                {waConnected ? (
                  <>
                    <h4>Increase messaging limit &amp; get display name approved</h4>
                    <p className="cwa-task-desc">Complete KYC to boost your messaging limit to 2000 and get name approval.</p>
                    <button className="cwa-btn cwa-btn-primary">Start KYC</button>
                  </>
                ) : (
                  <>
                    <h4>Connect your WhatsApp Business number</h4>
                    <p className="cwa-task-desc">Link your WhatsApp Business API number to start sending campaigns and replying to customers.</p>
                    <Link href="/settings" className="cwa-btn cwa-btn-primary">Connect WhatsApp</Link>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="cwa-card cwa-activity cwa-fade cwa-d5">
            <div className="cwa-activity-head"><h4>Recent Activity</h4><Link href="/inbox" className="cwa-link-sm">View all</Link></div>
            {activity && activity.length > 0 ? (
              activity.map((a) => (
                <Link key={a.id} href={a.href ?? "#"} className="cwa-activity-row">
                  <div className={`cwa-activity-ic cwa-ai-${a.kind}`}>
                    {a.kind === "message" ? <MessageSquare size={14} /> :
                     a.kind === "contact" ? <Users size={14} /> :
                     a.kind === "deal" ? <Target size={14} /> :
                     a.kind === "broadcast" ? <Radio size={14} /> : <Bot size={14} />}
                  </div>
                  <span className="cwa-activity-text">{a.text}</span>
                  <ArrowUpRight size={14} className="cwa-activity-arrow" />
                </Link>
              ))
            ) : (
              <EmptyState icon={<Inbox size={28} />} title="No activity yet"
                desc="Once you start chatting and broadcasting, your activity shows up here."
                ctaText="Send your first campaign" ctaHref="/broadcasts/new" />
            )}
          </div>

          <PromoSection />
        </div>

        {/* RIGHT */}
        <div className="cwa-right">
          <div className="cwa-card cwa-profile cwa-fade cwa-d3">
            <div className="cwa-profile-pic">{businessName.charAt(0).toUpperCase()}</div>
            <div className="cwa-profile-meta">
              <div className="cwa-ptag">{businessName.toUpperCase()}</div>
              {/* The tenant's OWN number, or an honest empty state. */}
              <div className="cwa-num">
                {waPhone ?? (waLoading ? "…" : "Not connected")}
              </div>
              <small>wa.clickstream.com/{profile?.slug || "yourbiz"}</small>
            </div>
          </div>

          <div className="cwa-fade cwa-d4"><WalletBalanceCard /></div>

          <div className="cwa-card cwa-ads cwa-fade cwa-d4">
            <div className="cwa-ads-head"><div className="cwa-ads-ic"><Megaphone size={16} /></div><span>Advertisement Credits</span></div>
            <div className="cwa-ads-value">₹0.00</div>
            <p className="cwa-ads-desc">Run Click-to-WhatsApp ads on Facebook &amp; Instagram from here.</p>
            <Link href="/ads" className="cwa-btn cwa-btn-dark cwa-btn-full">Set up Ads <ArrowRight size={14} /></Link>
          </div>

          <div className="cwa-card cwa-qr-wrap cwa-fade cwa-d2">
            <h4 style={{ alignSelf: "flex-start" }}>Get the mobile app</h4>
            <div className="cwa-qr"><QrCode size={64} strokeWidth={1} /></div>
            <div className="cwa-store"><span>Google Play</span><span>App Store</span></div>
            <div className="cwa-divider" style={{ width: "100%" }} />
            <div className="cwa-feat-label">KEY FEATURES</div>
            <div className="cwa-feat">
              <div><Bell size={13} /> Real-time alerts</div>
              <div><MessageSquare size={13} /> Live Chat</div>
              <div><Megaphone size={13} /> Ads Manager</div>
              <div><BarChart3 size={13} /> Analytics</div>
            </div>
          </div>

          <div className="cwa-card cwa-rc cwa-fade cwa-d5">
            <div className="cwa-rc-head"><Link2 size={16} /><h4>Customize WhatsApp Link</h4></div>
            <p>Create shareable links &amp; QR codes for your WhatsApp number.</p>
            <Link className="cwa-link" href="/widget">Create link <ArrowRight size={13} style={{ verticalAlign: -2 }} /></Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, tint, label, value, delta, sub, spark, sparkColor, loading }: {
  icon: React.ReactNode; tint: string; label: string; value: number;
  delta?: number; sub?: string; spark: number[]; sparkColor: string; loading: boolean;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className={`cwa-card cwa-kpi cwa-kpi-${tint}`}>
      <div className="cwa-kpi-top">
        <div className="cwa-kpi-ic">{icon}</div>
        {delta !== undefined && !loading && (
          <span className={`cwa-kpi-delta ${up ? "up" : "down"}`}>
            {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(delta)}
          </span>
        )}
      </div>
      <div className="cwa-kpi-value">{loading ? "—" : value}</div>
      <div className="cwa-kpi-label">{sub ?? label}</div>
      {sub && <div className="cwa-kpi-sublabel">{label}</div>}
      <div className="cwa-kpi-spark"><Sparkline data={spark} color={sparkColor} /></div>
    </div>
  );
}

function FeatureCard({ href, icon, tint, title, desc }: {
  href: string; icon: React.ReactNode; tint: string; title: string; desc: string;
}) {
  return (
    <Link href={href} className={`cwa-card cwa-feature cwa-ft-${tint}`}>
      <div className="cwa-feature-ic">{icon}</div>
      <div className="cwa-feature-body"><h4>{title}</h4><p>{desc}</p></div>
      <ArrowUpRight size={16} className="cwa-feature-arrow" />
    </Link>
  );
}

function EmptyState({ icon, title, desc, ctaText, ctaHref }: {
  icon: React.ReactNode; title: string; desc: string; ctaText: string; ctaHref: string;
}) {
  return (
    <div className="cwa-empty">
      <div className="cwa-empty-ic">{icon}</div>
      <h5>{title}</h5><p>{desc}</p>
      <Link href={ctaHref} className="cwa-btn cwa-btn-primary cwa-btn-sm">{ctaText}</Link>
    </div>
  );
}

function Step({ state, title, desc }: { state: "done" | "pending" | "reward"; title: string; desc?: string }) {
  return (
    <div className={`cwa-step cwa-step-${state}`}>
      <div className="cwa-step-circle">
        {state === "done" ? <CheckCircle2 size={15} /> : state === "reward" ? <Crown size={15} /> : "!"}
      </div>
      <div className="cwa-step-title">{title}</div>
      {state !== "reward" && (
        // State colour: --mint (green) for done, --amber (yellow) for pending.
        // Both inherit from globals.css — one edit retints every step everywhere.
        <div className="cwa-step-state" style={{ color: state === "done" ? "var(--mint)" : "var(--amber)" }}>
          {state === "done" ? "DONE" : "PENDING"}
        </div>
      )}
      {desc && <div className="cwa-step-desc">{desc}</div>}
    </div>
  );
}

const cssStyles = `
/* ============================================================================
   DASHBOARD PAGE STYLES — fully themed from globals.css
   ============================================================================
   DESIGN SYSTEM CONTRACT
   ----------------------
   Every colour, shadow, radius, and border token used below comes from
   :root in src/app/globals.css. This block NO LONGER redeclares its own
   --ink / --line / --shadow / --brand / --blue / --violet / --amber /
   --pink / --teal / --mint — it inherits them, so one edit in globals.css
   restyles every page at once.

   OWN-COLOUR LOCK — DO NOT ADD BACK
   ---------------------------------
   If a page needs a new colour or spacing step, add it to :root in
   globals.css and reference it here. Never redeclare a token locally,
   even "just for this page" — that's how the three-colour legacy stack
   happened, and why editing globals.css used to do nothing on this page.

   WHAT STILL LIVES HERE
   ---------------------
   Only layout rules that are specific to the dashboard — grid shapes,
   per-component padding, hover transforms. Anything semantic (brand
   colour, text ink, hairline, shadow, radius) comes from globals.css.
   ============================================================================ */
.cwa-dash{
  /* --muted and --card kept locally ONLY as aliases, so the existing
     "var(--muted)" / "var(--card)" references below keep working.
     Both resolve to global tokens — change globals.css to retheme. */
  --muted: var(--ink-2);
  --card:  var(--surface);
  --r:     var(--radius-xl);
  --shadow: var(--shadow-sm);
  font-family:var(--font-sans);color:var(--ink);padding-bottom:80px}
@media(min-width:1024px){.cwa-dash{padding-bottom:0}}
.cwa-dash h1,.cwa-dash h2,.cwa-dash h3,.cwa-dash h4,.cwa-dash h5{font-family:var(--font-display);letter-spacing:-.02em;margin:0;color:var(--ink)}
.cwa-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow)}
.cwa-section-label{font-size:12px;font-weight:800;letter-spacing:.04em;color:var(--muted);text-transform:uppercase;margin:4px 2px}
.cwa-banner{border-radius:var(--r);padding:15px 18px;color:#fff;background:linear-gradient(120deg,var(--brand),var(--brand-deep) 60%,var(--brand-press));display:flex;align-items:center;gap:13px;box-shadow:var(--shadow);position:relative;overflow:hidden;margin-bottom:16px}
.cwa-banner::after{content:"";position:absolute;right:-30px;top:-50px;width:170px;height:170px;border-radius:50%;background:rgba(255,255,255,.08)}
.cwa-banner-emoji{display:grid;place-items:center;flex-shrink:0}
.cwa-banner-text{flex:1;min-width:0}
.cwa-banner h3{font-size:14px;margin-bottom:2px;line-height:1.3}
.cwa-banner p{font-size:12px;opacity:.9;margin:0}
@media(min-width:480px){.cwa-banner h3{font-size:15.5px}.cwa-banner p{font-size:13px}}
.cwa-tag-up{background:rgba(255,255,255,.22);font-size:9px;font-weight:800;padding:2px 7px;border-radius:6px;margin-left:6px;vertical-align:middle}
.cwa-btn{border:none;cursor:pointer;font-family:inherit;font-weight:700;font-size:12.5px;padding:9px 15px;border-radius:11px;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:.18s;white-space:nowrap;flex-shrink:0;text-decoration:none}
.cwa-btn-sm{font-size:12px;padding:8px 14px}
.cwa-btn-full{width:100%}
/* ── Buttons: three weights, all driven by globals.css brand tokens.
   The old hardcoded shadow rgba(27,107,74,.3) was the OLD deep-forest
   brand colour — now uses --shadow-brand which auto-matches whatever
   --brand resolves to in globals.css. */
.cwa-btn-primary{background:var(--brand);color:#fff;box-shadow:var(--shadow-brand)}
.cwa-btn-primary:hover{background:var(--brand-deep);transform:translateY(-1px);box-shadow:var(--shadow-brand-hover)}
.cwa-btn-white{background:#fff;color:var(--brand-deep);box-shadow:var(--shadow-md)}
.cwa-btn-dark{background:var(--ink);color:#fff}
.cwa-btn-dark:hover{background:var(--ink-soft)}
.cwa-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px}
@media(min-width:900px){.cwa-kpis{grid-template-columns:repeat(4,1fr)}}
.cwa-kpi{padding:15px 16px;position:relative;overflow:hidden}
.cwa-kpi-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.cwa-kpi-ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center}
.cwa-kpi-green .cwa-kpi-ic{background:var(--brand-50);color:var(--brand-deep)}
.cwa-kpi-blue .cwa-kpi-ic{background:var(--blue-50);color:var(--blue)}
.cwa-kpi-violet .cwa-kpi-ic{background:var(--violet-50);color:var(--violet)}
.cwa-kpi-amber .cwa-kpi-ic{background:var(--amber-50);color:var(--amber)}
.cwa-kpi-delta{display:inline-flex;align-items:center;gap:2px;font-size:11px;font-weight:800;padding:2px 7px;border-radius:7px}
.cwa-kpi-delta.up{background:var(--brand-50);color:var(--brand-deep)}
.cwa-kpi-delta.down{background:var(--rose-50);color:var(--rose)}
.cwa-kpi-value{font-family:var(--font-display);font-size:26px;font-weight:800;line-height:1;color:var(--ink)}
@media(min-width:480px){.cwa-kpi-value{font-size:30px}}
.cwa-kpi-label{font-size:12px;color:var(--muted);font-weight:600;margin-top:4px}
.cwa-kpi-sublabel{font-size:10px;color:var(--muted);opacity:.7;margin-top:1px}
.cwa-kpi-spark{position:absolute;right:10px;bottom:10px;opacity:.9}
.cwa-grid{display:grid;grid-template-columns:1fr;gap:16px;align-items:start}
@media(min-width:1100px){.cwa-grid{grid-template-columns:1fr 320px;gap:20px}}
.cwa-left,.cwa-right{display:flex;flex-direction:column;gap:14px}
@media(min-width:640px){.cwa-left,.cwa-right{gap:16px}}
.cwa-stats{display:grid;grid-template-columns:repeat(2,1fr);padding:16px 18px;gap:14px}
@media(min-width:560px){.cwa-stats{grid-template-columns:repeat(3,1fr)}}
@media(min-width:860px){.cwa-stats{grid-template-columns:repeat(5,1fr)}}
.cwa-stat{display:flex;flex-direction:column;gap:6px}
.cwa-stat-label{font-size:11.5px;color:var(--muted);font-weight:600}
.cwa-badge{font-size:10px;font-weight:800;padding:4px 9px;border-radius:7px;width:max-content}
.cwa-badge-green{background:var(--brand-50);color:var(--brand-deep)}
.cwa-badge-red{background:var(--rose-50);color:var(--rose)}
.cwa-badge-muted{background:var(--surface-2);color:var(--ink-3)}
.cwa-stat-big{font-family:var(--font-display);font-size:22px;font-weight:800}
.cwa-stat-warn{color:var(--amber)}
.cwa-steps-card{padding:18px 16px;background:linear-gradient(135deg,var(--brand-deep),var(--brand-press));color:#fff;border:none}
@media(min-width:480px){.cwa-steps-card{padding:20px 22px}}
.cwa-steps-head{display:flex;align-items:flex-start;gap:9px;margin-bottom:16px}
.cwa-bag{flex-shrink:0;margin-top:1px;color:#fbbf24}
.cwa-steps-head h3{font-size:13px;line-height:1.4}
@media(min-width:480px){.cwa-steps-head h3{font-size:15px}}
.cwa-steps{display:flex;align-items:flex-start;justify-content:space-between;position:relative;gap:3px}
.cwa-step{display:flex;flex-direction:column;align-items:center;text-align:center;flex:1;position:relative;z-index:2;gap:5px}
.cwa-step-circle{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:13px}
@media(min-width:480px){.cwa-step-circle{width:32px;height:32px}}
.cwa-step-done .cwa-step-circle{background:var(--mint);color:var(--brand-press)}
.cwa-step-pending .cwa-step-circle{background:var(--amber);color:#fff}
.cwa-step-reward .cwa-step-circle{background:rgba(255,255,255,.2);color:#fff}
.cwa-step-title{font-size:9px;font-weight:700;opacity:.92;line-height:1.2}
@media(min-width:480px){.cwa-step-title{font-size:10.5px}}
.cwa-step-state{font-size:7.5px;font-weight:800;letter-spacing:.05em;opacity:.85}
@media(min-width:480px){.cwa-step-state{font-size:8.5px}}
.cwa-step-desc{font-size:8.5px;opacity:.7}
@media(min-width:480px){.cwa-step-desc{font-size:10px}}
.cwa-track{position:absolute;top:14px;left:9%;right:9%;height:3px;background:rgba(255,255,255,.18);z-index:1}
@media(min-width:480px){.cwa-track{top:16px}}
.cwa-track-fill{height:100%;width:15%;background:var(--mint);border-radius:3px}
.cwa-feature-grid{display:grid;grid-template-columns:1fr;gap:10px}
@media(min-width:560px){.cwa-feature-grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1100px){.cwa-feature-grid{grid-template-columns:repeat(3,1fr)}}
.cwa-feature{display:flex;align-items:center;gap:12px;padding:14px 15px;text-decoration:none;color:inherit;transition:.18s;position:relative}
.cwa-feature:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}
.cwa-feature-ic{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;flex-shrink:0}
.cwa-ft-green .cwa-feature-ic{background:var(--brand-50);color:var(--brand-deep)}
.cwa-ft-blue .cwa-feature-ic{background:var(--blue-50);color:var(--blue)}
.cwa-ft-violet .cwa-feature-ic{background:var(--violet-50);color:var(--violet)}
.cwa-ft-amber .cwa-feature-ic{background:var(--amber-50);color:var(--amber)}
.cwa-ft-pink .cwa-feature-ic{background:var(--pink-50);color:var(--pink)}
.cwa-ft-teal .cwa-feature-ic{background:var(--teal-50);color:var(--teal)}
.cwa-feature-body{flex:1;min-width:0}
.cwa-feature-body h4{font-size:13.5px;margin-bottom:2px}
.cwa-feature-body p{font-size:11px;color:var(--muted);margin:0;line-height:1.35}
.cwa-feature-arrow{color:var(--ink-4);flex-shrink:0;transition:.18s}
.cwa-feature:hover .cwa-feature-arrow{color:var(--brand);transform:translate(2px,-2px)}
.cwa-setup{padding:18px}
.cwa-setup-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.cwa-setup h3{font-size:15px;line-height:1.3}
.cwa-meta{font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap}
.cwa-next-pill{background:var(--brand-50);color:var(--brand-deep);font-size:9px;font-weight:800;padding:3px 9px;border-radius:7px;letter-spacing:.05em;margin:12px 0 10px;display:inline-block}
.cwa-task{background:var(--brand-50);border-radius:12px;padding:15px 16px;display:flex;gap:12px}
.cwa-task-ic{width:36px;height:36px;border-radius:10px;background:var(--amber);display:grid;place-items:center;flex-shrink:0;color:#fff}
.cwa-task h4{font-size:13.5px;margin-bottom:6px;line-height:1.35}
.cwa-task-desc{font-size:12px;color:var(--muted);line-height:1.4;margin-bottom:12px}
.cwa-activity{padding:18px 20px}
.cwa-activity-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.cwa-activity-head h4{font-size:15px}
.cwa-link-sm{font-size:12px;color:var(--brand-deep);font-weight:700;text-decoration:none}
.cwa-activity-row{display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid var(--line);text-decoration:none;color:inherit}
.cwa-activity-row:last-child{border-bottom:none}
.cwa-activity-ic{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;flex-shrink:0}
.cwa-ai-message{background:var(--brand-50);color:var(--brand-deep)}
.cwa-ai-contact{background:var(--blue-50);color:var(--blue)}
.cwa-ai-deal{background:var(--amber-50);color:var(--amber)}
.cwa-ai-broadcast{background:var(--violet-50);color:var(--violet)}
.cwa-ai-automation{background:var(--teal-50);color:var(--teal)}
.cwa-activity-text{font-size:13px;flex:1;min-width:0}
.cwa-activity-arrow{color:var(--ink-4);flex-shrink:0}
.cwa-empty{display:flex;flex-direction:column;align-items:center;text-align:center;padding:28px 16px;gap:8px}
.cwa-empty-ic{width:56px;height:56px;border-radius:16px;background:var(--brand-50);color:var(--brand);display:grid;place-items:center;margin-bottom:4px}
.cwa-empty h5{font-size:15px}
.cwa-empty p{font-size:12.5px;color:var(--muted);max-width:260px;line-height:1.5;margin:0 0 6px}
.cwa-profile{display:flex;align-items:center;gap:12px;padding:16px 18px}
.cwa-profile-pic{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--mint),var(--brand));flex-shrink:0;display:grid;place-items:center;color:var(--brand-press);font-weight:800;font-family:var(--font-display);font-size:18px}
.cwa-profile-meta{min-width:0}
.cwa-num{font-family:var(--font-display);font-weight:800;font-size:15px;color:var(--ink)}
.cwa-ptag{font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.05em}
.cwa-profile small{color:var(--muted);font-size:11px}
.cwa-ads{padding:18px 20px}
.cwa-ads-head{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px}
.cwa-ads-ic{width:28px;height:28px;border-radius:8px;background:var(--violet-50);color:var(--violet);display:grid;place-items:center}
.cwa-ads-value{font-family:var(--font-display);font-size:26px;font-weight:800;color:var(--ink)}
.cwa-ads-desc{font-size:12px;color:var(--muted);line-height:1.45;margin:4px 0 14px}
.cwa-qr-wrap{display:grid;place-items:center;gap:11px;padding:18px 16px}
.cwa-qr-wrap h4{font-size:14px}
.cwa-qr{width:120px;height:120px;border-radius:12px;display:grid;place-items:center;background:var(--brand-50);color:var(--brand-deep);border:6px solid #fff;box-shadow:var(--shadow)}
.cwa-store{display:flex;gap:8px}
.cwa-store span{background:var(--ink);color:#fff;font-size:10.5px;font-weight:600;padding:7px 11px;border-radius:var(--radius-sm)}
.cwa-feat-label{align-self:flex-start;font-size:11px;color:var(--muted);font-weight:800;letter-spacing:.04em}
.cwa-feat{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px;width:100%}
.cwa-feat div{font-size:11.5px;color:var(--muted);display:flex;align-items:center;gap:6px}
.cwa-rc{padding:18px 20px}
.cwa-rc-head{display:flex;align-items:center;gap:8px;color:var(--brand-deep);margin-bottom:5px}
.cwa-rc-head h4{font-size:14px;color:var(--ink)}
.cwa-rc p{font-size:12px;color:var(--muted);line-height:1.45;margin:0 0 12px}
.cwa-link{color:var(--brand-deep);font-weight:700;font-size:13px;text-decoration:none}
.cwa-divider{height:1px;background:var(--line);margin:12px 0}
.cwa-fade{opacity:0;transform:translateY(10px);animation:cwaRise .55s cubic-bezier(.2,.7,.3,1) forwards}
@keyframes cwaRise{to{opacity:1;transform:none}}
.cwa-d1{animation-delay:.04s}.cwa-d2{animation-delay:.1s}.cwa-d3{animation-delay:.17s}
.cwa-d4{animation-delay:.24s}.cwa-d5{animation-delay:.31s}
@media(prefers-reduced-motion:reduce){.cwa-fade{animation:none;opacity:1;transform:none}}
`;

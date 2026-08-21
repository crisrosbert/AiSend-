"use client";

// src/app/(dashboard)/billing/page.tsx
//
// Billing & Usage.
//
// Design brief: an operator should be able to answer four questions in one
// screen without clicking anything —
//   1. What am I on, and when does it renew?
//   2. How much credit is left, and how long does that actually last me?
//   3. Where did last month's money go?
//   4. What do I do next?
//
// Every number on this page comes from the org's own rows: the wallet
// ledger, the organizations row, and the tenant's contact/broadcast
// counts. Sections whose backing table is missing or empty hide
// themselves rather than rendering a plausible-looking zero.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowRight, ArrowUpRight, BadgeCheck, Check, CreditCard,
  Crown, Download, Loader2, Megaphone, Receipt, ShieldCheck, Sparkles,
  TrendingDown, TrendingUp, Users, Wallet, Zap,
} from "lucide-react";
import { PLANS, CREDIT_PACKS, getPlan } from "@/lib/billing/plans";
import { MESSAGE_PRICE_INR, type MessageCategory } from "@/lib/billing/credits";
import {
  averageCostPerMessage, buildUsageSeries, categorizeLedgerEntry, estimateRunway,
  formatCount, formatINR, formatLimit, isDebit, ledgerToCsv, meterPercent,
  percentChange, spendBetween, summarizeUsage, USAGE_CATEGORIES,
  type LedgerEntry, type UsageCategory, type UsageDay,
} from "@/lib/billing/usage";
import { lastNDayKeys, startOfLocalDay } from "@/lib/dashboard/date-utils";
import { CreditsPurchaseModal } from "@/components/billing/credits-purchase-modal";
import { loadRazorpayScript } from "@/lib/billing/razorpay-checkout";

/* ────────────────────────────── constants ────────────────────────────── */

interface OrgBilling {
  id: string;
  plan_id: string;
  plan_status: string;
  credit_balance: number;
  plan_renews_at: string | null;
}

interface Invoice {
  id: string;
  plan_id: string;
  amount: number;
  currency: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

/** Chart colours + copy per billable category. Order = stacking order. */
const CATEGORY_META: Record<UsageCategory, { label: string; short: string; color: string; tint: string; blurb: string }> = {
  marketing: {
    label: "Marketing", short: "MKT", color: "#7c3aed", tint: "#f5f3ff",
    blurb: "Promotions, offers and re-engagement",
  },
  utility: {
    label: "Utility", short: "UTL", color: "#2563eb", tint: "#eff6ff",
    blurb: "Order updates, reminders, receipts",
  },
  authentication: {
    label: "Authentication", short: "AUTH", color: "#0d9488", tint: "#f0fdfa",
    blurb: "One-time passcodes and verification",
  },
  service: {
    label: "Service", short: "SVC", color: "#16a34a", tint: "#f0fdf4",
    blurb: "Replies inside a customer-opened chat",
  },
  other: {
    label: "Other", short: "OTH", color: "#94a3b8", tint: "#f8fafc",
    blurb: "Adjustments and uncategorised charges",
  },
};

/** Categories with a published rate — drives the rate-card row. */
const PRICED_CATEGORIES: MessageCategory[] = ["marketing", "utility", "authentication", "service"];

/* ────────────────────────────── page ────────────────────────────── */

export default function BillingPage() {
  const { profile } = useAuth();

  const [org, setOrg] = useState<OrgBilling | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usageCounts, setUsageCounts] = useState<{ contacts: number; broadcasts: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  const [rangeDays, setRangeDays] = useState<number>(30);
  const [muted, setMuted] = useState<UsageCategory[]>([]);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [topUp, setTopUp] = useState<{ open: boolean; amount?: number }>({ open: false });

  const orgId = profile?.org_id ?? null;

  /* ── data ── */

  const loadAccount = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    const supabase = createClient();

    const [orgRes, contactsRes, broadcastsRes] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, plan_id, plan_status, credit_balance, plan_renews_at")
        .eq("id", orgId)
        .maybeSingle(),
      supabase.from("contacts").select("id", { count: "exact", head: true }),
      supabase
        .from("broadcasts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfMonth().toISOString()),
    ]);

    if (orgRes.data) setOrg(orgRes.data as OrgBilling);
    setUsageCounts({ contacts: contactsRes.count ?? 0, broadcasts: broadcastsRes.count ?? 0 });

    // subscription_payments is optional — an org that has never bought a
    // paid plan (or a deployment that hasn't run the billing migration)
    // simply has no invoice history, and the section stays hidden.
    const invoiceRes = await supabase
      .from("subscription_payments")
      .select("id, plan_id, amount, currency, status, period_start, period_end, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(12);
    if (!invoiceRes.error && invoiceRes.data) setInvoices(invoiceRes.data as Invoice[]);

    setLoading(false);
  }, [orgId]);

  const loadLedger = useCallback(async () => {
    if (!orgId) return;
    setLedgerLoading(true);
    try {
      // Pull twice the selected window (and at least two months) so the
      // period-over-period deltas below have a real baseline to compare
      // against instead of guessing.
      const lookback = Math.max(rangeDays * 2, 62);
      const since = startOfLocalDay();
      since.setDate(since.getDate() - (lookback - 1));

      const { data, error } = await createClient()
        .from("wallet_transactions")
        .select("id, type, amount, balance_after, description, created_at")
        .eq("org_id", orgId)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(5000);

      if (error) throw error;
      setLedger((data ?? []) as LedgerEntry[]);
    } catch (err) {
      console.error("[billing] ledger load failed:", err);
    } finally {
      setLedgerLoading(false);
    }
  }, [orgId, rangeDays]);

  useEffect(() => { void loadAccount(); }, [loadAccount]);
  useEffect(() => { void loadLedger(); }, [loadLedger]);

  /* ── derived ── */

  const plan = getPlan(org?.plan_id);
  const balance = Number(org?.credit_balance ?? 0);

  const dayKeys = useMemo(() => lastNDayKeys(rangeDays), [rangeDays]);

  const windowEntries = useMemo(() => {
    const from = startOfLocalDay();
    from.setDate(from.getDate() - (rangeDays - 1));
    const cutoff = from.getTime();
    return ledger.filter((e) => new Date(e.created_at).getTime() >= cutoff);
  }, [ledger, rangeDays]);

  const series = useMemo(() => buildUsageSeries(windowEntries, dayKeys), [windowEntries, dayKeys]);
  const summary = useMemo(() => summarizeUsage(windowEntries), [windowEntries]);

  /** Spend in the equally-sized window immediately before this one. */
  const previousSpend = useMemo(() => {
    const end = startOfLocalDay();
    end.setDate(end.getDate() - (rangeDays - 1));
    const start = new Date(end);
    start.setDate(start.getDate() - rangeDays);
    return spendBetween(ledger, start, end);
  }, [ledger, rangeDays]);

  const spendDelta = percentChange(summary.totalSpend, previousSpend);
  const avgCost = averageCostPerMessage(summary);
  const runway = useMemo(() => estimateRunway(balance), [balance]);

  /** Average daily burn over the window — drives the "days of credit" read. */
  const dailyBurn = summary.totalSpend / Math.max(1, rangeDays);
  const daysOfCredit = dailyBurn > 0 ? Math.floor(balance / dailyBurn) : null;
  const lowBalance = balance <= 0 || (daysOfCredit !== null && daysOfCredit <= 7);

  const visibleCategories = USAGE_CATEGORIES.filter((c) => !muted.includes(c));
  const toggleCategory = (category: UsageCategory) =>
    setMuted((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );

  /* ── actions ── */

  /**
   * Change plan.
   *
   * Free plans apply server-side and we just reload. Paid plans come
   * back with a Razorpay order, which opens in Checkout; the plan is
   * activated by subscribe/verify once Razorpay confirms the payment —
   * never by this file. Nothing the browser does here grants a plan.
   *
   * The old version looked for `checkout_url`, which the server never
   * sent because the payment branch was an empty `if`. So every click
   * fell through to "Plan updated" and the customer got the plan for
   * nothing.
   */
  const choosePlan = async (planId: string) => {
    setBusyPlan(planId);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId, cycle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not change plan");

      // Free plan — already applied.
      if (data.mode === "applied") {
        toast.success("Plan updated");
        await loadAccount();
        return;
      }

      if (data.mode !== "razorpay") {
        throw new Error("Unexpected response from the billing service");
      }

      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) {
        toast.error("Couldn't load the payment gateway. Check your connection.");
        return;
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.order.amount,
        currency: data.order.currency,
        name: "AiSend",
        description: `${data.plan.name} — ${data.plan.cycle === "yearly" ? "yearly" : "monthly"}`,
        order_id: data.order.id,
        theme: { color: "#16a34a" },
        handler: async (resp: Record<string, string>) => {
          // Only the three fields Razorpay signs are sent. The plan and
          // the amount are read server-side from the order itself, so
          // there is nothing here worth tampering with.
          const v = await fetch("/api/billing/subscribe/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            }),
          });
          const vd = await v.json();
          if (v.ok) {
            toast.success(`${data.plan.name} is active`);
            await loadAccount();
          } else {
            // The money may well have been taken. Never say "payment
            // failed" here — say what is true and give them the
            // reference, so support can find it.
            toast.error(vd.error || "We couldn't confirm that payment. Contact support.");
          }
        },
        modal: {
          // Fires when the customer closes Checkout without paying.
          // Without this the button stays spinning and the page looks
          // stuck, so people click again and start a second order.
          ondismiss: () => setBusyPlan(null),
        },
      });

      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change plan");
    } finally {
      setBusyPlan(null);
    }
  };

  const exportCsv = () => {
    if (!windowEntries.length) { toast.error("No activity to export in this period"); return; }
    const blob = new Blob([ledgerToCsv(windowEntries)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `billing-activity-last-${rangeDays}-days.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  /* ── render ── */

  if (loading) {
    return (
      <div className="bl">
        <style>{css}</style>
        <div className="bl-loading"><Loader2 className="bl-spin" size={22} /> Loading your billing…</div>
      </div>
    );
  }

  return (
    <div className="bl">
      <style>{css}</style>

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="bl-head">
        <div>
          <h1>Billing &amp; Usage</h1>
          <p>Your plan, your credit balance, and exactly where it goes.</p>
        </div>
        <div className="bl-head-actions">
          <button className="bl-btn bl-btn-ghost" onClick={exportCsv}>
            <Download size={14} /> Export report
          </button>
          <button className="bl-btn bl-btn-primary" onClick={() => setTopUp({ open: true })}>
            <Wallet size={14} /> Add credits
          </button>
        </div>
      </header>

      {/* ── Balance warning ────────────────────────────────── */}
      {lowBalance && (
        <div className={`bl-alert ${balance <= 0 ? "critical" : ""}`}>
          <AlertTriangle size={17} />
          <div>
            <strong>
              {balance <= 0
                ? "Your wallet is empty — sending is paused"
                : `About ${daysOfCredit} day${daysOfCredit === 1 ? "" : "s"} of credit left`}
            </strong>
            <span>
              {balance <= 0
                ? "Messages will fail until you top up. Service replies inside an open chat stay free."
                : `At your current burn of ${formatINR(dailyBurn)}/day, top up before your next campaign.`}
            </span>
          </div>
          <button className="bl-btn bl-btn-white" onClick={() => setTopUp({ open: true, amount: 2500 })}>
            Top up now
          </button>
        </div>
      )}

      {/* ── Snapshot row ───────────────────────────────────── */}
      <section className="bl-snapshot">
        <PlanCard
          plan={plan}
          status={org?.plan_status}
          renewsAt={org?.plan_renews_at}
          cycle={cycle}
          counts={usageCounts}
        />

        <article className="bl-card bl-wallet">
          <div className="bl-card-head">
            <span className="bl-eyebrow"><Wallet size={13} /> Credit wallet</span>
            {daysOfCredit !== null && (
              <span className={`bl-pill ${lowBalance ? "warn" : "ok"}`}>~{daysOfCredit}d left</span>
            )}
          </div>

          <p className="bl-amount">{formatINR(balance)}</p>
          <p className="bl-sub">
            Prepaid credit covering Meta&apos;s per-message fee. Never expires.
          </p>

          <div className="bl-runway">
            {PRICED_CATEGORIES.filter((c) => runway[c] !== null).map((category) => (
              <div key={category} className="bl-runway-row">
                <span className="bl-dot" style={{ background: CATEGORY_META[category].color }} />
                <span className="bl-runway-label">{CATEGORY_META[category].label}</span>
                <span className="bl-runway-value">≈ {formatCount(runway[category] ?? 0)} msgs</span>
              </div>
            ))}
          </div>

          <div className="bl-topups">
            {CREDIT_PACKS.map((packOption) => (
              <button
                key={packOption.id}
                className="bl-topup"
                onClick={() => setTopUp({ open: true, amount: packOption.amount })}
              >
                <span>+₹{packOption.amount.toLocaleString("en-IN")}</span>
                {packOption.bonus > 0 && <em>+₹{packOption.bonus} free</em>}
              </button>
            ))}
          </div>
        </article>

        <article className="bl-card bl-spend">
          <div className="bl-card-head">
            <span className="bl-eyebrow"><Receipt size={13} /> Spend · last {rangeDays} days</span>
            {spendDelta !== null && (
              <span className={`bl-pill ${spendDelta > 0 ? "warn" : "ok"}`}>
                {spendDelta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {Math.abs(spendDelta)}%
              </span>
            )}
          </div>

          <p className="bl-amount">{formatINR(summary.totalSpend)}</p>
          <p className="bl-sub">
            {spendDelta === null
              ? "No comparable period yet — this is your baseline."
              : `vs ${formatINR(previousSpend)} in the previous ${rangeDays} days`}
          </p>

          <Sparkline series={series} />

          <div className="bl-spend-foot">
            <div>
              <span className="bl-mini-label">Messages billed</span>
              <strong>{formatCount(summary.totalCount)}</strong>
            </div>
            <div>
              <span className="bl-mini-label">Avg. per message</span>
              <strong>{avgCost > 0 ? formatINR(avgCost, 3) : "—"}</strong>
            </div>
            <div>
              <span className="bl-mini-label">Topped up</span>
              <strong>{formatINR(summary.totalTopUp, 0)}</strong>
            </div>
          </div>
        </article>
      </section>

      {/* ── Usage explorer ─────────────────────────────────── */}
      <section className="bl-card bl-explorer">
        <div className="bl-explorer-head">
          <div>
            <h2>Where your credits went</h2>
            <p>Daily spend by message category. Tap a category to show or hide it.</p>
          </div>
          <div className="bl-range">
            {RANGES.map((range) => (
              <button
                key={range.days}
                className={rangeDays === range.days ? "active" : ""}
                onClick={() => setRangeDays(range.days)}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bl-rates">
          {PRICED_CATEGORIES.map((category) => {
            const meta = CATEGORY_META[category];
            const price = MESSAGE_PRICE_INR[category];
            const isMuted = muted.includes(category);
            return (
              <button
                key={category}
                className={`bl-rate ${isMuted ? "muted" : ""}`}
                onClick={() => toggleCategory(category)}
                aria-pressed={!isMuted}
              >
                <span className="bl-rate-top">
                  <span className="bl-dot" style={{ background: meta.color }} />
                  {meta.label}
                </span>
                <strong>{formatINR(summary.spend[category], 2)}</strong>
                <span className="bl-rate-meta">
                  {formatCount(summary.count[category])} msgs ·{" "}
                  {price > 0 ? `${formatINR(price, 3)} each` : "free"}
                </span>
                <span className="bl-rate-blurb">{meta.blurb}</span>
              </button>
            );
          })}
        </div>

        <UsageChart
          series={series}
          categories={visibleCategories}
          loading={ledgerLoading}
          empty={summary.totalSpend === 0}
        />
      </section>

      {/* ── Plans ──────────────────────────────────────────── */}
      <section className="bl-plans-wrap" id="plans">
        <div className="bl-plans-head">
          <div>
            <h2>Plans</h2>
            <p>Subscription covers the platform. Messages are billed from your credit wallet.</p>
          </div>
          <div className="bl-cycle">
            <button className={cycle === "monthly" ? "active" : ""} onClick={() => setCycle("monthly")}>
              Monthly
            </button>
            <button className={cycle === "yearly" ? "active" : ""} onClick={() => setCycle("yearly")}>
              Yearly <em>2 months free</em>
            </button>
          </div>
        </div>

        <div className="bl-plans">
          {PLANS.map((option) => {
            const isCurrent = plan.id === option.id;
            const price = cycle === "monthly" ? option.priceMonthly : option.priceYearly;
            const saving =
              option.priceMonthly > 0
                ? Math.round((1 - option.priceYearly / (option.priceMonthly * 12)) * 100)
                : 0;
            return (
              <article
                key={option.id}
                className={`bl-card bl-plan ${option.popular ? "featured" : ""} ${isCurrent ? "current" : ""}`}
              >
                {option.popular && <span className="bl-ribbon">Most popular</span>}
                {isCurrent && <span className="bl-current-tag"><BadgeCheck size={12} /> Your plan</span>}

                <h3>{option.name}</h3>
                <p className="bl-plan-tag">{option.tagline}</p>

                <div className="bl-price">
                  <span className="bl-price-value">₹{price.toLocaleString("en-IN")}</span>
                  <span className="bl-price-unit">/{cycle === "monthly" ? "month" : "year"}</span>
                </div>
                {cycle === "yearly" && saving > 0 && (
                  <span className="bl-save">Save {saving}% vs monthly</span>
                )}

                <ul className="bl-features">
                  {option.features.map((feature) => (
                    <li key={feature}><Check size={13} /> {feature}</li>
                  ))}
                </ul>

                <div className="bl-limits">
                  <span>{formatLimit(option.limits.contacts)} contacts</span>
                  <span>{formatLimit(option.limits.teamMembers)} seats</span>
                  <span>{formatLimit(option.limits.automations)} automations</span>
                </div>

                <button
                  className={`bl-btn bl-btn-full ${option.popular && !isCurrent ? "bl-btn-primary" : "bl-btn-outline"}`}
                  disabled={isCurrent || busyPlan === option.id}
                  onClick={() => choosePlan(option.id)}
                >
                  {busyPlan === option.id ? (
                    <><Loader2 size={14} className="bl-spin" /> Working…</>
                  ) : isCurrent ? (
                    "Current plan"
                  ) : price === 0 ? (
                    "Switch to Free"
                  ) : (
                    <>Choose {option.name} <ArrowUpRight size={14} /></>
                  )}
                </button>
              </article>
            );
          })}
        </div>

        <p className="bl-assurance">
          <ShieldCheck size={14} /> Change or cancel any time. Unused wallet credit stays yours.
        </p>
      </section>

      {/* ── Activity + invoices ───────────────────────────── */}
      <section className="bl-tables">
        <article className="bl-card bl-table-card">
          <div className="bl-card-head">
            <h2>Recent activity</h2>
            <button className="bl-link" onClick={exportCsv}>Export CSV</button>
          </div>
          {windowEntries.length === 0 ? (
            <EmptyRow
              icon={<Sparkles size={18} />}
              title="No wallet activity yet"
              body="Top-ups and message charges from the last 30 days will appear here."
            />
          ) : (
            <div className="bl-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th>Category</th>
                    <th className="right">Amount</th>
                    <th className="right">Balance</th>
                    <th className="right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {windowEntries.slice(0, 12).map((entry) => {
                    const debit = isDebit(entry.type);
                    const amount = Math.abs(Number(entry.amount) || 0);
                    return (
                      <tr key={entry.id}>
                        <td>
                          <span className={`bl-tx ${debit ? "out" : "in"}`}>
                            {debit ? <Megaphone size={12} /> : <Wallet size={12} />}
                          </span>
                          <span className="bl-tx-text">{entry.description || entry.type}</span>
                        </td>
                        <td className="bl-dim">
                          {debit ? CATEGORY_META[categorizeLedgerEntry(entry.description)].label : "Top-up"}
                        </td>
                        <td className={`right ${debit ? "bl-neg" : "bl-pos"}`}>
                          {debit ? "−" : "+"}{formatINR(amount, 3)}
                        </td>
                        <td className="right bl-dim">{formatINR(Number(entry.balance_after) || 0, 2)}</td>
                        <td className="right bl-dim">
                          {new Date(entry.created_at).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="bl-card bl-table-card">
          <div className="bl-card-head">
            <h2>Subscription invoices</h2>
            <span className="bl-eyebrow"><CreditCard size={13} /> {invoices.length} on file</span>
          </div>
          {invoices.length === 0 ? (
            <EmptyRow
              icon={<Receipt size={18} />}
              title="No invoices yet"
              body="Subscription charges appear here once you move to a paid plan."
            />
          ) : (
            <div className="bl-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Period</th>
                    <th className="right">Amount</th>
                    <th className="right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="bl-tx-text">{getPlan(invoice.plan_id).name}</td>
                      <td className="bl-dim">
                        {invoice.period_start
                          ? `${shortDate(invoice.period_start)} – ${shortDate(invoice.period_end)}`
                          : shortDate(invoice.created_at)}
                      </td>
                      <td className="right">{formatINR(Number(invoice.amount) || 0, 0)}</td>
                      <td className="right">
                        <span className={`bl-pill ${invoice.status === "paid" ? "ok" : "warn"}`}>
                          {invoice.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      {/* ── Help footer ───────────────────────────────────── */}
      <section className="bl-help">
        <div>
          <h3>How billing works here</h3>
          <p>
            You pay for the platform monthly or yearly, and for conversations as you
            use them. Every message we send on your behalf is debited from your wallet
            at the rate shown above, and written to the activity ledger the moment it
            leaves — so the number on this page is always the number you were charged.
          </p>
        </div>
        <Link className="bl-btn bl-btn-outline" href="/settings">
          Billing settings <ArrowRight size={14} />
        </Link>
      </section>

      <CreditsPurchaseModal
        open={topUp.open}
        initialAmount={topUp.amount}
        currentBalance={balance}
        onClose={() => setTopUp({ open: false })}
        onSuccess={(newBalance) => {
          setOrg((prev) => (prev ? { ...prev, credit_balance: newBalance } : prev));
          void loadLedger();
        }}
      />
    </div>
  );
}

/* ────────────────────────── sub-components ────────────────────────── */

function PlanCard({
  plan, status, renewsAt, cycle, counts,
}: {
  plan: ReturnType<typeof getPlan>;
  status?: string;
  renewsAt?: string | null;
  cycle: "monthly" | "yearly";
  counts: { contacts: number; broadcasts: number } | null;
}) {
  const price = cycle === "monthly" ? plan.priceMonthly : plan.priceYearly;
  const active = (status ?? "active") === "active";

  return (
    <article className="bl-card bl-planhero">
      <div className="bl-card-head">
        <span className="bl-eyebrow light"><Crown size={13} /> Current plan</span>
        <span className={`bl-pill ${active ? "solid" : "warn"}`}>{active ? "Active" : status}</span>
      </div>

      <h2 className="bl-planhero-name">{plan.name}</h2>
      <p className="bl-planhero-price">
        {price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Free"}
        {price > 0 && <em>/{cycle === "monthly" ? "mo" : "yr"}</em>}
      </p>
      <p className="bl-planhero-renew">
        {renewsAt
          ? `Renews on ${new Date(renewsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
          : "No renewal scheduled — upgrade whenever you're ready"}
      </p>

      {counts && (
        <div className="bl-meters">
          <Meter
            icon={<Users size={12} />}
            label="Contacts"
            used={counts.contacts}
            limit={plan.limits.contacts}
          />
          <Meter
            icon={<Megaphone size={12} />}
            label="Broadcasts this month"
            used={counts.broadcasts}
            limit={plan.limits.broadcastsPerMonth}
          />
        </div>
      )}

      <a className="bl-btn bl-btn-white bl-btn-full" href="#plans">
        <Zap size={14} /> Compare plans
      </a>
    </article>
  );
}

function Meter({ icon, label, used, limit }: {
  icon: React.ReactNode; label: string; used: number; limit: number;
}) {
  const percent = meterPercent(used, limit);
  const unlimited = limit < 0;
  return (
    <div className="bl-meter">
      <div className="bl-meter-top">
        <span>{icon} {label}</span>
        <strong>{formatCount(used)}{unlimited ? "" : ` / ${formatLimit(limit)}`}</strong>
      </div>
      <div className="bl-meter-track">
        <div
          className={`bl-meter-fill ${percent >= 90 ? "hot" : ""}`}
          style={{ width: unlimited ? "100%" : `${percent}%`, opacity: unlimited ? 0.35 : 1 }}
        />
      </div>
    </div>
  );
}

/** Compact 14-day trend line for the spend card. Pure SVG, no deps. */
function Sparkline({ series }: { series: UsageDay[] }) {
  const points = series.slice(-14).map((day) => day.total);
  const max = Math.max(...points, 0.0001);
  const w = 260, h = 46;
  const coords = points.map((value, i) => {
    const x = points.length > 1 ? (i / (points.length - 1)) * w : 0;
    const y = h - (value / max) * (h - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  if (coords.length < 2) return <div className="bl-spark-empty" />;
  const line = `M ${coords.join(" L ")}`;

  return (
    <svg className="bl-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="bl-spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16a34a" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L ${w},${h} L 0,${h} Z`} fill="url(#bl-spark-grad)" />
      <path d={line} fill="none" stroke="#16a34a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * Stacked daily-spend chart. Hand-rolled SVG measured against its own
 * container so bars stay crisp at any width — the project ships no chart
 * library, and a 60-line component beats a 300kB dependency here.
 */
function UsageChart({ series, categories, loading, empty }: {
  series: UsageDay[];
  categories: UsageCategory[];
  loading: boolean;
  empty: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(280, entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const H = 240, padL = 52, padR = 12, padT = 14, padB = 26;
  const plotW = Math.max(10, width - padL - padR);
  const plotH = H - padT - padB;

  // Only the visible categories count toward the scale, so hiding
  // marketing actually rescales the chart instead of leaving dead space.
  const visibleTotal = (day: UsageDay) =>
    categories.reduce((sum, category) => sum + day.spend[category], 0);
  const peak = Math.max(...series.map(visibleTotal), 0);
  const niceMax = niceCeil(peak);

  const slot = plotW / Math.max(1, series.length);
  const barW = Math.max(3, Math.min(28, slot * 0.62));
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  const hovered = hover !== null ? series[hover] : null;

  if (empty && !loading) {
    return (
      <div className="bl-chart-empty">
        <div className="bl-chart-empty-ic"><Sparkles size={20} /></div>
        <h4>No spend in this period</h4>
        <p>Once you send your first campaign, daily costs land here broken down by category.</p>
        <Link className="bl-btn bl-btn-primary" href="/broadcasts">
          Create a broadcast <ArrowUpRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div className="bl-chart" ref={wrapRef}>
      {loading && <div className="bl-chart-loading"><Loader2 size={16} className="bl-spin" /></div>}

      <svg width={width} height={H} role="img" aria-label="Daily credit spend by category">
        {gridLines.map((ratio) => {
          const y = padT + plotH - ratio * plotH;
          return (
            <g key={ratio}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="#eef2f0" strokeWidth="1" />
              <text x={padL - 8} y={y + 3.5} textAnchor="end" className="bl-axis">
                {shortMoney(niceMax * ratio)}
              </text>
            </g>
          );
        })}

        {series.map((day, i) => {
          const x = padL + i * slot + (slot - barW) / 2;
          let cursorY = padT + plotH;
          return (
            <g
              key={day.day}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((current) => (current === i ? null : current))}
            >
              {/* Full-height hit area so thin bars are still hoverable */}
              <rect
                x={padL + i * slot} y={padT} width={slot} height={plotH}
                fill={hover === i ? "rgba(22,163,74,.05)" : "transparent"}
              />
              {categories.map((category) => {
                const value = day.spend[category];
                if (value <= 0) return null;
                const barH = niceMax > 0 ? (value / niceMax) * plotH : 0;
                cursorY -= barH;
                return (
                  <rect
                    key={category}
                    x={x} y={cursorY} width={barW} height={Math.max(1, barH)}
                    fill={CATEGORY_META[category].color}
                    opacity={hover === null || hover === i ? 1 : 0.42}
                    rx={1.5}
                  />
                );
              })}
            </g>
          );
        })}

        <line
          x1={padL} x2={width - padR} y1={padT + plotH} y2={padT + plotH}
          stroke="#dbe3de" strokeWidth="1"
        />

        {axisTicks(series.length).map((i) => (
          <text
            key={i}
            x={padL + i * slot + slot / 2}
            y={H - 8}
            textAnchor="middle"
            className="bl-axis"
          >
            {dayLabel(series[i].day)}
          </text>
        ))}
      </svg>

      {hovered && (
        <div
          className="bl-tip"
          style={{
            left: Math.min(Math.max(padL + (hover! + 0.5) * slot, 90), width - 90),
          }}
        >
          <strong>{dayLabel(hovered.day, true)}</strong>
          {categories
            .filter((category) => hovered.spend[category] > 0)
            .map((category) => (
              <span key={category}>
                <i style={{ background: CATEGORY_META[category].color }} />
                {CATEGORY_META[category].label}
                <em>{formatINR(hovered.spend[category], 2)}</em>
              </span>
            ))}
          <span className="bl-tip-total">
            Total <em>{formatINR(visibleTotal(hovered), 2)}</em>
          </span>
        </div>
      )}

      <div className="bl-legend">
        {categories.map((category) => (
          <span key={category}>
            <i style={{ background: CATEGORY_META[category].color }} /> {CATEGORY_META[category].label}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bl-empty-row">
      <div className="bl-empty-ic">{icon}</div>
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </div>
  );
}

/* ────────────────────────────── helpers ────────────────────────────── */

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function shortDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

function dayLabel(key: string, long = false): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN",
    long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" });
}

/** Round a chart maximum up to a readable tick value. */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/** Compact money for axis labels: ₹0, ₹450, ₹1.2k. */
function shortMoney(value: number): string {
  if (value >= 1000) return `₹${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `₹${value < 10 ? value.toFixed(1) : Math.round(value)}`;
}

/** Pick ~6 evenly spaced x-axis label positions. */
function axisTicks(length: number): number[] {
  if (length <= 1) return [0];
  const target = Math.min(6, length);
  const step = (length - 1) / (target - 1);
  const ticks = new Set<number>();
  for (let i = 0; i < target; i++) ticks.add(Math.round(i * step));
  return [...ticks];
}

/* ────────────────────────────── styles ────────────────────────────── */

const css = `
.bl{
  --brand:#16a34a;--brand-deep:#15803d;--brand-50:#f0fdf4;
  --ink:#0f172a;--muted:#64748b;--line:#e8edf0;--card:#fff;
  --r:16px;--shadow:0 1px 3px rgba(15,23,42,.04),0 6px 20px rgba(15,23,42,.05);
  font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:var(--ink);
  display:flex;flex-direction:column;gap:18px;padding-bottom:84px}
@media(min-width:1024px){.bl{padding-bottom:8px}}
.bl h1,.bl h2,.bl h3,.bl h4{font-family:"Sora","Plus Jakarta Sans",sans-serif;letter-spacing:-.02em;margin:0}
.bl-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow)}
.bl-loading{display:flex;align-items:center;justify-content:center;gap:10px;height:240px;color:var(--muted);font-size:14px;font-weight:600}
.bl-spin{animation:blSpin .8s linear infinite}
@keyframes blSpin{to{transform:rotate(360deg)}}

/* header */
.bl-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px}
.bl-head h1{font-size:22px}
@media(min-width:640px){.bl-head h1{font-size:25px}}
.bl-head p{margin:4px 0 0;font-size:13px;color:var(--muted)}
.bl-head-actions{display:flex;gap:8px;flex-wrap:wrap}

/* buttons */
.bl-btn{border:none;cursor:pointer;font-family:inherit;font-weight:700;font-size:12.5px;padding:9px 15px;
  border-radius:11px;display:inline-flex;align-items:center;justify-content:center;gap:7px;transition:.16s;
  white-space:nowrap;text-decoration:none}
.bl-btn:disabled{opacity:.55;cursor:default;transform:none!important}
.bl-btn-full{width:100%}
.bl-btn-primary{background:var(--brand);color:#fff;box-shadow:0 5px 16px rgba(22,163,74,.28)}
.bl-btn-primary:hover:not(:disabled){background:var(--brand-deep);transform:translateY(-1px)}
.bl-btn-outline{background:#fff;color:var(--ink);border:1.5px solid var(--line)}
.bl-btn-outline:hover:not(:disabled){border-color:var(--brand);color:var(--brand-deep)}
.bl-btn-ghost{background:#f1f5f4;color:#475569}
.bl-btn-ghost:hover{background:#e6ebe8}
.bl-btn-white{background:#fff;color:var(--brand-deep);box-shadow:0 4px 14px rgba(0,0,0,.12)}
.bl-btn-white:hover{transform:translateY(-1px)}
.bl-link{background:none;border:none;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;color:var(--brand-deep);padding:0}

/* alert */
.bl-alert{display:flex;align-items:center;gap:13px;padding:14px 16px;border-radius:var(--r);
  background:linear-gradient(120deg,#f59e0b,#d97706);color:#fff;box-shadow:var(--shadow)}
.bl-alert.critical{background:linear-gradient(120deg,#ef4444,#b91c1c)}
.bl-alert>svg{flex-shrink:0}
.bl-alert div{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.bl-alert strong{font-size:13.5px;font-family:"Sora",sans-serif}
.bl-alert span{font-size:12px;opacity:.92;line-height:1.4}

/* snapshot */
.bl-snapshot{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:760px){.bl-snapshot{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1180px){.bl-snapshot{grid-template-columns:1.05fr 1fr 1fr}}
.bl-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
.bl-card-head h2{font-size:15px}
.bl-eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;letter-spacing:.05em;
  text-transform:uppercase;color:var(--muted)}
.bl-eyebrow.light{color:rgba(255,255,255,.78)}
.bl-pill{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;padding:3px 9px;
  border-radius:99px;text-transform:capitalize}
.bl-pill.ok{background:var(--brand-50);color:var(--brand-deep)}
.bl-pill.warn{background:#fffbeb;color:#b45309}
.bl-pill.solid{background:rgba(255,255,255,.2);color:#fff}
.bl-amount{font-family:"Sora",sans-serif;font-size:31px;font-weight:800;letter-spacing:-.03em;margin:0;line-height:1.05}
.bl-sub{font-size:12px;color:var(--muted);margin:6px 0 0;line-height:1.45}
.bl-mini-label{display:block;font-size:10.5px;color:var(--muted);font-weight:600;margin-bottom:2px}

/* plan hero */
.bl-planhero{padding:18px 20px;border:none;color:#fff;position:relative;overflow:hidden;
  background:linear-gradient(140deg,#16a34a,#15803d 55%,#0f5132);display:flex;flex-direction:column}
.bl-planhero::after{content:"";position:absolute;right:-52px;top:-64px;width:190px;height:190px;border-radius:50%;
  background:rgba(255,255,255,.08)}
.bl-planhero>*{position:relative;z-index:1}
.bl-planhero-name{font-size:24px;letter-spacing:-.03em}
.bl-planhero-price{font-family:"Sora",sans-serif;font-size:17px;font-weight:700;margin:4px 0 0}
.bl-planhero-price em{font-style:normal;font-size:12px;opacity:.75;font-weight:600}
.bl-planhero-renew{font-size:11.5px;opacity:.82;margin:6px 0 0;line-height:1.4}
.bl-meters{display:flex;flex-direction:column;gap:11px;margin:16px 0 16px}
.bl-meter-top{display:flex;align-items:center;justify-content:space-between;font-size:11.5px;margin-bottom:5px}
.bl-meter-top span{display:inline-flex;align-items:center;gap:5px;opacity:.85}
.bl-meter-top strong{font-family:"Sora",sans-serif;font-size:11.5px}
.bl-meter-track{height:5px;border-radius:99px;background:rgba(255,255,255,.22);overflow:hidden}
.bl-meter-fill{height:100%;border-radius:99px;background:#86efac;transition:width .4s cubic-bezier(.2,.7,.3,1)}
.bl-meter-fill.hot{background:#fbbf24}
.bl-planhero .bl-btn-white{margin-top:auto}

/* wallet */
.bl-wallet,.bl-spend{padding:18px 20px;display:flex;flex-direction:column}
.bl-runway{margin:14px 0 4px;display:flex;flex-direction:column;gap:7px;padding:11px 12px;background:#f8faf9;
  border:1px solid var(--line);border-radius:12px}
.bl-runway-row{display:flex;align-items:center;gap:8px;font-size:11.5px}
.bl-runway-label{color:var(--muted);flex:1}
.bl-runway-value{font-family:"Sora",sans-serif;font-weight:700;font-size:11.5px}
.bl-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.bl-topups{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px}
.bl-topup{border:1.5px solid var(--line);background:#fff;border-radius:10px;padding:8px 4px;cursor:pointer;
  font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:1px;transition:.15s}
.bl-topup span{font-size:11.5px;font-weight:800;color:var(--ink)}
.bl-topup em{font-style:normal;font-size:8.5px;font-weight:700;color:var(--brand-deep)}
.bl-topup:hover{border-color:var(--brand);background:var(--brand-50);transform:translateY(-1px)}

/* spend */
.bl-spark{width:100%;height:46px;margin:14px 0 2px;display:block}
.bl-spark-empty{height:46px;margin:14px 0 2px;border-radius:8px;background:repeating-linear-gradient(
  90deg,#f4f7f5,#f4f7f5 6px,transparent 6px,transparent 12px)}
.bl-spend-foot{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:auto;padding-top:13px;
  border-top:1px solid var(--line)}
.bl-spend-foot strong{font-family:"Sora",sans-serif;font-size:14px;font-weight:800}

/* explorer */
.bl-explorer{padding:18px 20px}
.bl-explorer-head{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px}
.bl-explorer-head h2{font-size:16px}
.bl-explorer-head p{font-size:12px;color:var(--muted);margin:4px 0 0}
.bl-range,.bl-cycle{display:inline-flex;gap:3px;padding:3px;background:#f1f5f4;border-radius:11px}
.bl-range button,.bl-cycle button{border:none;background:none;cursor:pointer;font-family:inherit;font-size:12px;
  font-weight:700;color:var(--muted);padding:7px 13px;border-radius:9px;transition:.15s;display:inline-flex;
  align-items:center;gap:5px}
.bl-range button:hover,.bl-cycle button:hover{color:var(--ink)}
.bl-range button.active,.bl-cycle button.active{background:#fff;color:var(--brand-deep);box-shadow:0 1px 3px rgba(15,23,42,.1)}
.bl-cycle em{font-style:normal;font-size:9px;font-weight:800;background:var(--brand-50);color:var(--brand-deep);
  padding:2px 6px;border-radius:6px}
.bl-cycle button.active em{background:var(--brand);color:#fff}

.bl-rates{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin:16px 0 6px}
@media(min-width:900px){.bl-rates{grid-template-columns:repeat(4,1fr)}}
.bl-rate{text-align:left;border:1px solid var(--line);background:#fff;border-radius:13px;padding:12px 13px;
  cursor:pointer;font-family:inherit;transition:.16s;display:flex;flex-direction:column;gap:3px}
.bl-rate:hover{border-color:#cfd9d3;transform:translateY(-1px);box-shadow:var(--shadow)}
.bl-rate.muted{opacity:.45;background:#fafcfb}
.bl-rate-top{display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:700;color:var(--muted)}
.bl-rate strong{font-family:"Sora",sans-serif;font-size:19px;font-weight:800;letter-spacing:-.02em}
.bl-rate-meta{font-size:11px;color:var(--muted);font-weight:600}
.bl-rate-blurb{font-size:10.5px;color:#94a3b8;line-height:1.35;margin-top:2px}

/* chart */
.bl-chart{position:relative;margin-top:10px}
.bl-chart svg{display:block;width:100%}
.bl-axis{font-size:10px;fill:#94a3b8;font-family:"Plus Jakarta Sans",sans-serif;font-weight:600}
.bl-chart-loading{position:absolute;inset:0;display:grid;place-items:center;background:rgba(255,255,255,.6);
  color:var(--brand-deep);z-index:2;border-radius:12px}
.bl-tip{position:absolute;top:6px;transform:translateX(-50%);background:#0f172a;color:#fff;border-radius:11px;
  padding:9px 11px;font-size:11px;display:flex;flex-direction:column;gap:4px;pointer-events:none;z-index:3;
  box-shadow:0 10px 30px rgba(15,23,42,.3);min-width:150px}
.bl-tip strong{font-family:"Sora",sans-serif;font-size:11.5px;margin-bottom:2px}
.bl-tip span{display:flex;align-items:center;gap:6px;opacity:.9}
.bl-tip i{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.bl-tip em{font-style:normal;margin-left:auto;font-weight:700}
.bl-tip-total{border-top:1px solid rgba(255,255,255,.18);padding-top:5px;margin-top:2px;font-weight:700;opacity:1}
.bl-legend{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:8px}
.bl-legend span{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);font-weight:600}
.bl-legend i{width:9px;height:9px;border-radius:3px}
.bl-chart-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:7px;padding:34px 16px}
.bl-chart-empty-ic{width:50px;height:50px;border-radius:15px;background:var(--brand-50);color:var(--brand-deep);
  display:grid;place-items:center;margin-bottom:2px}
.bl-chart-empty h4{font-size:15px}
.bl-chart-empty p{font-size:12.5px;color:var(--muted);max-width:340px;line-height:1.5;margin:0 0 8px}

/* plans */
.bl-plans-wrap{display:flex;flex-direction:column;gap:14px}
.bl-plans-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px}
.bl-plans-head h2{font-size:18px}
.bl-plans-head p{font-size:12.5px;color:var(--muted);margin:4px 0 0}
.bl-plans{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:760px){.bl-plans{grid-template-columns:repeat(3,1fr)}}
.bl-plan{padding:20px;display:flex;flex-direction:column;position:relative;transition:.18s}
.bl-plan:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(15,23,42,.09)}
.bl-plan.featured{border-color:var(--brand);box-shadow:0 0 0 3px rgba(22,163,74,.1),var(--shadow)}
.bl-plan.current{background:#fbfdfc}
.bl-ribbon{position:absolute;top:-10px;left:20px;background:var(--brand);color:#fff;font-size:9.5px;font-weight:800;
  letter-spacing:.05em;text-transform:uppercase;padding:4px 10px;border-radius:7px}
.bl-current-tag{position:absolute;top:16px;right:18px;display:inline-flex;align-items:center;gap:4px;font-size:10px;
  font-weight:800;color:var(--brand-deep);background:var(--brand-50);padding:4px 8px;border-radius:7px}
.bl-plan h3{font-size:17px;margin-top:4px}
.bl-plan-tag{font-size:11.5px;color:var(--muted);margin:4px 0 0;line-height:1.4;min-height:32px}
.bl-price{display:flex;align-items:baseline;gap:4px;margin-top:12px}
.bl-price-value{font-family:"Sora",sans-serif;font-size:29px;font-weight:800;letter-spacing:-.03em}
.bl-price-unit{font-size:12px;color:var(--muted);font-weight:600}
.bl-save{display:inline-block;font-size:10.5px;font-weight:800;color:var(--brand-deep);background:var(--brand-50);
  padding:3px 8px;border-radius:7px;margin-top:6px;width:max-content}
.bl-features{list-style:none;padding:0;margin:16px 0 14px;display:flex;flex-direction:column;gap:7px;flex:1}
.bl-features li{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:#475569;line-height:1.4}
.bl-features svg{color:var(--brand);flex-shrink:0;margin-top:2px}
.bl-limits{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px}
.bl-limits span{font-size:10px;font-weight:700;color:var(--muted);background:#f4f7f5;padding:4px 8px;border-radius:7px}
.bl-assurance{display:flex;align-items:center;justify-content:center;gap:7px;font-size:12px;color:var(--muted);margin:0}
.bl-assurance svg{color:var(--brand)}

/* tables */
.bl-tables{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:1024px){.bl-tables{grid-template-columns:1.35fr 1fr}}
.bl-table-card{padding:18px 20px}
.bl-scroll{overflow-x:auto;margin:0 -20px;padding:0 20px}
.bl-table-card table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:460px}
.bl-table-card th{text-align:left;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
  color:#94a3b8;padding:0 10px 9px 0;border-bottom:1px solid var(--line);white-space:nowrap}
.bl-table-card td{padding:11px 10px 11px 0;border-bottom:1px solid #f2f6f4;vertical-align:middle}
.bl-table-card tr:last-child td{border-bottom:none}
.bl-table-card th.right,.bl-table-card td.right{text-align:right;padding-right:0}
.bl-tx{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:7px;margin-right:8px;
  vertical-align:middle}
.bl-tx.out{background:#f5f3ff;color:#7c3aed}
.bl-tx.in{background:var(--brand-50);color:var(--brand-deep)}
.bl-tx-text{font-weight:600;color:#334155}
.bl-dim{color:var(--muted)}
.bl-neg{font-weight:700;color:#b91c1c;font-family:"Sora",sans-serif}
.bl-pos{font-weight:700;color:var(--brand-deep);font-family:"Sora",sans-serif}
.bl-empty-row{display:flex;align-items:flex-start;gap:12px;padding:20px 2px}
.bl-empty-ic{width:38px;height:38px;border-radius:12px;background:#f4f7f5;color:var(--muted);display:grid;
  place-items:center;flex-shrink:0}
.bl-empty-row strong{font-size:13px;font-family:"Sora",sans-serif}
.bl-empty-row p{font-size:12px;color:var(--muted);margin:3px 0 0;line-height:1.45}

/* help */
.bl-help{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;padding:18px 20px;
  border-radius:var(--r);background:#f8faf9;border:1px solid var(--line)}
.bl-help h3{font-size:14px}
.bl-help p{font-size:12.5px;color:var(--muted);margin:6px 0 0;line-height:1.55;max-width:70ch}

@media(prefers-reduced-motion:reduce){.bl *{transition:none!important;animation:none!important}}
`;

"use client";

// src/app/(dashboard)/campaign-agent/[id]/page.tsx — one campaign: status,
// each step's progress, and the pause / resume / stop controls.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pause, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PageHead } from "@/components/ui/page-head";
import { Panel, PanelHead } from "@/components/ui/panel";
import { Pill, type PillTone } from "@/components/ui/pill";
import { StatCard } from "@/components/ui/stat";
import { Button } from "@/components/ui/button";

interface Live {
  day: { current: number; total: number };
  budget: { plannedMax: number; spent: number; remaining: number; balance: number | null };
  clicks: number | null;
  attention: Array<{ contactId: string; name: string | null; phone: string; reason: "waiting" | "unreachable"; detail: string }>;
  counts: { waiting: number; unreachable: number };
}
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Campaign { id: string; name: string; goal: string; status: string; error: string | null; est_contacts: number; est_cost: number }
interface Step { id: string; grp: number; variant: number; label: string; body: string; status: string; error: string | null; wait_hours: number; rule: string | null; broadcast_id: string | null; run_at: string | null; kind: string; rewrite_count: number; rejection_reason: string | null }
interface Bc { id: string; total_recipients: number; sent_count: number; delivered_count: number; read_count: number; replied_count: number; failed_count: number }

const CAMPAIGN_STATUS: Record<string, { tone: PillTone; label: string }> = {
  running: { tone: "live", label: "Running" },
  paused: { tone: "sched", label: "Paused" },
  completed: { tone: "done", label: "Completed" },
  cancelled: { tone: "neutral", label: "Cancelled" },
  failed: { tone: "err", label: "Failed" },
};
const STEP_STATUS: Record<string, { tone: PillTone; label: string }> = {
  waiting_template: { tone: "sched", label: "Waiting for Meta approval" },
  ready: { tone: "info", label: "Approved, queued" },
  sending: { tone: "live", label: "Sending" },
  done: { tone: "done", label: "Sent" },
  skipped: { tone: "neutral", label: "Skipped" },
  failed: { tone: "err", label: "Failed" },
};

export default function CampaignAgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [c, setC] = useState<Campaign | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [bcs, setBcs] = useState<Record<string, Bc>>({});
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [live, setLive] = useState<Live | null>(null);

  const load = useCallback(async () => {
    const { data: camp } = await supabase.from("campaign_agents").select("id, name, goal, status, error, est_contacts, est_cost").eq("id", id).maybeSingle();
    if (!camp) { setMissing(true); return; }
    setC(camp as Campaign);
    fetch(`/api/campaign-agent/${id}/live`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.day) setLive(d as Live); }).catch(() => {});
    const { data: st } = await supabase.from("campaign_steps").select("id, grp, variant, label, body, status, error, wait_hours, rule, broadcast_id, run_at, kind, rewrite_count, rejection_reason").eq("campaign_id", id).order("grp").order("variant");
    const list = (st ?? []) as Step[];
    setSteps(list);
    const ids = list.map((s) => s.broadcast_id).filter((x): x is string => !!x);
    if (ids.length) {
      const { data: b } = await supabase.from("broadcasts").select("id, total_recipients, sent_count, delivered_count, read_count, replied_count, failed_count").in("id", ids);
      setBcs(Object.fromEntries(((b ?? []) as Bc[]).map((x) => [x.id, x])));
    }
  }, [supabase, id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  async function act(action: "pause" | "resume" | "cancel") {
    if (action === "cancel" && !window.confirm("Stop this campaign? Messages not yet sent will not be sent.")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/campaign-agent/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (missing) return <div className="p-10 text-[14px]">Campaign not found. <Link className="underline" href="/campaign-agent">Back to AI campaigns</Link></div>;
  if (!c) return <div className="p-10 text-[13px] text-[color:var(--ink-3)]">Loading…</div>;

  const totals = Object.values(bcs).reduce(
    (a, b) => ({ sent: a.sent + b.sent_count, delivered: a.delivered + b.delivered_count, read: a.read + b.read_count, replied: a.replied + b.replied_count }),
    { sent: 0, delivered: 0, read: 0, replied: 0 },
  );
  const s = CAMPAIGN_STATUS[c.status] ?? CAMPAIGN_STATUS.completed;
  const finished = ["completed", "cancelled", "failed"].includes(c.status);

  return (
    <div className="w-full px-5 pb-20 pt-5 sm:px-7 lg:px-10 lg:pb-10">
      <Link href="/campaign-agent" className="mb-3 inline-flex items-center gap-1 text-[12.5px] text-[color:var(--ink-3)] hover:text-[color:var(--ink)]"><ArrowLeft size={13} /> AI campaigns</Link>
      <PageHead
        title={c.name}
        subtitle={<span className="inline-flex items-center gap-2"><Pill tone={s.tone}>{s.label}</Pill>{c.est_contacts.toLocaleString("en-IN")} contacts</span>}
        actions={!finished && (
          <>
            {c.status === "paused"
              ? <Button disabled={busy} onClick={() => act("resume")}><Play size={14} /> Resume</Button>
              : <Button variant="outline" disabled={busy} onClick={() => act("pause")}><Pause size={14} /> Pause</Button>}
            <Button variant="outline" disabled={busy} onClick={() => act("cancel")}><Square size={13} /> Stop</Button>
          </>
        )}
      />

      {c.error && <div className="mb-5 rounded-xl border p-3.5 text-[13px]" style={{ borderColor: "var(--amber-200)", background: "var(--amber-50)", color: "var(--amber)" }}>{c.error}</div>}

      {live && (
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Journey" value={finished ? "Finished" : `Day ${live.day.current} of ${live.day.total}`} />
          <StatCard label="Spent so far" value={inr(live.budget.spent)} />
          <StatCard label="Budget left (of max)" value={inr(live.budget.remaining)} />
          <StatCard label="Link clicks" value={live.clicks === null ? "No link" : live.clicks.toLocaleString("en-IN")} />
        </div>
      )}
      {live && live.budget.balance !== null && (
        <p className="mb-5 text-[12px] text-[color:var(--ink-3)]">Planned maximum {inr(live.budget.plannedMax)} (if every follow-up reached everyone). Wallet balance {inr(live.budget.balance)}.</p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sent" value={totals.sent.toLocaleString("en-IN")} />
        <StatCard label="Delivered" value={totals.delivered.toLocaleString("en-IN")} />
        <StatCard label="Read" value={totals.read.toLocaleString("en-IN")} />
        <StatCard label="Replied" value={totals.replied.toLocaleString("en-IN")} />
      </div>

      {live && live.attention.length > 0 && (
        <Panel className="mb-6">
          <PanelHead title="Needs your attention" subtitle={`${live.counts.waiting} waiting for a reply · ${live.counts.unreachable} could not be reached`} />
          <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
            {live.attention.map((p) => (
              <li key={p.contactId} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]">
                <Pill tone={p.reason === "waiting" ? "sched" : "err"}>{p.reason === "waiting" ? "Waiting for you" : "Not reachable"}</Pill>
                <span className="font-medium">{p.name || "No name"}</span>
                <span className="text-[color:var(--ink-3)]">{p.phone}</span>
                <span className="text-[color:var(--ink-3)]">{p.detail}</span>
                {p.reason === "waiting" && <Link href={`/inbox?q=${encodeURIComponent(p.phone)}`} className="ml-auto text-[12.5px] font-semibold text-[color:var(--brand-deep)] underline">Open chat</Link>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel>
        <PanelHead title="Journey" subtitle={c.goal} />
        <ol className="divide-y" style={{ borderColor: "var(--line)" }}>
          {steps.map((st) => {
            const ss = STEP_STATUS[st.status] ?? STEP_STATUS.ready;
            const b = st.broadcast_id ? bcs[st.broadcast_id] : undefined;
            return (
              <li key={st.id} className="space-y-2 px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[14px] font-semibold">
                    {st.kind === "retry" ? "Retry of failed deliveries" : st.grp === 0 ? `First message${steps.filter((x) => x.grp === 0 && x.kind !== "retry").length > 1 ? ` · version ${String.fromCharCode(65 + st.variant)}` : ""}` : `Follow-up ${st.grp}`} · {st.label}
                  </span>
                  <Pill tone={ss.tone}>{ss.label}</Pill>
                  {st.grp > 0 && st.kind !== "retry" && <span className="text-[12px] text-[color:var(--ink-3)]">{st.wait_hours}h after previous · to people who {st.rule === "not_read" ? "did not read it" : "did not reply"}</span>}
                  {st.run_at && st.status === "ready" && new Date(st.run_at) > new Date() && <span className="text-[12px] text-[color:var(--ink-3)]">sends {new Date(st.run_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                </div>
                <p className="whitespace-pre-wrap text-[13px] text-[color:var(--ink-2)]">{st.body.replace(/\{\{\s*1\s*\}\}/g, "[name]")}</p>
                {b && <p className="text-[12px] tabular-nums text-[color:var(--ink-3)]">{b.total_recipients} queued · {b.sent_count} sent · {b.delivered_count} delivered · {b.read_count} read · {b.replied_count} replied · {b.failed_count} failed</p>}
                {st.rewrite_count > 0 && <p className="text-[12.5px]" style={{ color: "var(--amber)" }}>Meta rejected the earlier wording{st.rejection_reason ? ` (${st.rejection_reason})` : ""}. The AI rewrote it and submitted it again{st.rewrite_count > 1 ? ` (${st.rewrite_count} times)` : ""}.</p>}
                {st.error && <p className="text-[12.5px]" style={{ color: "var(--rose)" }}>{st.error}</p>}
              </li>
            );
          })}
        </ol>
      </Panel>
    </div>
  );
}

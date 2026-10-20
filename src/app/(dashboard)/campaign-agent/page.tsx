"use client";

// src/app/(dashboard)/campaign-agent/page.tsx — Campaign Agent list.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PageHead } from "@/components/ui/page-head";
import { Panel, PanelHead } from "@/components/ui/panel";
import { Pill, type PillTone } from "@/components/ui/pill";
import { StatCard } from "@/components/ui/stat";
import { Button } from "@/components/ui/button";

interface Row {
  id: string;
  name: string;
  status: string;
  est_contacts: number;
  est_cost: number;
  error: string | null;
  launched_at: string;
}

const STATUS: Record<string, { tone: PillTone; label: string }> = {
  running: { tone: "live", label: "Running" },
  paused: { tone: "sched", label: "Paused" },
  completed: { tone: "done", label: "Completed" },
  cancelled: { tone: "neutral", label: "Cancelled" },
  failed: { tone: "err", label: "Failed" },
};

export default function CampaignAgentListPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    supabase
      .from("campaign_agents")
      .select("id, name, status, est_contacts, est_cost, error, launched_at")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!live) return;
        if (error) toast.error(error.message);
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [supabase]);

  const running = rows.filter((r) => r.status === "running").length;

  return (
    <div className="w-full px-5 pb-20 pt-5 sm:px-7 lg:px-10 lg:pb-10">
      <PageHead
        title="AI Campaigns"
        subtitle="Describe your goal. The agent writes the messages, gets them approved and sends the follow-ups."
        live={running > 0 ? { label: `${running} running` } : undefined}
        actions={
          <Button render={<Link href="/campaign-agent/new" />}>
            <Plus size={14} /> New AI campaign
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="AI campaigns" value={rows.length.toLocaleString("en-IN")} icon={<Sparkles size={12} aria-hidden />} />
        <StatCard label="Running now" value={running.toLocaleString("en-IN")} />
        <StatCard label="Completed" value={rows.filter((r) => r.status === "completed").length.toLocaleString("en-IN")} />
      </div>

      <Panel>
        <PanelHead title="All AI campaigns" />
        {loading ? (
          <p className="p-6 text-[13px] text-[color:var(--ink-3)]">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[15px] font-semibold">No AI campaigns yet</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-[color:var(--ink-3)]">Type what you want to promote and the agent drafts the broadcast and follow-ups for you to review.</p>
            <Button className="mt-4" render={<Link href="/campaign-agent/new" />}>
              <Sparkles size={14} /> Create your first
            </Button>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
            {rows.map((r) => {
              const s = STATUS[r.status] ?? STATUS.completed;
              return (
                <li key={r.id}>
                  <Link href={`/campaign-agent/${r.id}`} className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3.5 transition hover:bg-[color:var(--surface-2)]">
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{r.name}</span>
                    <span className="text-[12.5px] text-[color:var(--ink-3)]">{r.est_contacts.toLocaleString("en-IN")} contacts</span>
                    <span className="text-[12.5px] text-[color:var(--ink-3)]">{new Date(r.launched_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    <Pill tone={s.tone}>{s.label}</Pill>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

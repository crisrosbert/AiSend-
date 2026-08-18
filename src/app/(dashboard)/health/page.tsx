"use client";

// src/app/(dashboard)/health/page.tsx
//
// What the daily health check found.
//
// ── WHY THIS PAGE EXISTS ─────────────────────────────────────────────
// Everything that has gone wrong in this product went wrong quietly: an
// agent booking midnight, replies that promised to come back and never
// did, media that never sent, delivery tracking recording nothing. Each
// one was caught by a person testing by hand and noticing. That works
// with one attentive user and stops working at ten customers.
//
// This is where a silent failure becomes visible without anyone having
// to go looking for it.

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, AlertCircle, Info, CheckCircle2, Loader2, X,
} from "lucide-react";

interface Finding {
  id: string;
  code: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string | null;
  count: number;
  detected_at: string;
  resolved_at: string | null;
}

export default function HealthPage() {
  const supabase = createClient();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from("health_findings")
      .select("id, code, severity, title, detail, count, detected_at, resolved_at")
      .eq("tenant_id", user.id)
      .is("resolved_at", null)
      .order("detected_at", { ascending: false })
      .limit(50);

    if (error) {
      // Most likely the migration has not been run yet. Say so rather
      // than showing an empty page that looks like good news.
      toast.error(
        /does not exist|schema cache/i.test(error.message)
          ? "Run migration 025 to enable health checks"
          : error.message,
      );
    }
    setFindings(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function dismiss(id: string) {
    setClearing(id);
    try {
      const { error } = await supabase
        .from("health_findings")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) { toast.error(error.message); return; }
      setFindings((f) => f.filter((x) => x.id !== id));
    } finally {
      setClearing(null);
    }
  }

  const style = {
    critical: { icon: <AlertCircle className="size-4" />, ring: "border-red-200 bg-red-50", tint: "text-red-700", label: "Needs attention" },
    warning: { icon: <AlertTriangle className="size-4" />, ring: "border-amber-200 bg-amber-50", tint: "text-amber-700", label: "Worth checking" },
    info: { icon: <Info className="size-4" />, ring: "border-slate-200 bg-slate-50", tint: "text-slate-600", label: "For information" },
  } as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="rounded-2xl border border-[#d1fae5] bg-gradient-to-br from-white to-emerald-50 p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
            <Activity className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0c1f17]">System health</h1>
            <p className="text-xs text-slate-500">
              Checked daily for the things that go wrong without any error showing —
              customers left waiting, replies sent twice, campaigns that stopped.
            </p>
          </div>
        </div>
      </div>

      {findings.length === 0 ? (
        <div className="rounded-2xl border border-[#e7ece9] bg-white p-10 text-center">
          <CheckCircle2 className="mx-auto mb-3 size-9 text-emerald-500" />
          <h2 className="text-sm font-bold text-[#0c1f17]">Nothing to report</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
            No customers waiting without a reply, no duplicate messages, no stalled
            campaigns and nothing booked outside your opening hours.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {findings.map((f) => {
            const s = style[f.severity] ?? style.info;
            return (
              <div key={f.id} className={`rounded-xl border p-4 ${s.ring}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 shrink-0 ${s.tint}`}>{s.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${s.tint}`}>
                        {s.label}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(f.detected_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    <h3 className="mt-0.5 text-sm font-bold text-[#0c1f17]">{f.title}</h3>
                    {f.detail && (
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">{f.detail}</p>
                    )}
                  </div>
                  <button
                    onClick={() => dismiss(f.id)}
                    disabled={clearing === f.id}
                    title="Mark as handled"
                    className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                  >
                    {clearing === f.id
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <X className="size-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-slate-400">
        Checks run once a day. Dismissing a finding clears it from this list — if the
        underlying problem is still there, it will be reported again on the next run.
      </p>
    </div>
  );
}

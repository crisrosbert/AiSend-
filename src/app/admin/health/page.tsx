"use client";

// src/app/admin/health/page.tsx
//
// What the daily health check found, across every tenant.
//
// ── OPERATOR PAGE, NOT A CUSTOMER PAGE ───────────────────────────────
// The findings are diagnostics — "no agent assigned to WhatsApp",
// "identical replies sent twice", "campaign stopped with 900 pending".
// A business owner cannot act on most of it, and a page listing
// everything wrong with the platform costs confidence without buying
// anything. It also names conversations across tenants, which must
// never be rendered to one of them.
//
// So: same admin_users gate as /admin, and the data comes from an
// admin-only route rather than the browser reading the table.
//
// ── WHY IT EXISTS AT ALL ─────────────────────────────────────────────
// Every serious bug in this product returned 200 OK and was found by
// somebody testing by hand. That does not scale past one attentive
// person. This is where a silent failure becomes visible.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Activity, AlertTriangle, AlertCircle, Info, CheckCircle2,
  Loader2, X, ArrowLeft,
} from "lucide-react";

interface Finding {
  id: string;
  tenant_id: string | null;
  tenant_name: string;
  code: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string | null;
  count: number;
  detected_at: string;
}

const STYLES = {
  critical: { icon: AlertCircle, ring: "border-red-200 bg-red-50", tint: "text-red-700", label: "Needs attention" },
  warning: { icon: AlertTriangle, ring: "border-amber-200 bg-amber-50", tint: "text-amber-700", label: "Worth checking" },
  info: { icon: Info, ring: "border-slate-200 bg-slate-50", tint: "text-slate-600", label: "For information" },
} as const;

export default function AdminHealthPage() {
  const [ready, setReady] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState<string | null>(null);

  const loadFindings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/health-findings");
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not load findings"); return; }
      setFindings(data.findings ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load findings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      // Same gate as /admin. The API checks again server-side — this is
      // only so a non-operator sees their own dashboard instead of an
      // empty page and a 403.
      const { data: admin } = await sb
        .from("admin_users")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!admin) { window.location.href = "/dashboard"; return; }

      setReady(true);
      void loadFindings();
    })();
  }, [loadFindings]);

  async function dismiss(id: string) {
    setClearing(id);
    try {
      const res = await fetch("/api/admin/health-findings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setFindings((f) => f.filter((x) => x.id !== id));
    } finally {
      setClearing(null);
    }
  }

  if (!ready || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f6f3]">
        <Loader2 className="size-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  const critical = findings.filter((f) => f.severity === "critical").length;

  return (
    <div className="min-h-screen bg-[#f2f6f3] p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#0c1f17]"
        >
          <ArrowLeft className="size-4" /> Admin
        </Link>

        <div className="rounded-2xl border border-[#d1fae5] bg-gradient-to-br from-white to-emerald-50 p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
              <Activity className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#0c1f17]">System health</h1>
              <p className="text-xs text-slate-500">
                Checked daily across every account, for the failures that never raise an
                error — customers left waiting, replies sent twice, campaigns stopped.
              </p>
            </div>
          </div>
          {critical > 0 && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {critical} finding{critical === 1 ? "" : "s"} need attention now
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {error}
          </div>
        )}

        {!error && findings.length === 0 && (
          <div className="rounded-2xl border border-[#e7ece9] bg-white p-10 text-center">
            <CheckCircle2 className="mx-auto mb-3 size-9 text-emerald-500" />
            <h2 className="text-sm font-bold text-[#0c1f17]">Nothing to report</h2>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
              No customers waiting without a reply, no duplicate messages, no stalled
              campaigns, and nothing booked outside opening hours.
            </p>
          </div>
        )}

        <div className="space-y-2.5">
          {findings.map((f) => {
            const s = STYLES[f.severity] ?? STYLES.info;
            const Icon = s.icon;
            return (
              <div key={f.id} className={`rounded-xl border p-4 ${s.ring}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${s.tint}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${s.tint}`}>
                        {s.label}
                      </span>
                      <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {f.tenant_name}
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

        <p className="px-1 text-[11px] leading-relaxed text-slate-400">
          Runs daily at 03:00 UTC, or on demand at{" "}
          <code className="rounded bg-white px-1">/api/cron/health-check?secret=…</code>.
          Dismissing clears a finding from this list; if the problem persists it will be
          reported again on the next run.
        </p>
      </div>
    </div>
  );
}

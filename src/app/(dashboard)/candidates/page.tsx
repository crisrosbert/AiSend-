"use client";

// src/app/(dashboard)/candidates/page.tsx
// URL when deployed: https://app.performancemktg.net/candidates
//
// PURPOSE: The agency's view of the hiring pipeline. Shows every candidate
// the AI screened, filterable by stage and niche, with their structured
// profile and submitted assignment, plus hire/reject actions.
//
// 🧠 AGENTIC CONCEPT — HUMAN-IN-THE-LOOP / OVERSIGHT INTERFACE
// An autonomous agent working unsupervised is a liability. This page is the
// "control room": humans SEE what the agent did, CORRECT it, and make the
// high-stakes decisions (hire/reject) the agent is deliberately not allowed
// to make. Every serious agentic system needs this surface — automation
// handles volume, humans keep authority.
//
// 🧠 AGENTIC CONCEPT — OBSERVABILITY
// You can't trust what you can't inspect. Showing the agent's captured
// fields (niche, experience, portfolio) lets the agency verify the agent
// extracted things correctly — catching model mistakes before they cost a hire.

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Users, Loader2, ExternalLink, CheckCircle2, XCircle, FileText, Filter,
} from "lucide-react";

interface Candidate {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  niches: string[] | null;
  experience_years: number | null;
  portfolio_url: string | null;
  sample_links: string[] | null;
  availability: string | null;
  expected_rate: string | null;
  stage: string;
  assignment_topic: string | null;
  submission_text: string | null;
  submission_at: string | null;
  originality_flag: string | null;
  trial_paid: boolean | null;
  created_at: string;
}

// Pipeline stages — mirrors the agent's state machine in the DB.
// 🧠 AGENTIC CONCEPT: STATE MACHINE made visible. The agent advances these
// stages autonomously; the human sees the funnel and intervenes at the end.
const STAGES = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "screened", label: "Screened" },
  { key: "assignment_sent", label: "Assignment sent" },
  { key: "submitted", label: "Submitted" },
  { key: "in_review", label: "Needs review" },
  { key: "hired", label: "Hired" },
  { key: "rejected", label: "Not a fit" },
];

const STAGE_COLOR: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  screened: "bg-blue-100 text-blue-700",
  assignment_sent: "bg-amber-100 text-amber-700",
  submitted: "bg-purple-100 text-purple-700",
  in_review: "bg-red-100 text-red-700",
  hired: "bg-emerald-100 text-emerald-700",
  rejected: "bg-slate-100 text-slate-500",
};

export default function CandidatesPage() {
  const supabase = createClient();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState("all");
  const [niche, setNiche] = useState("");
  const [open, setOpen] = useState<Candidate | null>(null);

  const load = useCallback(async () => {
    // Yield one microtask so setState is never called synchronously
    // inside the mounting effect (avoids cascading-render warnings).
    await Promise.resolve();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    let q = supabase.from("candidates").select("*").eq("user_id", user.id)
      .order("updated_at", { ascending: false }).limit(200);
    if (stage !== "all") q = q.eq("stage", stage);
    const { data } = await q;

    let rows = (data || []) as Candidate[];
    // Niche filter is client-side because niches is an array column.
    if (niche.trim()) {
      const n = niche.trim().toLowerCase();
      rows = rows.filter((c) => (c.niches || []).some((x) => x.toLowerCase().includes(n)));
    }
    setCandidates(rows);
    setLoading(false);
  }, [supabase, stage, niche]);

  useEffect(() => {
    // Defer to a macrotask so no setState runs synchronously in the effect.
    const t = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  // 🧠 AGENTIC CONCEPT — HUMAN AUTHORITY / OVERRIDE
  // The agent can screen and advance stages, but ONLY a human can set
  // 'hired'. This is the deliberate boundary on the agent's autonomy.
  async function decide(c: Candidate, decision: "hired" | "rejected") {
    const { error } = await supabase.from("candidates")
      .update({ stage: decision, updated_at: new Date().toISOString() })
      .eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success(decision === "hired" ? "Marked as hired" : "Marked as not a fit");
    setOpen(null);
    load();
  }

  async function markTrialPaid(c: Candidate) {
    const { error } = await supabase.from("candidates")
      .update({ trial_paid: true, updated_at: new Date().toISOString() }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Trial marked paid");
    load();
  }

  const counts = STAGES.reduce((acc, s) => {
    acc[s.key] = s.key === "all" ? candidates.length : candidates.filter((c) => c.stage === s.key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="rounded-2xl border border-[#d1fae5] bg-gradient-to-br from-white to-emerald-50 p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
            <Users className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0c1f17]">Hiring pipeline</h1>
            <p className="text-xs text-slate-500">Candidates screened by your AI recruiter. You make the final call.</p>
          </div>
        </div>
      </div>

      {/* Stage filter — the funnel, visible */}
      <div className="flex flex-wrap gap-2">
        {STAGES.map((s) => (
          <button key={s.key} onClick={() => setStage(s.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              stage === s.key ? "bg-emerald-500 text-white" : "bg-white border border-[#e7ece9] text-slate-600 hover:bg-slate-50"
            }`}>
            {s.label}{counts[s.key] ? ` (${counts[s.key]})` : ""}
          </button>
        ))}
      </div>

      {/* Niche filter */}
      <div className="flex items-center gap-2">
        <Filter className="size-4 text-slate-400" />
        <input value={niche} onChange={(e) => setNiche(e.target.value)}
          placeholder="Filter by niche (medical, real estate…)"
          className="flex-1 rounded-lg border border-[#e7ece9] bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-emerald-500" /></div>
      ) : candidates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e7ece9] bg-white p-10 text-center text-sm text-slate-400">
          No candidates yet. They appear here as soon as your AI recruiter screens them.
        </div>
      ) : (
        <div className="space-y-2">
          {candidates.map((c) => (
            <button key={c.id} onClick={() => setOpen(c)}
              className="w-full text-left rounded-xl border border-[#e7ece9] bg-white p-3 hover:border-emerald-200 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#0c1f17]">{c.full_name || c.phone || "Candidate"}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STAGE_COLOR[c.stage] || "bg-slate-100 text-slate-600"}`}>
                      {c.stage.replace(/_/g, " ")}
                    </span>
                    {c.trial_paid && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">trial paid</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {(c.niches || []).join(", ") || "niche not captured"}
                    {c.experience_years != null && ` · ${c.experience_years} yr`}
                    {c.availability && ` · ${c.availability.replace(/_/g, " ")}`}
                  </div>
                </div>
                {c.submission_at && <FileText className="size-4 text-purple-500 shrink-0" />}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail drawer — the oversight surface */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpen(null)}>
          <div className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-base font-bold text-[#0c1f17]">{open.full_name || open.phone || "Candidate"}</h2>
              <p className="text-xs text-slate-500">{open.phone} {open.email ? `· ${open.email}` : ""}</p>
            </div>

            {/* Structured profile the AGENT extracted — observability */}
            <div className="rounded-xl bg-slate-50 p-3 space-y-1.5 text-xs">
              <div className="font-bold text-slate-700 mb-1">Captured by the AI</div>
              <Row label="Niches" value={(open.niches || []).join(", ")} />
              <Row label="Experience" value={open.experience_years != null ? `${open.experience_years} years` : ""} />
              <Row label="Availability" value={open.availability?.replace(/_/g, " ")} />
              <Row label="Expected rate" value={open.expected_rate} />
              {open.portfolio_url && (
                <div className="flex gap-2">
                  <span className="text-slate-500 w-24 shrink-0">Portfolio</span>
                  <a href={open.portfolio_url} target="_blank" rel="noreferrer" className="text-emerald-600 font-medium inline-flex items-center gap-1 break-all">
                    open <ExternalLink className="size-3" />
                  </a>
                </div>
              )}
              {(open.sample_links || []).map((s, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-slate-500 w-24 shrink-0">Sample {i + 1}</span>
                  <a href={s} target="_blank" rel="noreferrer" className="text-emerald-600 break-all">{s}</a>
                </div>
              ))}
            </div>

            {/* Assignment + submission */}
            {open.assignment_topic && (
              <div className="rounded-xl border border-[#e7ece9] p-3 space-y-1.5 text-xs">
                <div className="font-bold text-slate-700">Trial assignment</div>
                <p className="text-slate-600">{open.assignment_topic}</p>
                {open.originality_flag && (
                  <div className="text-[11px] text-slate-500">Originality check: <b>{open.originality_flag}</b></div>
                )}
                {open.submission_text ? (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-slate-50 p-2 text-slate-700 whitespace-pre-wrap">{open.submission_text}</div>
                ) : (
                  <div className="text-slate-400">No submission yet.</div>
                )}
                {open.submission_at && !open.trial_paid && (
                  <button onClick={() => markTrialPaid(open)} className="mt-2 rounded-lg bg-slate-100 px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-200">
                    Mark trial fee paid
                  </button>
                )}
              </div>
            )}

            {/* HUMAN DECISION — the boundary of the agent's autonomy */}
            <div className="flex gap-2 pt-1">
              <button onClick={() => decide(open, "hired")}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600">
                <CheckCircle2 className="size-4" /> Hire
              </button>
              <button onClick={() => decide(open, "rejected")}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-white border border-[#e7ece9] px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
                <XCircle className="size-4" /> Not a fit
              </button>
            </div>
            <p className="text-[11px] text-slate-400 text-center">
              Rejected candidates stay in your pool — you can re-contact them by niche later.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="text-slate-500 w-24 shrink-0">{label}</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}

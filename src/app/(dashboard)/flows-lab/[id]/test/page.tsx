"use client";

// src/app/(dashboard)/flows-lab/[id]/test/page.tsx
//
// The test console for a Lab flow.
//
// Everything on this page runs in the browser — no WhatsApp round-trip,
// no server call. The point is to see the flow behave end-to-end
// without any of the setup a real send would need:
//
//   Phone frame  │  Live response inspector
//    ↓ tap       │   ↓ what's captured so far
//    Next screen │   ↓ jump between runs, replay, clear
//
// Every submitted screen writes an entry to localStorage responses so
// completion rate and per-field values can be inspected between runs.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, RotateCcw, ChevronRight, ChevronDown,
  Check, X, ArrowLeftRight, Copy, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { PhonePreview } from "@/components/flows-lab/phone-preview";
import type { FlowDefinition, FlowResponse, FlowComponent } from "@/lib/flows-lab/types";
import { validateFlow } from "@/lib/flows-lab/types";
import {
  getFlow, listResponses, saveResponse, clearResponses,
} from "@/lib/flows-lab/storage";

export default function FlowTestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const slug = profile?.slug ?? "";

  const [flow, setFlow] = useState<FlowDefinition | null>(null);
  const [runResponse, setRunResponse] = useState<FlowResponse | null>(null);
  const [currentScreenId, setCurrentScreenId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [screenValues, setScreenValues] = useState<Record<string, Record<string, unknown>>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [previousRuns, setPreviousRuns] = useState<FlowResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const loaded = getFlow(id);
    if (!loaded) {
      toast.error("Flow not found");
      router.replace(`/${slug}/flows-lab`);
      return;
    }
    setFlow(loaded);
    setPreviousRuns(listResponses(id));
    startRun(loaded);
    // Only run this on mount / id change; startRun sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const problems = useMemo(() => (flow ? validateFlow(flow) : []), [flow]);
  const currentScreen = useMemo(
    () => flow?.screens.find((s) => s.id === currentScreenId) ?? null,
    [flow, currentScreenId],
  );

  // ── Run lifecycle ──────────────────────────────────────────────

  function startRun(f: FlowDefinition) {
    const now = new Date().toISOString();
    const response: FlowResponse = {
      id: crypto.randomUUID(),
      flowId: f.id,
      answers: {},
      screensSeen: [f.startScreenId],
      startedAt: now,
      status: "in_progress",
    };
    saveResponse(response);
    setRunResponse(response);
    setCurrentScreenId(f.startScreenId);
    setValues({});
    setScreenValues({});
    setShowSuccess(false);
    setError(null);
    setPreviousRuns(listResponses(f.id));
  }

  function restart() {
    if (flow) startRun(flow);
  }

  // ── Per-screen input ──────────────────────────────────────────
  function handleValueChange(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setError(null);
  }

  // ── Screen submission ────────────────────────────────────────
  // Enforces required-field validation, records answers into the
  // response, moves to the next screen (or SUCCESS), and updates
  // captured metrics as it goes.
  function handleSubmit(footer: FlowComponent) {
    if (!flow || !currentScreen || !runResponse) return;

    // Required-field check for the current screen.
    for (const comp of currentScreen.components) {
      if (!comp.required || !comp.name) continue;
      const v = values[comp.name];
      if (
        v === undefined ||
        v === "" ||
        v === null ||
        (Array.isArray(v) && v.length === 0)
      ) {
        setError(`"${comp.label}" is required`);
        return;
      }
    }

    // Persist the answers so this screen's data lives in the response.
    const nextScreenValues = { ...screenValues, [currentScreen.id]: { ...values } };
    setScreenValues(nextScreenValues);

    const nextAnswers: Record<string, unknown> = { ...runResponse.answers };
    for (const [k, v] of Object.entries(values)) nextAnswers[k] = v;

    const dest = footer.nextScreen ?? "SUCCESS";
    const complete = footer.onClickAction === "complete" || dest === "SUCCESS";

    const now = new Date().toISOString();
    const updated: FlowResponse = {
      ...runResponse,
      answers: nextAnswers,
      screensSeen: dest === "SUCCESS" ? runResponse.screensSeen : [...runResponse.screensSeen, dest],
      status: complete ? "completed" : "in_progress",
      completedAt: complete ? now : undefined,
    };
    saveResponse(updated);
    setRunResponse(updated);
    setPreviousRuns(listResponses(flow.id));

    if (complete) {
      setShowSuccess(true);
      toast.success("Flow completed");
    } else {
      // Load any values that had been entered on the destination
      // screen in this run (so the Back-and-forth flow works).
      setValues(nextScreenValues[dest] ?? {});
      setCurrentScreenId(dest);
      setError(null);
    }
  }

  function goToScreen(screenId: string) {
    if (!flow) return;
    // Preserve values on the current screen before jumping.
    if (currentScreenId) {
      setScreenValues((prev) => ({ ...prev, [currentScreenId]: values }));
    }
    setValues(screenValues[screenId] ?? {});
    setCurrentScreenId(screenId);
    setError(null);
    setShowSuccess(false);
  }

  // ── Guard ──────────────────────────────────────────────────────
  if (!flow) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-slate-500">
        Loading flow…
      </div>
    );
  }

  const totalStarted = previousRuns.length;
  const totalCompleted = previousRuns.filter((r) => r.status === "completed").length;
  const completionRate = totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/${slug}/flows-lab/${flow.id}/builder`}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold text-slate-900">{flow.name}</h1>
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">BETA</span>
            </div>
            <p className="text-[11px] text-slate-500">Test console — nothing sent to WhatsApp</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={restart} size="sm">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Restart
          </Button>
          <Link
            href={`/${slug}/flows-lab/${flow.id}/builder`}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit flow
          </Link>
        </div>
      </div>

      {/* ── Validation warning ───────────────────────────── */}
      {problems.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <div>
            <p className="font-bold">Flow has {problems.length} issue{problems.length === 1 ? "" : "s"}</p>
            <p className="mt-0.5 text-amber-800">You can still test but fix these before publishing.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Left: Phone preview */}
        <div className="col-span-5 flex flex-col items-center rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6">
          {currentScreen && (
            <PhonePreview
              screen={currentScreen}
              interactive={!showSuccess}
              values={values}
              onValueChange={handleValueChange}
              onSubmit={handleSubmit}
              showSuccess={showSuccess}
            />
          )}
          {error && (
            <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              <X className="h-3.5 w-3.5" />
              {error}
            </div>
          )}
        </div>

        {/* Right: Response inspector & runs */}
        <div className="col-span-7 flex flex-col gap-4">
          {/* Screen progress */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              Screens ({runResponse?.screensSeen.length ?? 0} of {flow.screens.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {flow.screens.map((s) => {
                const seen = runResponse?.screensSeen.includes(s.id);
                const isCurrent = currentScreenId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => goToScreen(s.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      isCurrent
                        ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-500"
                        : seen
                          ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          : "bg-white text-slate-400 ring-1 ring-slate-200"
                    }`}
                  >
                    {seen && !isCurrent && <Check className="h-3 w-3" />}
                    {isCurrent && <ArrowLeftRight className="h-3 w-3" />}
                    {s.title}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live response payload */}
          <div className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Response payload (live)
              </h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    JSON.stringify(runResponse?.answers ?? {}, null, 2),
                  );
                  toast.success("Copied to clipboard");
                }}
                className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-200"
              >
                <Copy className="h-3 w-3" />
                Copy JSON
              </button>
            </div>
            <div className="p-4">
              {Object.keys(runResponse?.answers ?? {}).length === 0 ? (
                <p className="text-xs italic text-slate-400">
                  No answers captured yet. Fill in fields and tap Continue to see them appear here.
                </p>
              ) : (
                <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                  {JSON.stringify(runResponse?.answers, null, 2)}
                </pre>
              )}
            </div>
          </div>

          {/* Previous runs */}
          <div className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Test runs
                </h3>
                {totalStarted > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                    {totalStarted} started · {totalCompleted} completed · {completionRate}%
                  </span>
                )}
              </div>
              {previousRuns.length > 0 && (
                <button
                  onClick={() => {
                    if (!confirm("Clear all test runs for this flow?")) return;
                    clearResponses(flow.id);
                    setPreviousRuns([]);
                    toast.success("Runs cleared");
                  }}
                  className="text-[10px] font-medium text-slate-500 hover:text-red-600"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {previousRuns.length === 0 ? (
                <p className="p-4 text-xs italic text-slate-400">
                  Complete the flow to see it appear here.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {previousRuns.map((r) => (
                    <RunRow key={r.id} run={r} isActive={r.id === runResponse?.id} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RunRow({ run, isActive }: { run: FlowResponse; isActive: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`px-4 py-3 ${isActive ? "bg-emerald-50/40" : ""}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        {open ? <ChevronDown className="h-3 w-3 text-slate-400" /> : <ChevronRight className="h-3 w-3 text-slate-400" />}
        <span
          className={`inline-flex h-4 items-center gap-1 rounded-full px-1.5 text-[9px] font-bold ${
            run.status === "completed"
              ? "bg-emerald-100 text-emerald-800"
              : run.status === "in_progress"
                ? "bg-blue-100 text-blue-800"
                : "bg-slate-100 text-slate-600"
          }`}
        >
          {run.status === "completed" ? "Completed" : run.status === "in_progress" ? "In progress" : "Abandoned"}
        </span>
        <span className="flex-1 text-xs text-slate-700">
          {run.screensSeen.length} screen{run.screensSeen.length === 1 ? "" : "s"} · {Object.keys(run.answers).length} field{Object.keys(run.answers).length === 1 ? "" : "s"}
        </span>
        <span className="text-[10px] text-slate-500">
          {new Date(run.startedAt).toLocaleTimeString()}
        </span>
      </button>
      {open && (
        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-50 p-2 text-[10px] text-slate-700">
          {JSON.stringify(run.answers, null, 2)}
        </pre>
      )}
    </li>
  );
}

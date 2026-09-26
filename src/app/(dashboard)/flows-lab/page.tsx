"use client";

// src/app/(dashboard)/flows-lab/page.tsx
//
// ── WHAT THIS IS ─────────────────────────────────────────────────
// The BETA Flows Lab — an experimental rewrite of /journeys using the
// WhatsApp Cloud API multi-screen interactive Flow model (buttons,
// forms, date pickers, etc.).
//
// Deliberately NOT live in production. Flows built here don't ship
// to WhatsApp yet — the test console renders them in an in-browser
// phone frame so we can prove the pattern works before wiring it up
// to Meta's API and retiring the old /journeys canvas.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FlaskConical, Plus, Play, Copy, Trash2, MoreVertical,
  Sparkles, TestTube2, TrendingUp,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { FlowDefinition } from "@/lib/flows-lab/types";
import { FLOW_CATEGORIES } from "@/lib/flows-lab/types";
import { listFlows, deleteFlow, duplicateFlow } from "@/lib/flows-lab/storage";
import { FLOW_TEMPLATES, TEMPLATE_ORDER } from "@/lib/flows-lab/templates";

export default function FlowsLabPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [flows, setFlows] = useState<FlowDefinition[]>([]);
  const [ready, setReady] = useState(false);

  const slug = profile?.slug ?? "";
  const userId = profile?.id ?? "";

  // Hydrate from localStorage on mount. localStorage is an external
  // store — the linter's set-state-in-effect rule is written for
  // React-derived state, so it doesn't fire here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!userId) return;
    setFlows(listFlows(userId));
    setReady(true);
  }, [userId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function refresh() {
    setFlows(listFlows(userId));
  }

  function handleNew() {
    router.push(`/${slug}/flows-lab/new`);
  }

  function handleDuplicate(id: string) {
    const copy = duplicateFlow(id);
    if (copy) {
      toast.success("Flow duplicated");
      refresh();
    }
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this flow? This can't be undone.")) return;
    deleteFlow(id);
    toast.success("Flow deleted");
    refresh();
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* ── BETA Banner ─────────────────────────────────────── */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-4">
        <div className="rounded-lg bg-amber-500/20 p-2">
          <FlaskConical className="h-5 w-5 text-amber-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-amber-900">Experimental — Flows Lab</h2>
            <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">BETA</span>
          </div>
          <p className="mt-1 text-xs text-amber-900/70">
            This is an in-progress rebuild of Chat Flows using the WhatsApp Cloud API multi-screen model.
            Nothing here is live to real WhatsApp yet — flows run in the in-app test console. If this
            experiment wins on user testing, it replaces /journeys and the old Chat Flows go away.
          </p>
        </div>
      </div>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Flows Lab</h1>
          <p className="mt-1 text-sm text-slate-500">
            Build, test and iterate on advanced multi-screen WhatsApp Flows.
          </p>
        </div>
        <Button onClick={handleNew} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="mr-2 h-4 w-4" />
          New flow
        </Button>
      </div>

      {/* ── Stats row ──────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <StatTile
          label="Total flows"
          value={flows.length}
          icon={<TestTube2 className="h-4 w-4" />}
          tone="emerald"
        />
        <StatTile
          label="Test runs"
          value={flows.reduce((sum, f) => sum + (f.metrics?.started ?? 0), 0)}
          icon={<Play className="h-4 w-4" />}
          tone="blue"
        />
        <StatTile
          label="Completions"
          value={flows.reduce((sum, f) => sum + (f.metrics?.completed ?? 0), 0)}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="violet"
        />
      </div>

      {/* ── Templates row ──────────────────────────────────── */}
      {ready && flows.length === 0 && (
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Start from a template</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {TEMPLATE_ORDER.map((key) => {
              const tpl = FLOW_TEMPLATES[key];
              const cat = FLOW_CATEGORIES.find((c) => c.slug === tpl.category);
              return (
                <Link
                  key={key}
                  href={`/${slug}/flows-lab/new?template=${key}`}
                  className="group rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-sm"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xl">{cat?.emoji}</span>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700">
                      {tpl.name}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500">{tpl.description}</p>
                  <div className="mt-3 text-[10px] font-medium text-slate-400">
                    {tpl.screens.length} screen{tpl.screens.length === 1 ? "" : "s"}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Flow list ──────────────────────────────────────── */}
      {ready && flows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <FlowCard
              key={flow.id}
              flow={flow}
              slug={slug}
              onDuplicate={() => handleDuplicate(flow.id)}
              onDelete={() => handleDelete(flow.id)}
            />
          ))}
        </div>
      )}

      {ready && flows.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-12 text-center">
          <FlaskConical className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <h3 className="mb-2 text-lg font-bold text-slate-900">No flows yet</h3>
          <p className="mb-4 text-sm text-slate-500">
            Pick a template above or start from scratch.
          </p>
          <Button onClick={handleNew} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="mr-2 h-4 w-4" />
            Create your first flow
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function StatTile({
  label, value, icon, tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "emerald" | "blue" | "violet";
}) {
  const bg = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue:    "bg-blue-50 text-blue-700",
    violet:  "bg-violet-50 text-violet-700",
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className={`rounded-lg p-1.5 ${bg}`}>{icon}</div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

function FlowCard({
  flow, slug, onDuplicate, onDelete,
}: {
  flow: FlowDefinition;
  slug: string;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const cat = FLOW_CATEGORIES.find((c) => c.slug === flow.category);
  const started = flow.metrics?.started ?? 0;
  const completed = flow.metrics?.completed ?? 0;
  const completionRate = started > 0 ? Math.round((completed / started) * 100) : 0;

  return (
    <div className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-emerald-300 hover:shadow-md">
      {/* Menu button */}
      <div className="absolute right-3 top-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-lg p-1.5 text-slate-400 opacity-0 transition-all hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Header */}
      <Link href={`/${slug}/flows-lab/${flow.id}/builder`} className="mb-3 flex items-start gap-2">
        <span className="text-2xl">{cat?.emoji}</span>
        <div className="min-w-0 flex-1 pr-6">
          <h3 className="truncate text-sm font-bold text-slate-900">{flow.name}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{cat?.label}</p>
        </div>
      </Link>

      {flow.description && (
        <p className="mb-3 line-clamp-2 text-xs text-slate-600">{flow.description}</p>
      )}

      {/* Stats */}
      <div className="mb-3 flex items-center gap-3 text-[11px] text-slate-500">
        <span>{flow.screens.length} screen{flow.screens.length === 1 ? "" : "s"}</span>
        <span className="text-slate-300">•</span>
        <span>{started} runs</span>
        {started > 0 && (
          <>
            <span className="text-slate-300">•</span>
            <span className={completionRate >= 70 ? "text-emerald-600" : completionRate >= 40 ? "text-amber-600" : "text-slate-500"}>
              {completionRate}% complete
            </span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto flex gap-2 pt-2">
        <Link
          href={`/${slug}/flows-lab/${flow.id}/builder`}
          className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-center text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Edit
        </Link>
        <Link
          href={`/${slug}/flows-lab/${flow.id}/test`}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
        >
          <Play className="h-3 w-3" />
          Test
        </Link>
      </div>
    </div>
  );
}

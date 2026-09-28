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
  Sparkles, TestTube2, TrendingUp, ArrowRight, LayoutTemplate,
  MousePointerClick, Rocket, PlayCircle, BookOpen, Lightbulb,
  Wand2, CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { FlowDefinition, FlowCategory } from "@/lib/flows-lab/types";
import { FLOW_CATEGORIES } from "@/lib/flows-lab/types";
import { listFlows, deleteFlow, duplicateFlow } from "@/lib/flows-lab/storage";
import { FLOW_TEMPLATES, TEMPLATE_ORDER } from "@/lib/flows-lab/templates";

// ── Color system ─────────────────────────────────────────────────
// Same palette approach as the builder: one CategoryColor per flow
// category, resolved through a fixed class map (never templated
// strings) so Tailwind's JIT never purges a class we need.
type CategoryColor = "emerald" | "sky" | "amber" | "indigo" | "rose" | "fuchsia" | "slate";

const COLOR_STYLES: Record<CategoryColor, {
  chipBg: string; chipText: string; chipBorder: string;
  iconBg: string; iconText: string;
  hoverBorder: string; hoverBg: string;
  solidBg: string; solidBgHover: string;
  ring: string; dot: string;
}> = {
  emerald: {
    chipBg: "bg-emerald-50", chipText: "text-emerald-700", chipBorder: "border-emerald-200",
    iconBg: "bg-emerald-100", iconText: "text-emerald-600",
    hoverBorder: "hover:border-emerald-300", hoverBg: "hover:bg-emerald-50/50",
    solidBg: "bg-emerald-600", solidBgHover: "hover:bg-emerald-700",
    ring: "ring-emerald-200", dot: "bg-emerald-500",
  },
  sky: {
    chipBg: "bg-sky-50", chipText: "text-sky-700", chipBorder: "border-sky-200",
    iconBg: "bg-sky-100", iconText: "text-sky-600",
    hoverBorder: "hover:border-sky-300", hoverBg: "hover:bg-sky-50/50",
    solidBg: "bg-sky-600", solidBgHover: "hover:bg-sky-700",
    ring: "ring-sky-200", dot: "bg-sky-500",
  },
  amber: {
    chipBg: "bg-amber-50", chipText: "text-amber-700", chipBorder: "border-amber-200",
    iconBg: "bg-amber-100", iconText: "text-amber-600",
    hoverBorder: "hover:border-amber-300", hoverBg: "hover:bg-amber-50/50",
    solidBg: "bg-amber-500", solidBgHover: "hover:bg-amber-600",
    ring: "ring-amber-200", dot: "bg-amber-500",
  },
  indigo: {
    chipBg: "bg-indigo-50", chipText: "text-indigo-700", chipBorder: "border-indigo-200",
    iconBg: "bg-indigo-100", iconText: "text-indigo-600",
    hoverBorder: "hover:border-indigo-300", hoverBg: "hover:bg-indigo-50/50",
    solidBg: "bg-indigo-600", solidBgHover: "hover:bg-indigo-700",
    ring: "ring-indigo-200", dot: "bg-indigo-500",
  },
  rose: {
    chipBg: "bg-rose-50", chipText: "text-rose-700", chipBorder: "border-rose-200",
    iconBg: "bg-rose-100", iconText: "text-rose-600",
    hoverBorder: "hover:border-rose-300", hoverBg: "hover:bg-rose-50/50",
    solidBg: "bg-rose-600", solidBgHover: "hover:bg-rose-700",
    ring: "ring-rose-200", dot: "bg-rose-500",
  },
  fuchsia: {
    chipBg: "bg-fuchsia-50", chipText: "text-fuchsia-700", chipBorder: "border-fuchsia-200",
    iconBg: "bg-fuchsia-100", iconText: "text-fuchsia-600",
    hoverBorder: "hover:border-fuchsia-300", hoverBg: "hover:bg-fuchsia-50/50",
    solidBg: "bg-fuchsia-600", solidBgHover: "hover:bg-fuchsia-700",
    ring: "ring-fuchsia-200", dot: "bg-fuchsia-500",
  },
  slate: {
    chipBg: "bg-slate-100", chipText: "text-slate-700", chipBorder: "border-slate-200",
    iconBg: "bg-slate-200", iconText: "text-slate-600",
    hoverBorder: "hover:border-slate-300", hoverBg: "hover:bg-slate-50",
    solidBg: "bg-slate-700", solidBgHover: "hover:bg-slate-800",
    ring: "ring-slate-200", dot: "bg-slate-500",
  },
};

const CATEGORY_COLOR: Record<FlowCategory, CategoryColor> = {
  lead_generation: "emerald",
  appointment_booking: "sky",
  customer_feedback: "amber",
  order_tracking: "indigo",
  support_ticket: "rose",
  product_catalog: "fuchsia",
  custom: "slate",
};

function colorFor(category: FlowCategory): CategoryColor {
  return CATEGORY_COLOR[category] ?? "slate";
}

export default function FlowsLabPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [flows, setFlows] = useState<FlowDefinition[]>([]);
  const [ready, setReady] = useState(false);

  // Links stay slug-free — the (dashboard) route group serves them
  // at /flows-lab/..., and the [slug]/flows-lab/ shim redirects
  // sidebar entries here. Admin users hit /admin/flows-lab/ via a
  // separate shim; either way, once inside these pages every
  // navigation uses /flows-lab/... without a tenant prefix.
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
    router.push(`/flows-lab/new`);
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
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-amber-50/60 to-white p-4 shadow-sm">
        <div className="rounded-xl bg-amber-100 p-2.5">
          <FlaskConical className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-amber-900">Experimental — Flows Lab</h2>
            <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
              BETA
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-amber-900/70">
            This is an in-progress rebuild of Chat Flows using the WhatsApp Cloud API multi-screen model.
            Nothing here is live to real WhatsApp yet — flows run in the in-app test console. If this
            experiment wins on user testing, it replaces /journeys and the old Chat Flows go away.
          </p>
        </div>
      </div>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm shadow-emerald-500/30">
            <Wand2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Flows Lab</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Build, test and iterate on advanced multi-screen WhatsApp Flows.
            </p>
          </div>
        </div>
        <Button
          onClick={handleNew}
          className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-sm shadow-emerald-500/30 hover:from-emerald-700 hover:to-emerald-600"
        >
          <Plus className="mr-2 h-4 w-4" />
          New flow
        </Button>
      </div>

      {/* ── Stats row ──────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Total flows"
          value={flows.length}
          icon={<TestTube2 className="h-4 w-4" />}
          color="emerald"
        />
        <StatTile
          label="Test runs"
          value={flows.reduce((sum, f) => sum + (f.metrics?.started ?? 0), 0)}
          icon={<Play className="h-4 w-4" />}
          color="sky"
        />
        <StatTile
          label="Completions"
          value={flows.reduce((sum, f) => sum + (f.metrics?.completed ?? 0), 0)}
          icon={<TrendingUp className="h-4 w-4" />}
          color="fuchsia"
        />
      </div>

      {/* ── How it works strip ───────────────────────────────
          Three-step explainer so a brand-new user immediately
          understands the mental model: pick a starting point,
          arrange screens + a submit button, then test it live. */}
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-slate-400" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            How Flows Lab works
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <HowItWorksStep
            step={1}
            color="emerald"
            icon={LayoutTemplate}
            title="Start from a template"
            description="Pick a ready-made flow below, or start blank and build screen by screen."
          />
          <HowItWorksStep
            step={2}
            color="sky"
            icon={MousePointerClick}
            title="Arrange your screens"
            description="Drag in questions, quick blocks like a lead form, and finish each screen with a Submit button."
          />
          <HowItWorksStep
            step={3}
            color="fuchsia"
            icon={Rocket}
            title="Test it live"
            description="Run it in the built-in phone preview and watch every answer land in real time."
          />
        </div>
      </div>

      {/* ── Templates row ──────────────────────────────────── */}
      {ready && flows.length === 0 && (
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Start from a template</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {TEMPLATE_ORDER.map((key) => {
              const tpl = FLOW_TEMPLATES[key];
              const cat = FLOW_CATEGORIES.find((c) => c.slug === tpl.category);
              const color = colorFor(tpl.category);
              const styles = COLOR_STYLES[color];
              return (
                <Link
                  key={key}
                  href={`/flows-lab/new?template=${key}`}
                  className={`group rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition-all ${styles.hoverBorder} ${styles.hoverBg} hover:shadow-sm`}
                >
                  <div className="mb-2 flex items-center gap-2.5">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ${styles.iconBg}`}>
                      {cat?.emoji}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {tpl.name}
                    </h4>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">{tpl.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styles.chipBg} ${styles.chipText} ${styles.chipBorder}`}>
                      {tpl.screens.length} screen{tpl.screens.length === 1 ? "" : "s"}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Flow list ──────────────────────────────────────── */}
      {ready && flows.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <FlowCard
              key={flow.id}
              flow={flow}
              onDuplicate={() => handleDuplicate(flow.id)}
              onDelete={() => handleDelete(flow.id)}
            />
          ))}
        </div>
      )}

      {ready && flows.length === 0 && (
        <div className="mb-8 rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-12 text-center">
          <FlaskConical className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <h3 className="mb-2 text-lg font-bold text-slate-900">No flows yet</h3>
          <p className="mb-4 text-sm text-slate-500">
            Pick a template above or start from scratch.
          </p>
          <Button
            onClick={handleNew}
            className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-sm shadow-emerald-500/30 hover:from-emerald-700 hover:to-emerald-600"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create your first flow
          </Button>
        </div>
      )}

      {/* ── Tutorials section ────────────────────────────────
          Two video slots (placeholders until real YouTube links
          are added) plus a short written walkthrough. Kept
          visually separate from the workspace above — this is a
          learning area, not part of the flow list. */}
      <TutorialsSection />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function StatTile({
  label, value, icon, color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: CategoryColor;
}) {
  const styles = COLOR_STYLES[color];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <div className={`rounded-lg p-1.5 ${styles.iconBg} ${styles.iconText}`}>{icon}</div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

function HowItWorksStep({
  step, color, icon: Icon, title, description,
}: {
  step: number;
  color: CategoryColor;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  const styles = COLOR_STYLES[color];
  return (
    <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${styles.iconBg} ${styles.iconText}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${styles.solidBg}`}>
            {step}
          </span>
          <h4 className="text-xs font-bold text-slate-900">{title}</h4>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function FlowCard({
  flow, onDuplicate, onDelete,
}: {
  flow: FlowDefinition;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const cat = FLOW_CATEGORIES.find((c) => c.slug === flow.category);
  const color = colorFor(flow.category);
  const styles = COLOR_STYLES[color];
  const started = flow.metrics?.started ?? 0;
  const completed = flow.metrics?.completed ?? 0;
  const completionRate = started > 0 ? Math.round((completed / started) * 100) : 0;

  return (
    <div className={`group relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all ${styles.hoverBorder} hover:shadow-md`}>
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
      <Link href={`/flows-lab/${flow.id}/builder`} className="mb-3 flex items-start gap-2.5">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${styles.iconBg}`}>
          {cat?.emoji}
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <h3 className="truncate text-sm font-bold text-slate-900">{flow.name}</h3>
          <span className={`mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${styles.chipBg} ${styles.chipText} ${styles.chipBorder}`}>
            {cat?.label}
          </span>
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
          href={`/flows-lab/${flow.id}/builder`}
          className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-center text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Edit
        </Link>
        <Link
          href={`/flows-lab/${flow.id}/test`}
          className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold text-white ${styles.solidBg} ${styles.solidBgHover}`}
        >
          <Play className="h-3 w-3" />
          Test
        </Link>
      </div>
    </div>
  );
}

// ── Tutorials ───────────────────────────────────────────────────
// Two placeholder video slots — swap `videoId` for a real YouTube
// ID to make it live. Written walkthrough sits alongside, mirroring
// the "watch + read" pattern common in product help centers, done
// in our own visual language rather than copied from anywhere.

interface TutorialVideo {
  videoId: string | null; // YouTube video ID, e.g. "dQw4w9WgXcQ" — null shows a "coming soon" placeholder
  title: string;
  description: string;
  duration?: string;
}

const TUTORIAL_VIDEOS: TutorialVideo[] = [
  {
    videoId: null,
    title: "Build your first flow in 4 minutes",
    description: "A walkthrough of picking a template, adding a lead-form quick block, and wiring up the Submit button.",
    duration: "4:12",
  },
  {
    videoId: null,
    title: "Designing multi-screen flows that convert",
    description: "How to sequence screens, when to branch, and best practices for keeping forms short on WhatsApp.",
    duration: "6:40",
  },
];

const WRITTEN_TIPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: LayoutTemplate,
    title: "Start with a template",
    body: "Templates give you a working screen structure — lead capture, bookings, feedback — so you're editing, not starting from a blank canvas.",
  },
  {
    icon: MousePointerClick,
    title: "Use quick blocks for common fields",
    body: "The Lead form and Contact form quick blocks drop in name/phone/email fields pre-wired with the right input type — no manual setup.",
  },
  {
    icon: CheckCircle2,
    title: "Every screen needs one Submit button",
    body: "The Footer component is the flow's Submit button. Set it to \"Submit & complete flow\" on the final screen so answers are handed back cleanly.",
  },
];

function TutorialsSection() {
  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/80 to-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
          <BookOpen className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Tutorials &amp; getting started</h3>
          <p className="text-xs text-slate-500">Short videos and tips to help you build your first flow.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Video slots */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {TUTORIAL_VIDEOS.map((video) => (
            <div key={video.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="relative aspect-video w-full bg-slate-900">
                {video.videoId ? (
                  <iframe
                    className="h-full w-full"
                    src={`https://www.youtube.com/embed/${video.videoId}`}
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-400">
                    <PlayCircle className="h-10 w-10 text-slate-500" />
                    <span className="text-[11px] font-medium">Video coming soon</span>
                  </div>
                )}
                {video.duration && (
                  <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {video.duration}
                  </span>
                )}
              </div>
              <div className="p-3">
                <h4 className="text-xs font-bold text-slate-900">{video.title}</h4>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{video.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Written content */}
        <div className="flex flex-col gap-3">
          {WRITTEN_TIPS.map((tip) => (
            <div key={tip.title} className="flex gap-3 rounded-xl border border-slate-100 bg-white p-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <tip.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900">{tip.title}</h4>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{tip.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

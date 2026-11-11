"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft, Workflow, Brain, Zap, Loader2, BookOpen,
} from "lucide-react";
import type { Journey } from "@/types/journey";

const TABS = [
  { slug: "canvas",  label: "Canvas",  icon: Workflow },
  { slug: "brain",   label: "Brain",   icon: Brain },
  { slug: "actions", label: "Actions", icon: Zap },
];

export default function JourneyLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ journeyId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const journeyId = params.journeyId;

  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);

  // Opened FROM an agent card (?from=agent): show only what an owner who
  // writes a prompt needs (the knowledge), not the flow-builder tabs. Read
  // in an effect, not useSearchParams, so the page stays buildable without a
  // Suspense boundary. Journeys opened from Chat Flows have no such flag and
  // keep every tab.
  const [fromAgent, setFromAgent] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);
  useEffect(() => {
    setFromAgent(new URLSearchParams(window.location.search).get("from") === "agent");
  }, [pathname]);

  // The canvas page renders its own top bar; for canvas we still mount the
  // layout but skip the chrome to avoid double headers.
  const isCanvas = pathname.endsWith("/canvas");

  useEffect(() => {
    async function load() {
      if (journeyId.startsWith("temp_")) {
        setJourney({
          id: journeyId, user_id: "", name: "Untitled Journey",
          status: "draft", created_at: "", updated_at: "",
          trigger: { type: "keyword", keywords: [] }, nodes: [], edges: [],
        });
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("journeys").select("*").eq("id", journeyId).maybeSingle();
      if (!data) {
        router.push("/journeys");
        return;
      }
      setJourney(data as Journey);
      // The agent that owns this journey, for the title. The journey keeps the
      // name it had when it was created ("New Agent knowledge") even after the
      // agent is renamed.
      const { data: owner } = await supabase
        .from("agents").select("name").eq("journey_id", journeyId).limit(1).maybeSingle();
      setAgentName(((owner as { name?: string } | null)?.name ?? "").trim() || null);
      setLoading(false);
    }
    load();
  }, [journeyId, router, supabase]);

  if (isCanvas) {
    // Canvas page draws its own chrome and uses full height.
    return <>{children}</>;
  }

  if (loading || !journey) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  const currentSlug = TABS.find((t) => pathname.endsWith(`/${t.slug}`))?.slug ?? "canvas";

  if (fromAgent) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/agents"
              title="Back to agent"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
                <BookOpen className="size-5 text-emerald-600" />
                {agentName ? `${agentName} knowledge` : journey.name}
              </h1>
              <p className="text-xs text-slate-500">
                Everything your agent can answer from. Add FAQs, website pages or files below.
              </p>
            </div>
          </div>
          <Link
            href="/agents"
            className="rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Back to agent (persona and settings)
          </Link>
        </div>

        {children}

        <p className="text-[11px] text-slate-400">
          Advanced:{" "}
          <Link href={`/journeys/${journeyId}/canvas`} className="font-semibold text-emerald-700 hover:underline">
            open flow builder
          </Link>{" "}
          (for chat flows, not needed for a prompt-based agent).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/journeys" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
            {journey.name}
          </h1>
          <div className="text-[10px] text-slate-400">
            {journey.status === "active" ? "Live · running on WhatsApp" : "Draft · not yet running"}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[#e7ece9] bg-white p-1.5 shadow-sm w-fit">
        {TABS.map((t) => {
          const active = t.slug === currentSlug;
          return (
            <Link
              key={t.slug}
              href={`/journeys/${journeyId}/${t.slug}`}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${
                active
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              <t.icon className="size-4" />
              {t.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}

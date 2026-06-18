"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft, Workflow, Brain, Zap, Sparkles, Loader2,
} from "lucide-react";
import type { Journey } from "@/types/journey";

const TABS = [
  { slug: "canvas",  label: "Canvas",  icon: Workflow },
  { slug: "brain",   label: "Brain",   icon: Brain },
  { slug: "actions", label: "Actions", icon: Zap },
  { slug: "persona", label: "Persona", icon: Sparkles },
];

export default function JourneyLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ journeyId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const journeyId = params.journeyId;

  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);

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
